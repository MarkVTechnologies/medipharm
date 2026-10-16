<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use App\Services\OnboardingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request, DashboardService $dashboard, OnboardingService $onboarding): JsonResponse
    {
        $range = in_array($request->query('range'), DashboardService::RANGES, true) ? $request->query('range') : 'week';
        $user = $request->user();

        $data = $dashboard->build($user->tenant_id, $range);

        // Fresh, not cached: ticks must appear as soon as a step is done.
        // Owners only — they're the ones setting the pharmacy up.
        $data['onboarding'] = $user->isOwner() ? $onboarding->forTenant($user->tenant) : null;

        return response()->json(['data' => $data]);
    }

    public function dismissOnboarding(Request $request): JsonResponse
    {
        $request->user()->tenant->update(['onboarding_dismissed_at' => now()]);

        return response()->json(null, 204);
    }
}
