<?php

namespace App\Console\Commands;

use App\Models\Batch;
use App\Services\DashboardService;
use Illuminate\Console\Command;

/**
 * Flags batches past expiry. Expired batches are already excluded from
 * sellable stock by the Batch::sellable() scope; this records when it
 * happened. It never writes off — that destroys value silently (spec §13).
 */
class ExpirySweep extends Command
{
    protected $signature = 'medipharm:expiry-sweep';

    protected $description = 'Flag batches that have passed their expiry date';

    public function handle(): int
    {
        $tenants = [];

        Batch::withoutGlobalScopes()
            ->whereNull('expired_flagged_at')
            ->whereNull('written_off_at')
            ->where('quantity_remaining', '>', 0)
            ->where('expiry_date', '<=', now()->toDateString())
            ->select(['id', 'tenant_id'])
            ->chunkById(500, function ($batches) use (&$tenants) {
                Batch::withoutGlobalScopes()->whereIn('id', $batches->pluck('id'))->update(['expired_flagged_at' => now()]);
                foreach ($batches as $b) {
                    $tenants[$b->tenant_id] = true;
                }
            });

        foreach (array_keys($tenants) as $tenantId) {
            DashboardService::forget($tenantId);
        }

        $this->info('Flagged expired batches for '.count($tenants).' tenant(s).');

        return self::SUCCESS;
    }
}
