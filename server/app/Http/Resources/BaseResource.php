<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * MySQL DECIMAL arrives in PHP as a string. Every money field leaves the API
 * as a float, converted here and only here (FR-8.1).
 */
abstract class BaseResource extends JsonResource
{
    protected function money(mixed $value): ?float
    {
        return Money::float($value);
    }

    protected function date(mixed $value): ?string
    {
        return $value?->toIso8601String();
    }
}
