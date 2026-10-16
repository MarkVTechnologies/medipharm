<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StaffRequest extends ApiRequest
{
    public function rules(): array
    {
        $creating = $this->isMethod('post');
        $userId = $this->route('user')?->id;

        return [
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:120'],
            'email' => [
                $creating ? 'required' : 'sometimes', 'email', 'max:190',
                Rule::unique('users', 'email')->where('tenant_id', $this->user()->tenant_id)->ignore($userId),
            ],
            'role' => [$creating ? 'required' : 'sometimes', Rule::in(User::ROLES)],
            'password' => [$creating ? 'required' : 'sometimes', Password::min(8)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
