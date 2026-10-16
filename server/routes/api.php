<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DrugController;
use App\Http\Controllers\Api\DrugImportController;
use App\Http\Controllers\Api\PaystackWebhookController;
use App\Http\Controllers\Api\PosController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\ReceiptController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SupplierController;
use Illuminate\Support\Facades\Route;

/*
| tenant_id is never accepted from the client — it is derived from the
| authenticated user on every request (spec §7). The `tenant` middleware
| MUST sit in every authenticated group: it is what scopes route-model
| binding so a foreign id is a 404.
*/

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/login', [AuthController::class, 'login']);
Route::post('/webhooks/paystack', PaystackWebhookController::class);

Route::middleware(['auth:sanctum', 'tenant'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Billing and own account stay usable while read-only (FR-9.5).
    Route::get('/settings', [SettingsController::class, 'show']);
    Route::patch('/settings/account', [SettingsController::class, 'updateAccount']);

    Route::middleware('role:owner')->group(function () {
        Route::get('/billing/subscription', [BillingController::class, 'subscription']);
        Route::post('/billing/initialize', [BillingController::class, 'initialize']);
        Route::post('/billing/verify', [BillingController::class, 'verify']);
    });

    Route::middleware('writable')->group(function () {
        // ── Everyone: sell, look up, manage customers ──────────────────
        Route::get('/dashboard', DashboardController::class);

        Route::get('/drugs', [DrugController::class, 'index']);
        Route::get('/drugs/import/template', [DrugImportController::class, 'template']);
        Route::get('/drugs/{drug}', [DrugController::class, 'show']);
        Route::get('/drugs/{drug}/batches', [DrugController::class, 'batches']);

        Route::get('/pos/search', [PosController::class, 'search']);
        Route::post('/sales', [SaleController::class, 'store']);
        Route::get('/sales', [SaleController::class, 'index']);
        Route::get('/sales/{sale}', [SaleController::class, 'show']);
        Route::get('/sales/{sale}/receipt', [ReceiptController::class, 'show']);
        Route::get('/receipts/{reference}', [ReceiptController::class, 'byReference']);

        Route::get('/customers', [CustomerController::class, 'index']);
        Route::post('/customers', [CustomerController::class, 'store']);
        Route::get('/customers/{customer}', [CustomerController::class, 'show']);
        Route::patch('/customers/{customer}', [CustomerController::class, 'update']);

        // ── Owner + pharmacist ──────────────────────────────────────────
        Route::middleware('role:owner,pharmacist')->group(function () {
            Route::post('/drugs/import', DrugImportController::class);
            Route::post('/drugs', [DrugController::class, 'store']);
            Route::patch('/drugs/{drug}', [DrugController::class, 'update']);
            Route::delete('/drugs/{drug}', [DrugController::class, 'destroy']);
            Route::post('/drugs/{drug}/batches', [DrugController::class, 'storeBatch']);
            Route::post('/batches/{batch}/adjust', [DrugController::class, 'adjustBatch']);
            Route::post('/batches/{batch}/write-off', [DrugController::class, 'writeOffBatch']);

            Route::post('/sales/{sale}/void', [SaleController::class, 'void']);

            Route::get('/suppliers', [SupplierController::class, 'index']);
            Route::post('/suppliers', [SupplierController::class, 'store']);
            Route::get('/suppliers/{supplier}', [SupplierController::class, 'show']);
            Route::patch('/suppliers/{supplier}', [SupplierController::class, 'update']);

            Route::get('/purchase-orders/suggestions', [PurchaseOrderController::class, 'suggestions']);
            Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
            Route::post('/purchase-orders', [PurchaseOrderController::class, 'store']);
            Route::get('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show']);
            Route::patch('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update']);
            Route::post('/purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive']);

            Route::get('/reports/sales', [ReportController::class, 'sales']);
            Route::get('/reports/inventory', [ReportController::class, 'inventory']);
            Route::get('/reports/financial', [ReportController::class, 'financial']);
            Route::get('/reports/customers', [ReportController::class, 'customers']);
        });

        // ── Owner only ──────────────────────────────────────────────────
        Route::middleware('role:owner')->group(function () {
            Route::patch('/settings/tenant', [SettingsController::class, 'updateTenant']);
            Route::post('/settings/tenant', [SettingsController::class, 'updateTenant']); // multipart (logo upload)
            Route::get('/settings/staff', [SettingsController::class, 'staff']);
            Route::post('/settings/staff', [SettingsController::class, 'storeStaff']);
            Route::patch('/settings/staff/{user}', [SettingsController::class, 'updateStaff']);
        });
    });
});
