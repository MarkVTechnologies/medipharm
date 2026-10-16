<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\User */
class UserResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'is_active' => $this->is_active,
            'last_login_at' => $this->date($this->last_login_at),
            'created_at' => $this->date($this->created_at),
        ];
    }
}
