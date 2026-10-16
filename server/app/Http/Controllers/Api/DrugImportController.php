<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DrugImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DrugImportController extends Controller
{
    public function __construct(private readonly DrugImporter $importer) {}

    /**
     * Start: multipart `file`. Continue: JSON { token, offset }.
     * Each call processes one 200-row chunk.
     */
    public function __invoke(Request $request): JsonResponse
    {
        if ($request->hasFile('file')) {
            $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:10240']]);
            $stored = $this->importer->store($request->file('file'), $request->user()->tenant_id);

            $missing = array_diff(['name', 'selling_price'], array_map(fn ($h) => \Illuminate\Support\Str::snake(trim($h)), $stored['headers']));
            if ($missing) {
                return response()->json([
                    'message' => 'The CSV is missing required columns: '.implode(', ', $missing).'. Download the template to see the expected format.',
                    'errors' => ['file' => ['Missing columns: '.implode(', ', $missing)]],
                ], 422);
            }

            return response()->json(['data' => $this->importer->processChunk($stored['token'], 0, $request->user())]);
        }

        $data = $request->validate([
            'token' => ['required', 'string', 'alpha_num', 'size:32'],
            'offset' => ['required', 'integer', 'min:0'],
        ]);

        return response()->json(['data' => $this->importer->processChunk($data['token'], (int) $data['offset'], $request->user())]);
    }

    public function template(): StreamedResponse
    {
        return response()->streamDownload(function () {
            $out = fopen('php://output', 'w');
            fputcsv($out, DrugImporter::COLUMNS);
            fputcsv($out, ['Paracetamol 500mg Tablets', 'Paracetamol', 'Emzor', 'A4-0123', 'Analgesics', 'Tablet', '500mg', '10x10', '6151100012345', '850', '1200', '', '20', 'EMZ2401', now()->addYear()->format('Y-m-d'), '50']);
            fputcsv($out, ['Amoxicillin 500mg Capsules', 'Amoxicillin', 'Fidson', 'A4-4567', 'Antibiotics', 'Capsule', '500mg', '10x10', '', '1500', '2200', '', '10', '', '', '']);
            fclose($out);
        }, 'medipharm-drug-import-template.csv', ['Content-Type' => 'text/csv']);
    }
}
