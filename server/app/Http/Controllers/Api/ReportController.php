<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    private const MAX_JSON_ROWS = 500;

    public function __construct(private readonly ReportBuilder $reports) {}

    public function sales(Request $request): Response
    {
        $request->validate(['group' => ['nullable', 'in:day,drug,category,staff,payment_method']]);

        return $this->respond($request, 'sales', fn () => $this->reports->salesReport($request->query('group', 'day')));
    }

    public function inventory(Request $request): Response
    {
        $request->validate(['view' => ['nullable', 'in:valuation,movement,dead_stock,expiry']]);

        return $this->respond($request, 'inventory', fn () => $this->reports->inventoryReport($request->query('view', 'valuation')));
    }

    public function financial(Request $request): Response
    {
        return $this->respond($request, 'financial', fn () => $this->reports->financialReport());
    }

    public function customers(Request $request): Response
    {
        return $this->respond($request, 'customers', fn () => $this->reports->customerReport());
    }

    private function respond(Request $request, string $name, callable $build): Response
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'format' => ['nullable', 'in:json,csv'],
        ]);

        $this->reports->between($request->query('from'), $request->query('to'));
        $report = $build();
        $range = $this->reports->range();

        if ($request->query('format') === 'csv') {
            return $this->csv($report, "medipharm-{$name}-{$range['from']}-to-{$range['to']}.csv");
        }

        $rows = $report['query']->limit(self::MAX_JSON_ROWS + 1)->get();

        return response()->json([
            'data' => [
                'summary' => $report['summary'],
                'columns' => collect($report['columns'])->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
                'rows' => $rows->take(self::MAX_JSON_ROWS)->map($report['map'])->values(),
            ],
            'meta' => $range + ['truncated' => $rows->count() > self::MAX_JSON_ROWS],
        ]);
    }

    /**
     * Streams row by row via cursor() — never builds the export in memory (FR-8.2).
     */
    private function csv(array $report, string $filename): Response
    {
        return response()->streamDownload(function () use ($report) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM so Excel opens UTF-8 (₦) correctly
            fputcsv($out, array_values($report['columns']));

            foreach ($report['query']->cursor() as $row) {
                $mapped = ($report['map'])($row);
                fputcsv($out, array_map(fn ($key) => $mapped[$key] ?? '', array_keys($report['columns'])));
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
