<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Small driver-aware SQL fragments. Timestamps are stored in UTC;
 * reporting buckets use Africa/Lagos (UTC+1, no DST).
 */
final class Sql
{
    public static function isMysql(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }

    public static function localDate(string $column): string
    {
        return self::isMysql()
            ? "DATE(DATE_ADD({$column}, INTERVAL 1 HOUR))"
            : "date({$column}, '+1 hour')";
    }

    public static function localHour(string $column): string
    {
        return self::isMysql()
            ? "HOUR(DATE_ADD({$column}, INTERVAL 1 HOUR))"
            : "CAST(strftime('%H', {$column}, '+1 hour') AS INTEGER)";
    }

    /**
     * Start of "today" in Lagos, expressed in UTC for WHERE clauses.
     */
    public static function lagosDayStartUtc(?\DateTimeInterface $day = null): \Illuminate\Support\Carbon
    {
        $lagos = $day ? \Illuminate\Support\Carbon::instance($day) : now('Africa/Lagos');

        return $lagos->copy()->setTimezone('Africa/Lagos')->startOfDay()->utc();
    }
}
