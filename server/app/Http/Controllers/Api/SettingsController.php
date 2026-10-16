<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StaffRequest;
use App\Http\Requests\TenantSettingsRequest;
use App\Http\Resources\TenantResource;
use App\Http\Resources\UserResource;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class SettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(['data' => [
            'tenant' => (new TenantResource($user->tenant))->resolve(),
            'user' => (new UserResource($user))->resolve(),
        ]]);
    }

    public function updateTenant(TenantSettingsRequest $request): TenantResource
    {
        $tenant = $request->user()->tenant;
        $data = collect($request->validated())->except(['logo', 'tiers'])->all();

        if ($request->hasFile('logo')) {
            if ($tenant->logo_path) {
                Storage::disk('public')->delete($tenant->logo_path);
            }
            $data['logo_path'] = $request->file('logo')->store("logos/{$tenant->id}", 'public');
        }

        if ($request->has('tiers')) {
            $tiers = collect($request->input('tiers'))->sortBy('min_spend')->values();
            $data['tier_config'] = $tiers->mapWithKeys(fn ($t) => [$t['tier'] => [
                'min_spend' => (float) $t['min_spend'],
                'discount' => (float) $t['discount'],
            ]])->all();
        }

        $tenant->update($data);

        // Re-tier customers when thresholds change.
        if (isset($data['tier_config'])) {
            Customer::query()->select(['id', 'lifetime_spend', 'tier'])->chunkById(500, function ($customers) use ($tenant) {
                foreach ($customers as $customer) {
                    $tier = $tenant->tierFor((float) $customer->lifetime_spend);
                    if ($tier !== $customer->tier) {
                        $customer->update(['tier' => $tier]);
                    }
                }
            });
        }

        return new TenantResource($tenant->refresh());
    }

    public function updateAccount(Request $request): UserResource
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:190', Rule::unique('users', 'email')->where('tenant_id', $user->tenant_id)->ignore($user->id)],
            'current_password' => ['required_with:password', 'string'],
            'password' => ['sometimes', 'confirmed', Password::min(8)],
        ]);

        if (isset($data['password']) && ! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => ['Your current password is incorrect.']]);
        }

        if (isset($data['email'])) {
            $data['email'] = Str::lower($data['email']);
        }

        $user->update(collect($data)->except('current_password')->all());

        return new UserResource($user);
    }

    public function staff(): JsonResponse
    {
        $staff = User::query()->orderByRaw("CASE role WHEN 'owner' THEN 0 WHEN 'pharmacist' THEN 1 ELSE 2 END")->orderBy('name')->get();

        return response()->json(['data' => UserResource::collection($staff)->resolve()]);
    }

    public function storeStaff(StaffRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['email'] = Str::lower($data['email']);

        $seatLimit = config('medipharm.plans.'.$request->user()->tenant->plan.'.seats');
        if ($seatLimit && User::query()->where('is_active', true)->count() >= $seatLimit) {
            throw ValidationException::withMessages(['email' => ["Your plan includes {$seatLimit} staff seats. Upgrade in Billing to add more."]]);
        }

        $user = User::create($data + ['is_active' => true]);

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function updateStaff(StaffRequest $request, User $user): UserResource
    {
        $data = $request->validated();

        if ($user->id === $request->user()->id && (($data['is_active'] ?? true) === false || ($data['role'] ?? 'owner') !== 'owner')) {
            throw ValidationException::withMessages(['role' => ['You cannot demote or deactivate yourself.']]);
        }

        if (isset($data['email'])) {
            $data['email'] = Str::lower($data['email']);
        }

        $user->update($data);

        // A password set by the owner (or a deactivation) ends every session
        // that account has, and voids any pending email reset link.
        if (isset($data['password']) || ($data['is_active'] ?? true) === false) {
            $user->forceFill(['remember_token' => Str::random(60)])->saveQuietly();
            DB::table('sessions')->where('user_id', $user->id)->delete();
            DB::table('password_resets')->where('user_id', $user->id)->delete();
        }

        return new UserResource($user);
    }
}
