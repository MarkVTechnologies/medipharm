<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regression coverage for SQL that differs between engines. Run against
 * MySQL/MariaDB too: see "Tests" in the README.
 */
class InventoryAndReportsTest extends TestCase
{
    use RefreshDatabase;

    public function test_stock_status_filters(): void
    {
        $user = $this->makeTenant();
        $out = $this->makeDrug($user, ['name' => 'Out Drug', 'reorder_level' => 5]);
        $low = $this->makeDrug($user, ['name' => 'Low Drug', 'reorder_level' => 5]);
        $ok = $this->makeDrug($user, ['name' => 'Ok Drug', 'reorder_level' => 5]);
        $this->makeBatch($low, now()->addYear()->toDateString(), 3);
        $this->makeBatch($ok, now()->addYear()->toDateString(), 50);
        $this->makeBatch($out, now()->subDay()->toDateString(), 99); // expired stock is not stock

        $names = fn (string $status) => collect($this->actingAs($user)->getJson("/api/drugs?status={$status}")->assertOk()->json('data'))->pluck('name')->all();

        $this->assertSame(['Out Drug'], $names('out'));
        $this->assertSame(['Low Drug'], $names('low'));
        $this->assertSame(['Ok Drug'], $names('in_stock'));
    }

    public function test_every_report_renders_and_money_is_numeric(): void
    {
        $user = $this->makeTenant();
        $drug = $this->makeDrug($user, ['selling_price' => 1000]);
        $this->makeBatch($drug, now()->addYear()->toDateString(), 20);
        $customer = $this->actingAs($user)->postJson('/api/customers', ['name' => 'Ada'])->json('data.id');
        foreach ([null, $customer, $customer] as $c) {
            $this->actingAs($user)->postJson('/api/sales', [
                'items' => [['drug_id' => $drug->id, 'quantity' => 1]], 'customer_id' => $c, 'payment_method' => 'card',
            ])->assertCreated();
        }

        $reports = [
            'sales?group=day', 'sales?group=drug', 'sales?group=category', 'sales?group=staff', 'sales?group=payment_method',
            'inventory?view=valuation', 'inventory?view=movement', 'inventory?view=dead_stock', 'inventory?view=expiry',
            'financial', 'customers',
        ];
        foreach ($reports as $report) {
            $res = $this->actingAs($user)->getJson("/api/reports/{$report}")->assertOk();
            foreach ($res->json('data.summary') as $key => $value) {
                if (! is_array($value)) {
                    $this->assertIsNotString($value, "{$report}: summary.{$key} must be numeric");
                }
            }
        }

        $customers = $this->actingAs($user)->getJson('/api/reports/customers')->json('data.summary');
        $this->assertSame(1, $customers['active_customers']);
        $this->assertSame(1, $customers['returning_customers']);
        $this->assertEquals(100, $customers['retention_rate']);

        $this->actingAs($user)->get('/api/reports/sales?format=csv')->assertOk();
    }

    public function test_purchase_order_receive_creates_batches_partially_then_fully(): void
    {
        $user = $this->makeTenant();
        $drug = $this->makeDrug($user);
        $supplier = $this->actingAs($user)->postJson('/api/suppliers', ['name' => 'Emzor'])->json('data.id');
        $po = $this->actingAs($user)->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier, 'items' => [['drug_id' => $drug->id, 'quantity_ordered' => 10, 'unit_cost' => 50]],
        ])->assertCreated()->assertJsonPath('data.total', 500)->json('data');

        $line = fn (int $qty, string $batch) => ['lines' => [[
            'item_id' => $po['items'][0]['id'], 'batch_number' => $batch,
            'expiry_date' => now()->addYear()->toDateString(), 'quantity' => $qty, 'unit_cost' => 50,
        ]]];

        $this->actingAs($user)->postJson("/api/purchase-orders/{$po['id']}/receive", $line(4, 'A1'))->assertJsonPath('data.status', 'partial');
        $this->actingAs($user)->postJson("/api/purchase-orders/{$po['id']}/receive", $line(6, 'A2'))->assertJsonPath('data.status', 'received');
        $this->actingAs($user)->postJson("/api/purchase-orders/{$po['id']}/receive", $line(1, 'A3'))->assertStatus(422);

        $this->actingAs($user)->getJson("/api/drugs/{$drug->id}")->assertJsonPath('data.stock_on_hand', 10);
        $this->assertDatabaseCount('stock_movements', 2);
    }

    public function test_role_matrix(): void
    {
        $owner = $this->makeTenant();
        $pharmacist = User::create(['tenant_id' => $owner->tenant_id, 'name' => 'P', 'email' => 'p@x.test', 'password' => 'password', 'role' => 'pharmacist']);
        $assistant = User::create(['tenant_id' => $owner->tenant_id, 'name' => 'A', 'email' => 'a@x.test', 'password' => 'password', 'role' => 'assistant']);

        $matrix = [
            // [method, path, owner, pharmacist, assistant]
            ['getJson', '/api/reports/sales', 200, 200, 403],
            ['getJson', '/api/purchase-orders', 200, 200, 403],
            ['getJson', '/api/suppliers', 200, 200, 403],
            ['getJson', '/api/settings/staff', 200, 403, 403],
            ['getJson', '/api/billing/subscription', 200, 403, 403],
            ['getJson', '/api/drugs', 200, 200, 200],
            ['getJson', '/api/customers', 200, 200, 200],
            ['getJson', '/api/dashboard', 200, 200, 200],
        ];

        foreach ($matrix as [$method, $path, $o, $p, $a]) {
            foreach ([[$owner, $o], [$pharmacist, $p], [$assistant, $a]] as [$user, $want]) {
                $this->actingAs($user)->{$method}($path)->assertStatus($want);
            }
        }
    }

    public function test_unpaid_tenant_is_read_only_not_locked_out(): void
    {
        $user = $this->makeTenant();
        $user->tenant->update(['status' => 'past_due']);

        $this->actingAs($user)->getJson('/api/drugs')->assertOk();
        $this->actingAs($user)->postJson('/api/drugs', ['name' => 'X', 'selling_price' => 1])
            ->assertStatus(402)->assertJsonPath('code', 'subscription_required');
        $this->actingAs($user)->getJson('/api/billing/subscription')->assertOk();
    }

    public function test_paystack_webhook_rejects_bad_signature(): void
    {
        config(['services.paystack.secret_key' => 'sk_test_x']);
        $body = json_encode(['event' => 'charge.success', 'data' => ['reference' => 'nope']]);

        $this->call('POST', '/api/webhooks/paystack', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_PAYSTACK_SIGNATURE' => 'bad'], $body)
            ->assertStatus(401);
        $this->call('POST', '/api/webhooks/paystack', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_PAYSTACK_SIGNATURE' => hash_hmac('sha512', $body, 'sk_test_x')], $body)
            ->assertOk();
    }
}
