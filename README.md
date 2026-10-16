# MediPharm — Pharmacy Edition

Pharmacy management SaaS for Nigerian community pharmacies: batch-level inventory with expiry control (FEFO), keyboard-first point of sale, customers and loyalty tiers, suppliers and purchase orders, receipts (print / PDF / WhatsApp link), reports, and Paystack billing. Built to run on ordinary cPanel shared hosting with MySQL.

| Folder | What | Stack |
|---|---|---|
| `server/` | REST API | Laravel 12, PHP 8.2+, MySQL 8 / MariaDB, Sanctum (SPA cookie auth) |
| `client/` | Single-page app | React 19, Vite, TypeScript, Tailwind 4, SWR |

## Local development

Requirements: PHP 8.2+ with `pdo_mysql`, `mbstring`, `intl`, `gd`, `zip`; Composer; Node 22+; MySQL or MariaDB.

```bash
# API
cd server
composer install
cp .env.example .env        # then set APP_ENV=local, APP_URL, DB_*, SESSION_DOMAIN=null,
                            # SANCTUM_STATEFUL_DOMAINS=localhost:5180, FRONTEND_URL=http://localhost:5180
php artisan key:generate
php artisan migrate --seed  # demo pharmacy, logins below
php artisan storage:link    # serves uploaded logos
php artisan serve --port=8010

# SPA (proxies /api to 127.0.0.1:8010)
cd client
npm install
npm run dev -- --port 5180
```

Demo logins (password `password`): `owner@medipharm.test`, `pharmacist@medipharm.test`, `assistant@medipharm.test`.

Tests (SQLite in memory by default):

```bash
cd server && php artisan test
```

Also run them against MySQL/MariaDB before a release — some SQL differs between engines and SQLite won't catch it:

```bash
# once: CREATE DATABASE medipharm_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DB_CONNECTION=mysql DB_DATABASE=medipharm_test php artisan test
```

## Production (cPanel)

- API: `server/` lives outside `public_html`; point an `api.` subdomain's document root at `server/public`. Set `.env` from `.env.example`, run `php artisan migrate --force` and the config/route/view caches.
- SPA: copy `client/.env.production.example` to `.env.production`, `npm run build`, upload the contents of `client/dist/` (including `.htaccess`) into `public_html/`.
- Cron (one entry, every minute): `php /home/<user>/medipharm-api/artisan schedule:run`

## Key design rules

- Every tenant-owned model uses `BelongsToTenant`; a foreign record id returns 404, never 403.
- Stock lives in batches and is drawn first-expiry-first-out inside one atomic, row-locked checkout transaction.
- Money is `DECIMAL` in MySQL and a float at the API boundary, converted once in the API Resources.

© Mark V Technologies Limited
