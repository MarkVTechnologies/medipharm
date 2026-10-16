<x-mail::message>
# Reset your password

Hello {{ $name }},

Someone (hopefully you) asked to reset the password for your MediPharm account at **{{ $pharmacy }}**.

<x-mail::button :url="$url">
Choose a new password
</x-mail::button>

This link works once and expires in {{ $minutes }} minutes. If you didn't ask for this, you can ignore this email — your password won't change.

MediPharm
</x-mail::message>
