<?php

namespace App\Mail;

use App\Models\User;
use App\Services\PasswordResetService;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ResetPasswordMail extends Mailable
{
    public function __construct(public User $user, public string $url) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Reset your MediPharm password');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.reset-password', with: [
            'name' => $this->user->name,
            'pharmacy' => $this->user->tenant?->name,
            'url' => $this->url,
            'minutes' => PasswordResetService::TTL_MINUTES,
        ]);
    }
}
