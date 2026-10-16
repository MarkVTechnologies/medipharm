<?php

namespace App\Models\Concerns;

use App\Models\Tenant;
use App\Scopes\TenantScope;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Every tenant-owned model MUST use this trait. A model that forgets it
 * is a cross-tenant data leak — see tests/Feature/TenancyTest.php.
 */
trait BelongsToTenant
{
    protected static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope());

        static::creating(function ($model) {
            $model->tenant_id ??= app(TenantContext::class)->id() ?? auth()->user()?->tenant_id;
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
