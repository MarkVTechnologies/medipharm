<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Non-payment means read-only with data retained — never deletion or
 * lockout (FR-9.5). Reads always pass; writes return 402.
 */
class EnsureTenantWritable
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethodSafe()) {
            return $next($request);
        }

        $tenant = $request->user()?->tenant;
        if ($tenant && $tenant->isReadOnly()) {
            return response()->json([
                'message' => 'Your subscription has lapsed. Your records are safe and readable — renew in Settings → Billing to make changes.',
                'code' => 'subscription_required',
            ], 402);
        }

        return $next($request);
    }
}
