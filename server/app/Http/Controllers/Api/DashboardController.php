<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request, DashboardService $dashboard): JsonResponse
    {
        $range = in_array($request->query('range'), DashboardService::RANGES, true) ? $request->query('range') : 'week';

        return response()->json(['data' => $dashboard->build($request->user()->tenant_id, $range)]);
    }
}
