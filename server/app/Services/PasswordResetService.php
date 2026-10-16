<?php

namespace App\Services;

use App\Mail\ResetPasswordMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Self-service password reset. Tokens are "{user_id}.{secret}"; only a
 * SHA-256 of the secret is stored, one live token per user, valid for
 * 60 minutes and single use. Because an email can belong to several
 * pharmacies, each matching account gets its own link.
 */
class PasswordResetService
{
    public const TTL_MINUTES = 60;

    public function sendLinks(string $email): void
    {
        $users = User::withoutGlobalScopes()
            ->with('tenant:id,name')
            ->where('email', Str::lower($email))
            ->where('is_active', true)
            ->get();

        foreach ($users as $user) {
            $secret = Str::random(48);
            DB::table('password_resets')->updateOrInsert(
                ['user_id' => $user->id],
                ['token_hash' => hash('sha256', $secret), 'created_at' => now()],
            );

            $url = rtrim(config('app.frontend_url'), '/').'/reset-password?token='.$user->id.'.'.$secret;

            try {
                Mail::to($user->email)->send(new ResetPasswordMail($user, $url));
            } catch (\Throwable $e) {
                // Never reveal delivery problems to the requester; log for the operator.
                Log::error('Password reset email failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            }
        }
    }

    public function reset(string $token, string $password): User
    {
        $invalid = ValidationException::withMessages(['token' => ['This reset link is invalid or has expired. Request a new one.']]);

        if (! preg_match('/^(\d+)\.([A-Za-z0-9]{48})$/', $token, $m)) {
            throw $invalid;
        }
        [, $userId, $secret] = $m;

        return DB::transaction(function () use ($userId, $secret, $password, $invalid) {
            $row = DB::table('password_resets')->where('user_id', $userId)->lockForUpdate()->first();

            if (! $row
                || ! hash_equals($row->token_hash, hash('sha256', $secret))
                || now()->subMinutes(self::TTL_MINUTES)->gt($row->created_at)) {
                throw $invalid;
            }

            $user = User::withoutGlobalScopes()->where('is_active', true)->find($userId) ?? throw $invalid;
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();

            // Single use, and sign out every other session for this account.
            DB::table('password_resets')->where('user_id', $userId)->delete();
            DB::table('sessions')->where('user_id', $userId)->delete();

            return $user;
        });
    }
}
