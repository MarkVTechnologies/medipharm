<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Drug;
use App\Models\Sale;
use App\Models\Tenant;
use App\Models\User;

/**
 * First-run checklist for a new pharmacy (spec goal G3: signup to first
 * sale in under 20 minutes, unassisted). Every step is derived from real
 * data, so ticks appear the moment the work is done. Cheap: five indexed
 * existence checks, computed outside the dashboard cache.
 */
class OnboardingService
{
    public function forTenant(Tenant $tenant): ?array
    {
        if ($tenant->onboarding_dismissed_at) {
            return null;
        }

        $steps = [
            [
                'key' => 'profile',
                'title' => 'Complete your pharmacy profile',
                'description' => 'Address, phone and premises licence number print on every receipt.',
                'done' => filled($tenant->address) && filled($tenant->phone) && filled($tenant->licence_number),
                'action' => ['label' => 'Open profile', 'to' => '/settings/profile'],
                'optional' => false,
            ],
            [
                'key' => 'catalogue',
                'title' => 'Add your drugs',
                'description' => 'Import your whole catalogue from a spreadsheet, or add drugs one by one.',
                'done' => Drug::query()->exists(),
                'action' => ['label' => 'Import CSV', 'to' => '/inventory/import'],
                'optional' => false,
            ],
            [
                'key' => 'stock',
                'title' => 'Record your stock',
                'description' => 'Each batch needs its expiry date — that is what powers expiry alerts.',
                'done' => Batch::query()->where('quantity_remaining', '>', 0)->exists(),
                'action' => ['label' => 'Go to inventory', 'to' => '/inventory'],
                'optional' => false,
            ],
            [
                'key' => 'team',
                'title' => 'Invite your team',
                'description' => 'Give pharmacists and counter assistants their own logins.',
                'done' => User::query()->count() > 1,
                'action' => ['label' => 'Add staff', 'to' => '/settings/staff'],
                'optional' => true,
            ],
            [
                'key' => 'first_sale',
                'title' => 'Make your first sale',
                'description' => 'Search or scan, take payment, print the receipt.',
                'done' => Sale::query()->exists(),
                'action' => ['label' => 'Open the till', 'to' => '/pos'],
                'optional' => false,
            ],
        ];

        $required = array_filter($steps, fn ($s) => ! $s['optional']);
        $complete = count(array_filter($required, fn ($s) => $s['done'])) === count($required);

        return [
            'steps' => $steps,
            'completed' => count(array_filter($steps, fn ($s) => $s['done'])),
            'total' => count($steps),
            'complete' => $complete,
        ];
    }
}
