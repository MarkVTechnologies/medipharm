<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Model;

/**
 * Human references (SAL-00001, PO-00001, CUS-0001) are generated in the app,
 * not the database. Callers must hold a lock on the tenant row (see
 * TenantLock) so two concurrent requests cannot mint the same number.
 *
 * @template TModel of Model
 */
class ReferenceGenerator
{
    /**
     * @param  class-string<TModel>  $model
     */
    public function next(string $model, string $column, string $prefix, int $pad = 5): string
    {
        $last = $model::query()
            ->where($column, 'like', $prefix.'-%')
            ->orderByDesc('id')
            ->value($column);

        $number = $last ? ((int) substr($last, strlen($prefix) + 1)) + 1 : 1;

        return $prefix.'-'.str_pad((string) $number, $pad, '0', STR_PAD_LEFT);
    }
}
