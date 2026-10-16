<?php

namespace App\Support;

/**
 * Money arithmetic happens in integer kobo — never PHP floats or string math.
 * DECIMAL comes out of MySQL as a string; convert once, here.
 */
final class Money
{
    public static function toKobo(string|int|float|null $naira): int
    {
        if ($naira === null || $naira === '') {
            return 0;
        }

        return (int) round(((float) $naira) * 100);
    }

    public static function toNaira(int $kobo): string
    {
        return number_format($kobo / 100, 2, '.', '');
    }

    /**
     * Percentage of an amount, rounded half-up to the nearest kobo.
     */
    public static function percent(int $kobo, float $percent): int
    {
        return (int) round($kobo * $percent / 100);
    }

    public static function float(string|int|float|null $value): ?float
    {
        return $value === null ? null : round((float) $value, 2);
    }
}
