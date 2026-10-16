<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Runs after authentication and BEFORE route-model binding, so that a
 * Tenant B id requested by Tenant A resolves to 404, never 403 (FR-1.1).
 */
class SetTenantContext
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
            }

            return response()->json(['message' => 'Your account has been deactivated.'], 401);
        }

        $this->context->set($user?->tenant_id);

        return $next($request);
    }
}
