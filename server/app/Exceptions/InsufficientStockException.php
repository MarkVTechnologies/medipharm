<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class InsufficientStockException extends RuntimeException
{
    public function __construct(
        public readonly int $drugId,
        public readonly string $drugName,
        public readonly int $available,
    ) {
        parent::__construct("{$drugName} is no longer available in that quantity (only {$available} left).");
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'errors' => ['items' => [$this->getMessage()]],
            'drug_id' => $this->drugId,
            'available' => $this->available,
        ], 422);
    }
}
