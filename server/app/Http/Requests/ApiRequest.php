<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

abstract class ApiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * exists rule restricted to the caller's tenant — tenant_id is never
     * accepted from the client (spec §7).
     */
    protected function tenantExists(string $table, string $column = 'id'): Exists
    {
        return Rule::exists($table, $column)->where('tenant_id', $this->user()?->tenant_id);
    }
}
