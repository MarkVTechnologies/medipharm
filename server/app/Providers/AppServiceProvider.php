<?php

namespace App\Providers;

use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // One tenant context per request / console run.
        $this->app->scoped(TenantContext::class);
    }

    public function boot(): void
    {
        // Surface mass-assignment mistakes during development.
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());
    }
}
