<?php

return [

    /*
    | Trial length for new pharmacies, in days (spec §11.1: 14–30).
    */
    'trial_days' => (int) env('MEDIPHARM_TRIAL_DAYS', 30),

    /*
    | Days after renews_at before a tenant becomes read-only.
    */
    'grace_days' => (int) env('MEDIPHARM_GRACE_DAYS', 5),

    /*
    | Monthly plans, NGN. Pricing is still to be validated in the pilot.
    */
    'plans' => [
        'starter' => ['name' => 'Starter', 'price' => 15000, 'seats' => 3, 'skus' => 1500],
        'growth' => ['name' => 'Growth', 'price' => 30000, 'seats' => 8, 'skus' => 5000],
        'pro' => ['name' => 'Pro', 'price' => 50000, 'seats' => 25, 'skus' => null],
    ],

    /*
    | Receipts shared to WhatsApp use a signed URL with this lifetime (FR-7.5).
    */
    'receipt_link_days' => 30,

    /*
    | Nightly mysqldump target — must be outside public_html.
    */
    'backup_path' => env('MEDIPHARM_BACKUP_PATH', storage_path('app/backups')),
    'backup_retention_days' => 14,
];
