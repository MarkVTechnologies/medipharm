<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\TenantResource;
use App\Http\Resources\UserResource;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Tenant and owner are created in one transaction — a failure leaves no orphan tenant (FR-1.2).
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = DB::transaction(function () use ($data) {
            $tenant = Tenant::create([
                'name' => $data['pharmacy_name'],
                'slug' => $this->uniqueSlug($data['pharmacy_name']),
                'phone' => $data['phone'] ?? null,
                'address' => $data['address'] ?? null,
                'email' => $data['email'],
                'vat_rate' => 7.50,
                'currency' => 'NGN',
                'receipt_footer' => 'Thank you for your patronage. Get well soon!',
                'status' => 'trial',
                'trial_ends_at' => now()->addDays(config('medipharm.trial_days')),
            ]);

            Subscription::create([
                'tenant_id' => $tenant->id,
                'plan' => 'starter',
                'status' => 'trial',
                'starts_at' => now(),
                'renews_at' => $tenant->trial_ends_at,
            ]);

            return User::create([
                'tenant_id' => $tenant->id,
                'name' => $data['name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'role' => 'owner',
                'last_login_at' => now(),
            ]);
        });

        Auth::guard('web')->login($user, true);
        $this->regenerate($request);

        return $this->session($user, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'pharmacy' => ['nullable', 'string', 'max:190'],
        ]);

        $email = Str::lower($data['email']);
        $throttleKey = 'login:'.$email.'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            throw ValidationException::withMessages([
                'email' => ['Too many attempts. Try again in '.RateLimiter::availableIn($throttleKey).' seconds.'],
            ])->status(429);
        }

        // Emails are unique per pharmacy, not globally (spec §6.2).
        $candidates = User::query()
            ->with('tenant:id,slug,name')
            ->where('email', $email)
            ->when($data['pharmacy'] ?? null, fn ($q, $slug) => $q->whereHas('tenant', fn ($t) => $t->where('slug', $slug)))
            ->get()
            ->filter(fn (User $u) => Hash::check($data['password'], $u->password))
            ->values();

        if ($candidates->isEmpty()) {
            RateLimiter::hit($throttleKey, 60);
            throw ValidationException::withMessages(['email' => ['These credentials do not match our records.']]);
        }

        if ($candidates->count() > 1) {
            return response()->json([
                'message' => 'This email belongs to more than one pharmacy. Choose which one to sign in to.',
                'errors' => ['pharmacy' => ['Choose a pharmacy.']],
                'pharmacies' => $candidates->map(fn (User $u) => ['slug' => $u->tenant->slug, 'name' => $u->tenant->name]),
            ], 422);
        }

        /** @var User $user */
        $user = $candidates->first();
        if (! $user->is_active) {
            throw ValidationException::withMessages(['email' => ['This account has been deactivated. Ask the pharmacy owner.']]);
        }

        RateLimiter::clear($throttleKey);
        Auth::guard('web')->login($user, $request->boolean('remember', true));
        $this->regenerate($request);
        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        return $this->session($user);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        return $this->session($request->user());
    }

    private function session(User $user, int $status = 200): JsonResponse
    {
        app(TenantContext::class)->set($user->tenant_id);
        $tenant = $user->tenant()->first();

        return response()->json([
            'data' => [
                'user' => (new UserResource($user))->resolve(),
                'tenant' => (new TenantResource($tenant))->resolve(),
            ],
        ], $status);
    }

    /**
     * New session id on login (fixation protection). Only stateful (SPA)
     * requests carry a session.
     */
    private function regenerate(Request $request): void
    {
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'pharmacy';
        $slug = $base;
        while (Tenant::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.Str::lower(Str::random(4));
        }

        return $slug;
    }
}
