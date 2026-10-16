<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Laravel's default table is keyed by email, but emails are only unique
        // per tenant here. Reset tokens are keyed by user instead.
        Schema::dropIfExists('password_reset_tokens');

        Schema::create('password_resets', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64);
            $table->timestamp('created_at');
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->timestamp('onboarding_dismissed_at')->nullable()->after('trial_ends_at');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', fn (Blueprint $table) => $table->dropColumn('onboarding_dismissed_at'));
        Schema::dropIfExists('password_resets');

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }
};
