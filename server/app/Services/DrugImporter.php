<?php

namespace App\Services;

use App\Models\Drug;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use League\Csv\Reader;
use League\Csv\Statement;

/**
 * CSV catalogue import (FR-2.7). Idempotent on (nafdac_number, pack_size),
 * falling back to (name, strength, pack_size) when no NAFDAC number is given.
 * Each HTTP call processes one chunk of 200 rows so it stays well inside
 * shared-hosting execution limits; the client calls again with the offset.
 */
class DrugImporter
{
    public const CHUNK = 200;

    public const COLUMNS = [
        'name', 'generic_name', 'brand', 'nafdac_number', 'category', 'form', 'strength', 'pack_size',
        'barcode', 'cost_price', 'selling_price', 'tax_rate', 'reorder_level',
        'batch_number', 'expiry_date', 'quantity',
    ];

    public function __construct(private readonly StockService $stock) {}

    public function store(\Illuminate\Http\UploadedFile $file, int $tenantId): array
    {
        $token = Str::random(32);
        $path = "imports/{$tenantId}/{$token}.csv";
        Storage::disk('local')->putFileAs("imports/{$tenantId}", $file, "{$token}.csv");

        $reader = $this->reader($path);

        return [
            'token' => $token,
            'total' => count($reader),
            'headers' => $reader->getHeader(),
        ];
    }

    public function processChunk(string $token, int $offset, User $user): array
    {
        $path = "imports/{$user->tenant_id}/{$token}.csv";
        if (! Storage::disk('local')->exists($path)) {
            abort(404, 'Import not found or already finished.');
        }

        $reader = $this->reader($path);
        $total = count($reader);
        $records = Statement::create()->offset($offset)->limit(self::CHUNK)->process($reader);

        $created = $updated = $batches = 0;
        $errors = [];
        $row = $offset + 1;

        DB::transaction(function () use ($records, $user, &$created, &$updated, &$batches, &$errors, &$row) {
            foreach ($records as $record) {
                $row++;
                $data = $this->normalise($record);
                $validator = Validator::make($data, [
                    'name' => 'required|string|max:255',
                    'selling_price' => 'required|numeric|min:0',
                    'cost_price' => 'nullable|numeric|min:0',
                    'tax_rate' => 'nullable|numeric|min:0|max:100',
                    'reorder_level' => 'nullable|integer|min:0',
                    'batch_number' => 'nullable|required_with:quantity|string|max:64',
                    'expiry_date' => 'nullable|required_with:quantity|date',
                    'quantity' => 'nullable|integer|min:1',
                ]);

                if ($validator->fails()) {
                    $errors[] = ['row' => $row, 'message' => $validator->errors()->first()];

                    continue;
                }

                $match = Drug::query()->when(
                    $data['nafdac_number'],
                    fn ($q) => $q->where('nafdac_number', $data['nafdac_number'])->where('pack_size', $data['pack_size']),
                    fn ($q) => $q->where('name', $data['name'])->where('strength', $data['strength'])->where('pack_size', $data['pack_size']),
                )->first();

                $attributes = collect($data)->only([
                    'name', 'generic_name', 'brand', 'nafdac_number', 'category', 'form', 'strength', 'pack_size',
                    'barcode', 'cost_price', 'selling_price', 'tax_rate', 'reorder_level',
                ])->reject(fn ($v) => $v === null)->all();

                if ($match) {
                    $match->update($attributes + ['is_active' => true]);
                    $drug = $match;
                    $updated++;
                } else {
                    $drug = Drug::create($attributes);
                    $created++;
                }

                // Opening stock: only when a batch is given and it isn't already on file.
                if ($data['quantity'] && ! $drug->batches()->where('batch_number', $data['batch_number'])->exists()) {
                    $this->stock->receiveBatch($drug, $user, [
                        'batch_number' => $data['batch_number'],
                        'expiry_date' => $data['expiry_date'],
                        'quantity' => (int) $data['quantity'],
                        'cost_price' => $data['cost_price'] ?? $drug->cost_price,
                    ]);
                    $batches++;
                }
            }
        });

        $next = $offset + self::CHUNK;
        $done = $next >= $total;
        if ($done) {
            Storage::disk('local')->delete($path);
            DashboardService::forget($user->tenant_id);
        }

        return [
            'token' => $token,
            'total' => $total,
            'processed' => min($next, $total),
            'next_offset' => $done ? null : $next,
            'done' => $done,
            'created' => $created,
            'updated' => $updated,
            'batches' => $batches,
            'errors' => $errors,
        ];
    }

    private function reader(string $path): Reader
    {
        $reader = Reader::createFromPath(Storage::disk('local')->path($path));
        $reader->setHeaderOffset(0);
        $reader->skipEmptyRecords();

        return $reader;
    }

    private function normalise(array $record): array
    {
        $record = collect($record)->mapWithKeys(fn ($v, $k) => [Str::snake(trim((string) $k)) => is_string($v) ? trim($v) : $v]);
        $out = [];
        foreach (self::COLUMNS as $column) {
            $value = $record->get($column);
            $out[$column] = ($value === '' || $value === null) ? null : $value;
        }
        foreach (['cost_price', 'selling_price'] as $money) {
            if ($out[$money] !== null) {
                $out[$money] = str_replace([',', '₦', ' '], '', (string) $out[$money]);
            }
        }

        return $out;
    }
}
