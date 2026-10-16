<?php

namespace Tests\Feature;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class TenancyTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Models without tenant_id that are only reached through a scoped parent.
     */
    private const ALLOW_LIST = [
        'Tenant',            // the tenant itself
        'SaleItem',          // via Sale
        'PurchaseOrderItem', // via PurchaseOrder
    ];

    public function test_every_model_uses_belongs_to_tenant_or_is_allow_listed(): void
    {
        $offenders = collect(File::files(app_path('Models')))
            ->map(fn ($f) => $f->getFilenameWithoutExtension())
            ->reject(fn ($name) => in_array($name, self::ALLOW_LIST, true))
            ->reject(fn ($name) => in_array(BelongsToTenant::class, class_uses_recursive("App\\Models\\{$name}"), true))
            ->values()
            ->all();

        $this->assertSame([], $offenders, 'These models are a cross-tenant leak: '.implode(', ', $offenders));
    }

    public function test_foreign_tenant_record_returns_404_not_403(): void
    {
        $a = $this->makeTenant('Alpha');
        $b = $this->makeTenant('Bravo');
        $bravoDrug = $this->makeDrug($b, ['name' => 'Bravo Secret']);

        $this->actingAs($a)->getJson("/api/drugs/{$bravoDrug->id}")->assertNotFound();
        $this->actingAs($a)->patchJson("/api/drugs/{$bravoDrug->id}", ['name' => 'x'])->assertNotFound();
        $this->actingAs($b)->getJson("/api/drugs/{$bravoDrug->id}")->assertOk();
    }

    public function test_lists_only_show_own_tenant_rows(): void
    {
        $a = $this->makeTenant('Alpha');
        $b = $this->makeTenant('Bravo');
        $this->makeDrug($a, ['name' => 'Alpha Drug']);
        $this->makeDrug($b, ['name' => 'Bravo Drug']);

        $this->actingAs($a)->getJson('/api/drugs')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Alpha Drug');
    }

    public function test_registration_creates_tenant_and_owner(): void
    {
        $this->postJson('/api/register', [
            'pharmacy_name' => 'New Pharm',
            'name' => 'Owner',
            'email' => 'owner@new.test',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ])->assertCreated()->assertJsonPath('data.user.role', 'owner')->assertJsonPath('data.tenant.vat_rate', 7.5);
    }

    public function test_assistant_cannot_edit_drugs(): void
    {
        $owner = $this->makeTenant('Alpha');
        $assistant = \App\Models\User::create([
            'tenant_id' => $owner->tenant_id, 'name' => 'A', 'email' => 'a@a.test', 'password' => 'password', 'role' => 'assistant',
        ]);

        $this->actingAs($assistant)->postJson('/api/drugs', ['name' => 'X', 'selling_price' => 10])->assertForbidden();
    }
}
