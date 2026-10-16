<?php

use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureTenantWritable;
use App\Http\Middleware\SetTenantContext;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\InvalidSignatureException;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum stateful SPA cookie mode (spec §4.4).
        $middleware->statefulApi();

        $middleware->alias([
            'tenant' => SetTenantContext::class,
            'role' => EnsureRole::class,
            'writable' => EnsureTenantWritable::class,
        ]);

        // Tenant context must be set before route-model binding so a
        // foreign id resolves to 404, never 403 (FR-1.1).
        $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: SetTenantContext::class);

        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());

        // Never reveal model names in 404s.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') && $e->getPrevious() instanceof ModelNotFoundException) {
                return response()->json(['message' => 'Not found.'], 404);
            }
        });

        $exceptions->render(function (InvalidSignatureException $e) {
            return response('<h1 style="font-family:sans-serif">This receipt link has expired.</h1><p style="font-family:sans-serif">Ask the pharmacy to send a new one.</p>', 403);
        });

        $exceptions->dontFlash(['current_password', 'password', 'password_confirmation']);
    })->create();
