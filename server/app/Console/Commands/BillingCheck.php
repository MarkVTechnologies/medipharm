<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Moves overdue tenants to read-only (never deletion or lockout, FR-9.5)
 * and sends renewal reminders.
 */
class BillingCheck extends Command
{
    protected $signature = 'medipharm:billing-check';

    protected $description = 'Mark overdue tenants read-only and send renewal reminders';

    public function handle(TenantContext $context): int
    {
        $grace = (int) config('medipharm.grace_days');

        Tenant::query()->whereIn('status', ['trial', 'active'])->each(function (Tenant $tenant) use ($context, $grace) {
            $context->run($tenant->id, function () use ($tenant, $grace) {
                $subscription = Subscription::query()->latest('id')->first();
                $renews = $subscription?->renews_at ?? $tenant->trial_ends_at;
                if (! $renews) {
                    return;
                }

                if ($renews->copy()->addDays($tenant->status === 'trial' ? 0 : $grace)->isPast()) {
                    $tenant->update(['status' => 'past_due']);
                    $subscription?->update(['status' => 'past_due']);
                    $this->line("{$tenant->slug}: moved to past_due (read-only)");

                    return;
                }

                $daysLeft = (int) now()->diffInDays($renews, false);
                if (in_array($daysLeft, [7, 3, 1], true)) {
                    $owners = User::query()->where('role', 'owner')->where('is_active', true)->pluck('email');
                    foreach ($owners as $email) {
                        Mail::raw(
                            "Your MediPharm subscription for {$tenant->name} renews in {$daysLeft} day(s). Renew in Settings → Billing to keep full access. Your records are never deleted.",
                            fn ($m) => $m->to($email)->subject('MediPharm renewal reminder'),
                        );
                    }
                }
            });
        });

        return self::SUCCESS;
    }
}
