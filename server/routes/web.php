<?php

use App\Http\Controllers\Api\ReceiptController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['name' => config('app.name'), 'status' => 'ok']));

// Public, signed, 30-day receipt link for WhatsApp sharing (FR-7.5).
Route::get('/r/{sale}', [ReceiptController::class, 'shared'])
    ->whereNumber('sale')
    ->middleware(['signed', 'throttle:60,1'])
    ->name('receipts.shared');
