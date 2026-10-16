<?php

namespace Tests;

use App\Models\Batch;
use App\Models\Drug;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function makeTenant(string $name = 'Test Pharmacy', string $role = 'owner'): User
    {
        $tenant = Tenant::create([
            'name' => $name,
            'slug' => str($name)->slug().'-'.uniqid(),
            'vat_rate' => 7.5,
            'status' => 'active',
        ]);

        return User::create([
            'tenant_id' => $tenant->id,
            'name' => "{$name} {$role}",
            'email' => $role.'@'.str($name)->slug().'.test',
            'password' => 'password',
            'role' => $role,
        ]);
    }

    /**
     * Run a block as if inside a request for this tenant.
     */
    protected function asTenant(User $user, callable $callback): mixed
    {
        return app(TenantContext::class)->run($user->tenant_id, $callback);
    }

    protected function makeDrug(User $user, array $attributes = []): Drug
    {
        return $this->asTenant($user, fn () => Drug::create($attributes + [
            'name' => 'Paracetamol 500mg',
            'selling_price' => 100,
            'cost_price' => 60,
            'reorder_level' => 5,
        ]));
    }

    protected function makeBatch(Drug $drug, string $expiry, int $qty, ?string $number = null): Batch
    {
        return app(TenantContext::class)->run($drug->tenant_id, fn () => Batch::create([
            'drug_id' => $drug->id,
            'batch_number' => $number ?? 'B'.uniqid(),
            'expiry_date' => $expiry,
            'quantity_received' => $qty,
            'quantity_remaining' => $qty,
            'cost_price' => 60,
            'received_at' => now(),
        ]));
    }
}
