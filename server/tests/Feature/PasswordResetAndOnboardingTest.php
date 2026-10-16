<?php

namespace Tests\Feature;

use App\Mail\ResetPasswordMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class PasswordResetAndOnboardingTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFrom(ResetPasswordMail $mail): string
    {
        parse_str(parse_url($mail->url, PHP_URL_QUERY), $q);

        return $q['token'];
    }

    public function test_reset_flow_works_once_and_signs_out_other_sessions(): void
    {
        Mail::fake();
        $user = $this->makeTenant();
        DB::table('sessions')->insert(['id' => 'abc', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);

        $this->postJson('/api/forgot-password', ['email' => $user->email])->assertOk();

        $sent = null;
        Mail::assertSent(ResetPasswordMail::class, function ($m) use (&$sent, $user) {
            $sent = $m;

            return $m->hasTo($user->email);
        });
        $token = $this->tokenFrom($sent);
        $this->assertStringStartsWith($user->id.'.', $token);
        $this->assertDatabaseMissing('password_resets', ['token_hash' => explode('.', $token)[1]]); // stored hashed

        $this->postJson('/api/reset-password', ['token' => $token, 'password' => 'brand-new-pass', 'password_confirmation' => 'brand-new-pass'])->assertOk();

        $this->assertTrue(Hash::check('brand-new-pass', $user->fresh()->password));
        $this->assertDatabaseMissing('sessions', ['user_id' => $user->id]);

        // Single use.
        $this->postJson('/api/reset-password', ['token' => $token, 'password' => 'another-pass1', 'password_confirmation' => 'another-pass1'])
            ->assertStatus(422)->assertJsonValidationErrors('token');
    }

    public function test_unknown_email_gets_the_same_reply_and_no_mail(): void
    {
        Mail::fake();
        $this->makeTenant();

        $known = $this->postJson('/api/forgot-password', ['email' => 'owner@test-pharmacy.test'])->json('message');
        $unknown = $this->postJson('/api/forgot-password', ['email' => 'nobody@nowhere.test'])->assertOk()->json('message');

        $this->assertSame($known, $unknown);
        Mail::assertSentCount(1);
    }

    public function test_expired_and_tampered_tokens_are_rejected(): void
    {
        Mail::fake();
        $user = $this->makeTenant();
        $this->postJson('/api/forgot-password', ['email' => $user->email]);
        $token = null;
        Mail::assertSent(ResetPasswordMail::class, function ($m) use (&$token) {
            $token = $this->tokenFrom($m);

            return true;
        });

        $body = fn ($t) => ['token' => $t, 'password' => 'brand-new-pass', 'password_confirmation' => 'brand-new-pass'];
        $this->postJson('/api/reset-password', $body(substr($token, 0, -1).'X'))->assertStatus(422);
        $this->postJson('/api/reset-password', $body('999.'.explode('.', $token)[1]))->assertStatus(422);

        DB::table('password_resets')->update(['created_at' => now()->subMinutes(61)]);
        $this->postJson('/api/reset-password', $body($token))->assertStatus(422);
    }

    public function test_same_email_in_two_pharmacies_gets_two_independent_links(): void
    {
        Mail::fake();
        $a = $this->makeTenant('Alpha');
        $b = $this->makeTenant('Bravo');
        $b->update(['email' => $a->email]);

        $this->postJson('/api/forgot-password', ['email' => $a->email])->assertOk();
        Mail::assertSent(ResetPasswordMail::class, 2);
        $this->assertDatabaseCount('password_resets', 2);
    }

    public function test_owner_can_set_staff_password_which_signs_them_out(): void
    {
        $owner = $this->makeTenant();
        $staff = User::create(['tenant_id' => $owner->tenant_id, 'name' => 'A', 'email' => 'a@x.test', 'password' => 'password', 'role' => 'assistant']);
        DB::table('sessions')->insert(['id' => 'staff-sess', 'user_id' => $staff->id, 'payload' => '', 'last_activity' => time()]);

        $this->actingAs($owner)->patchJson("/api/settings/staff/{$staff->id}", ['password' => 'temp-pass-123'])->assertOk();

        $this->assertTrue(Hash::check('temp-pass-123', $staff->fresh()->password));
        $this->assertDatabaseMissing('sessions', ['user_id' => $staff->id]);
        $this->actingAs($staff)->patchJson("/api/settings/staff/{$owner->id}", ['password' => 'hijack-123'])->assertForbidden();
    }

    public function test_onboarding_checklist_tracks_progress_and_can_be_dismissed(): void
    {
        $owner = $this->makeTenant();
        $steps = fn () => collect($this->actingAs($owner)->getJson('/api/dashboard')->assertOk()->json('data.onboarding.steps'))->pluck('done', 'key');

        $this->assertSame(['profile' => false, 'catalogue' => false, 'stock' => false, 'team' => false, 'first_sale' => false], $steps()->all());

        $drug = $this->makeDrug($owner);
        $this->makeBatch($drug, now()->addYear()->toDateString(), 5);
        $this->actingAs($owner)->postJson('/api/sales', ['items' => [['drug_id' => $drug->id, 'quantity' => 1]], 'payment_method' => 'card']);

        $this->assertSame(['profile' => false, 'catalogue' => true, 'stock' => true, 'team' => false, 'first_sale' => true], $steps()->all());

        // Assistants never see it.
        $assistant = User::create(['tenant_id' => $owner->tenant_id, 'name' => 'A', 'email' => 'a@x.test', 'password' => 'password', 'role' => 'assistant']);
        $this->actingAs($assistant)->getJson('/api/dashboard')->assertJsonPath('data.onboarding', null);
        $this->actingAs($assistant)->postJson('/api/onboarding/dismiss')->assertForbidden();

        $this->actingAs($owner)->postJson('/api/onboarding/dismiss')->assertNoContent();
        $this->actingAs($owner)->getJson('/api/dashboard')->assertJsonPath('data.onboarding', null);
    }
}
