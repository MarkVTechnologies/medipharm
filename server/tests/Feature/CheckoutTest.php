<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\StockMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    /**
     * FR-2.3 acceptance: batch A (soonest, qty 4) and batch B (qty 20) —
     * selling 10 consumes all 4 of A then 6 of B, with a movement row each.
     */
    public function test_fefo_consumes_earliest_expiry_first(): void
    {
        $user = $this->makeTenant();
        $drug = $this->makeDrug($user);
        $b = $this->makeBatch($drug, now()->addMonths(9)->toDateString(), 20, 'B');
        $a = $this->makeBatch($drug, now()->addMonths(2)->toDateString(), 4, 'A');

        $this->actingAs($user)->postJson('/api/sales', [
            'items' => [['drug_id' => $drug->id, 'quantity' => 10]],
            'payment_method' => 'card',
        ])->assertCreated();

        $this->assertSame(0, Batch::withoutGlobalScopes()->find($a->id)->quantity_remaining);
        $this->assertSame(14, Batch::withoutGlobalScopes()->find($b->id)->quantity_remaining);

        $movements = StockMovement::withoutGlobalScopes()->where('type', 'sale')->orderBy('id')->get();
        $this->assertCount(2, $movements);
        $this->assertSame([$a->id, $b->id], $movements->pluck('batch_id')->all());
        $this->assertSame([-4, -6], $movements->pluck('quantity')->all());
    }

    public function test_expired_batches_are_not_sellable(): void
    {
        $user = $this->makeTenant();
        $drug = $this->makeDrug($user);
        $this->makeBatch($drug, now()->subDay()->toDateString(), 50);

        $this->actingAs($user)->postJson('/api/sales', [
            'items' => [['drug_id' => $drug->id, 'quantity' => 1]],
            'payment_method' => 'card',
        ])->assertStatus(422);
    }

    public function test_cannot_oversell_and_failed_sale_leaves_no_trace(): void
    {
        $user = $this->makeTenant();
        $drug = $this->makeDrug($user);
        $batch = $this->makeBatch($drug, now()->addYear()->toDateString(), 1);

        $this->actingAs($user)->postJson('/api/sales', [
            'items' => [['drug_id' => $drug->id, 'quantity' => 1]], 'payment_method' => 'transfer',
        ])->assertCreated();

        $this->actingAs($user)->postJson('/api/sales', [
            'items' => [['drug_id' => $drug->id, 'quantity' => 1]], 'payment_method' => 'transfer',
        ])->assertStatus(422)->assertJsonFragment(['available' => 0]);

        $this->assertSame(0, Batch::withoutGlobalScopes()->find($batch->id)->quantity_remaining);
        $this->assertDatabaseCount('sales', 1);
    }

    public function test_totals_are_server_computed_and_money_is_numeric(): void
    {
        $user = $this->makeTenant();
        $drug = $this->makeDrug($user, ['selling_price' => 1200]);
        $this->makeBatch($drug, now()->addYear()->toDateString(), 10);

        $response = $this->actingAs($user)->postJson('/api/sales', [
            'items' => [['drug_id' => $drug->id, 'quantity' => 3]],
            'payment_method' => 'cash',
            'amount_tendered' => 5000,
            'total' => 1, // ignored
        ])->assertCreated();

        // 3 × 1200 = 3600; VAT 7.5% = 270; total 3870; change 1130.
        $response->assertJsonPath('data.subtotal', 3600)
            ->assertJsonPath('data.vat', 270)
            ->assertJsonPath('data.total', 3870)
            ->assertJsonPath('data.change_given', 1130);

        foreach (['subtotal', 'discount', 'vat', 'total', 'change_given'] as $field) {
            $this->assertIsNumeric($response->json("data.{$field}"));
            $this->assertIsNotString($response->json("data.{$field}"), "{$field} must not be a DECIMAL string");
        }
    }

    public function test_insufficient_cash_is_rejected_atomically(): void
    {
        $user = $this->makeTenant();
        $drug = $this->makeDrug($user, ['selling_price' => 1000]);
        $batch = $this->makeBatch($drug, now()->addYear()->toDateString(), 5);

        $this->actingAs($user)->postJson('/api/sales', [
            'items' => [['drug_id' => $drug->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'amount_tendered' => 500,
        ])->assertStatus(422)->assertJsonValidationErrors('amount_tendered');

        $this->assertSame(5, Batch::withoutGlobalScopes()->find($batch->id)->quantity_remaining);
        $this->assertDatabaseCount('sales', 0);
        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_void_restores_stock_to_originating_batches(): void
    {
        $user = $this->makeTenant();
        $drug = $this->makeDrug($user);
        $batch = $this->makeBatch($drug, now()->addYear()->toDateString(), 10);

        $saleId = $this->actingAs($user)->postJson('/api/sales', [
            'items' => [['drug_id' => $drug->id, 'quantity' => 4]], 'payment_method' => 'card',
        ])->json('data.id');

        $this->actingAs($user)->postJson("/api/sales/{$saleId}/void", ['reason' => 'Wrong item'])
            ->assertOk()->assertJsonPath('data.status', 'voided');

        $this->assertSame(10, Batch::withoutGlobalScopes()->find($batch->id)->quantity_remaining);
        $this->actingAs($user)->postJson("/api/sales/{$saleId}/void", ['reason' => 'again'])->assertStatus(422);
    }
}
