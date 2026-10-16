<?php

namespace App\Http\Resources;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Success envelope for lists: { data: [...], meta: { page, per_page, total, last_page } }.
 */
final class Paginated
{
    /**
     * @param  class-string<BaseResource>  $resource
     */
    public static function response(LengthAwarePaginator $paginator, string $resource, array $extraMeta = []): JsonResponse
    {
        return response()->json([
            'data' => $resource::collection($paginator->getCollection())->resolve(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ] + $extraMeta,
        ]);
    }

    /**
     * per_page defaults to 25, maximum 100 (spec §7.3).
     */
    public static function perPage(Request $request): int
    {
        return max(1, min(100, (int) $request->query('per_page', 25)));
    }
}
