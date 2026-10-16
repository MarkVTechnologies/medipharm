<?php

namespace App\Services;

use App\Models\Tenant;

/**
 * Locks the tenant row for the rest of the current transaction. Taking this
 * lock first, in every write path that mints references or touches batches,
 * gives all such transactions one consistent lock order — so they serialise
 * instead of deadlocking on batch rows taken in different orders.
 */
class TenantLock
{
    public function acquire(int $tenantId): Tenant
    {
        return Tenant::query()->whereKey($tenantId)->lockForUpdate()->firstOrFail();
    }
}
