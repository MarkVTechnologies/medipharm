<?php

use App\Http\Controllers\Api\ReceiptController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => is_file(public_path('index.html'))
    ? response()->file(public_path('index.html'), ['Cache-Control' => 'no-cache'])
    : response()->json(['name' => config('app.name'), 'status' => 'ok']));

// Public, signed, 30-day receipt link for WhatsApp sharing (FR-7.5).
Route::get('/r/{sale}', [ReceiptController::class, 'shared'])
    ->whereNumber('sale')
    ->middleware(['signed', 'throttle:60,1'])
    ->name('receipts.shared');

// Single-container deploys (e.g. the Render demo) ship the built SPA inside
// public/. Apache serves its files directly; any other page path lands here
// and gets the SPA shell so client-side routes like /inventory work on reload.
// API paths keep their JSON 404s. On cPanel the SPA lives in public_html and
// this never triggers.
Route::fallback(function () {
    $spa = public_path('index.html');

    abort_if(request()->is('api/*') || ! request()->isMethod('GET') || ! is_file($spa), 404);

    return response()->file($spa, ['Cache-Control' => 'no-cache']);
});
