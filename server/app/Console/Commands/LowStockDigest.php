<?php

namespace App\Console\Commands;

use App\Models\Batch;
use App\Models\Drug;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class LowStockDigest extends Command
{
    protected $signature = 'medipharm:low-stock-digest';

    protected $description = 'Email each owner their low-stock and expiring-soon lists';

    public function handle(TenantContext $context): int
    {
        Tenant::query()->whereIn('status', ['trial', 'active', 'past_due'])->each(function (Tenant $tenant) use ($context) {
            $context->run($tenant->id, function () use ($tenant) {
                $low = Drug::query()->active()->select('drugs.*')->withStock()->get()
                    ->filter(fn ($d) => (int) $d->stock_on_hand <= $d->reorder_level)
                    ->sortBy('stock_on_hand');

                $expiring = Batch::query()->with('drug:id,name,strength')->sellable()
                    ->where('expiry_date', '<=', now()->addDays(60)->toDateString())
                    ->orderBy('expiry_date')->get();

                if ($low->isEmpty() && $expiring->isEmpty()) {
                    return;
                }

                $lines = ["Good morning from MediPharm. Here is today's stock summary for {$tenant->name}.", ''];
                if ($low->isNotEmpty()) {
                    $lines[] = "LOW / OUT OF STOCK ({$low->count()})";
                    foreach ($low->take(50) as $d) {
                        $lines[] = "- {$d->name} {$d->strength}: {$d->stock_on_hand} left (reorder at {$d->reorder_level})";
                    }
                    $lines[] = '';
                }
                if ($expiring->isNotEmpty()) {
                    $lines[] = "EXPIRING WITHIN 60 DAYS ({$expiring->count()})";
                    foreach ($expiring->take(50) as $b) {
                        $value = number_format($b->quantity_remaining * (float) $b->cost_price, 2);
                        $lines[] = "- {$b->drug?->name} batch {$b->batch_number}: {$b->quantity_remaining} units, expires {$b->expiry_date->format('d M Y')} (₦{$value} at cost)";
                    }
                }

                $owners = User::query()->where('role', 'owner')->where('is_active', true)->pluck('email');
                foreach ($owners as $email) {
                    Mail::raw(implode("\n", $lines), fn ($m) => $m->to($email)->subject("{$tenant->name}: stock alerts"));
                }
            });
        });

        return self::SUCCESS;
    }
}
