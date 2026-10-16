<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $mysql = in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('contact_person')->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->string('payment_terms', 120)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['tenant_id', 'name']);
        });

        Schema::create('drugs', function (Blueprint $table) use ($mysql) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('generic_name')->nullable();
            $table->string('brand')->nullable();
            $table->string('nafdac_number', 64)->nullable();
            $table->string('category', 64)->nullable();
            $table->string('form', 32)->nullable();
            $table->string('strength', 64)->nullable();
            $table->string('pack_size', 64)->nullable();
            $table->string('barcode', 64)->nullable();
            $table->decimal('cost_price', 12, 2)->default(0);
            $table->decimal('selling_price', 12, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->nullable(); // null = tenant VAT default; 0 = exempt
            $table->unsignedInteger('reorder_level')->default(10);
            $table->foreignId('preferred_supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['tenant_id', 'barcode']);
            $table->index(['tenant_id', 'nafdac_number', 'pack_size']);
            $table->index(['tenant_id', 'category']);
            $table->index(['tenant_id', 'name']);
            if ($mysql) {
                $table->fullText(['name', 'generic_name', 'brand']);
            }
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained();
            $table->string('reference', 24);
            $table->string('status', 16)->default('draft'); // draft / sent / partial / received / cancelled
            $table->date('expected_date')->nullable();
            $table->decimal('total', 14, 2)->default(0);
            $table->string('notes', 500)->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('drug_id')->constrained();
            $table->unsignedInteger('quantity_ordered');
            $table->unsignedInteger('quantity_received')->default(0);
            $table->decimal('unit_cost', 12, 2)->default(0);
        });

        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('drug_id')->constrained()->cascadeOnDelete();
            $table->string('batch_number', 64);
            $table->date('expiry_date');
            $table->unsignedInteger('quantity_received');
            $table->unsignedInteger('quantity_remaining');
            $table->decimal('cost_price', 12, 2)->default(0);
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('expired_flagged_at')->nullable();
            $table->timestamp('written_off_at')->nullable();
            $table->timestamps();

            // The FEFO lookup path. Non-negotiable.
            $table->index(['tenant_id', 'drug_id', 'expiry_date']);
            $table->index(['tenant_id', 'expiry_date']);
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 16);
            $table->string('name');
            $table->string('phone', 32)->nullable();
            $table->string('email')->nullable();
            $table->string('tier', 16)->default('bronze');
            $table->unsignedInteger('visit_count')->default(0);
            $table->decimal('lifetime_spend', 14, 2)->default(0);
            $table->timestamp('last_visit_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'phone']);
            $table->index(['tenant_id', 'name']);
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 24);
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('discount', 14, 2)->default(0);
            $table->decimal('vat', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->string('payment_method', 16); // cash / card / transfer
            $table->decimal('amount_tendered', 14, 2)->nullable();
            $table->decimal('change_given', 14, 2)->default(0);
            $table->string('status', 16)->default('completed'); // completed / voided
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users');
            $table->string('void_reason')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'created_at']);
            $table->index(['tenant_id', 'customer_id']);
            $table->index(['tenant_id', 'user_id']);
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->foreignId('drug_id')->constrained();
            $table->foreignId('batch_id')->constrained(); // the traceability link — mandatory
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('unit_cost', 12, 2)->default(0); // batch cost at sale time, for COGS
            $table->decimal('line_total', 14, 2);
            $table->decimal('tax_amount', 14, 2)->default(0);

            $table->index(['drug_id', 'sale_id']);
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('drug_id')->constrained();
            $table->foreignId('batch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 20); // receipt / sale / adjustment / return / expiry_writeoff
            $table->integer('quantity');
            $table->string('reference_type', 32)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->foreignId('user_id')->nullable()->constrained();
            $table->string('note')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'created_at']);
            $table->index(['tenant_id', 'drug_id']);
            $table->index(['reference_type', 'reference_id']);
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('plan', 32);
            $table->string('status', 16)->default('trial'); // trial / active / past_due / cancelled
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('renews_at')->nullable();
            $table->string('paystack_customer_code')->nullable();
            $table->string('paystack_subscription_code')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->string('plan', 32)->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('reference', 64)->unique();
            $table->string('status', 16)->default('pending'); // pending / success / failed
            $table->timestamp('paid_at')->nullable();
            $table->json('raw_response')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        foreach (['payments', 'subscriptions', 'stock_movements', 'sale_items', 'sales', 'customers',
            'batches', 'purchase_order_items', 'purchase_orders', 'drugs', 'suppliers'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
