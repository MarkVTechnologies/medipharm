<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PasswordResetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    public function __construct(private readonly PasswordResetService $resets) {}

    /**
     * Always the same reply, whether or not the email exists, so this
     * endpoint can't be used to discover accounts.
     */
    public function forgot(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);
        $key = 'forgot:'.Str::lower($data['email']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 3)) {
            throw ValidationException::withMessages([
                'email' => ['Too many requests. Try again in '.RateLimiter::availableIn($key).' seconds.'],
            ])->status(429);
        }
        RateLimiter::hit($key, 600);

        $this->resets->sendLinks($data['email']);

        return response()->json([
            'message' => 'If that email belongs to a MediPharm account, a reset link is on its way. Check your inbox (and spam).',
        ]);
    }

    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:128'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $this->resets->reset($data['token'], $data['password']);

        return response()->json(['message' => 'Password changed. Sign in with your new password.']);
    }
}
