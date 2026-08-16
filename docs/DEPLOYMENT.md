# Production deployment and operations

## Release layout

```text
stf-group-erp/
├── backend/                 Laravel application
│   ├── public/              Web document root + built React SPA
│   ├── storage/app/private  Protected uploaded documents
│   └── vendor/              Production dependencies included
├── frontend/                React/Vite source and reproducible lockfile
├── database/                Complete fresh-install SQL
└── docs/
```

Only `backend/public` may be exposed by the web server.

## Install choices

Use exactly one database installation path.

### A. phpMyAdmin / SQL

Import `database/TRUST-GROUP-ERP-COMPLETE-FRESH-INSTALL.sql` into a new empty
database. Do not run the seeder after this import.

### B. Artisan migration

```bash
cd backend
php artisan migrate --force
php artisan db:seed --force
```

Never run `migrate:fresh` on a production database with real data.

## Production cache

After every `.env` or release change:

```bash
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

After replacing application code:

```bash
php artisan migrate --force
php artisan queue:restart
```

## Queue

The database queue is required for expiry notifications. A long-running worker:

```bash
php artisan queue:work database --sleep=3 --tries=3 --backoff=60 --timeout=120
```

Use Supervisor/systemd in production. The Settings → Queue & Scheduler screen
shows pending, reserved and failed counts and allows an authorized retry.

## Scheduler

The host cron must invoke Laravel once per minute:

```cron
* * * * * cd /absolute/path/to/backend && /usr/bin/php artisan schedule:run >> /dev/null 2>&1
```

Laravel performs the actual expiry scan at 09:00 `Asia/Qatar`, with overlap and
duplicate protection.

## Notification providers

Safe mock mode is enabled on a fresh install. Configure secrets in `.env`, never
in the database or frontend source:

- SMTP: standard `MAIL_*` Laravel variables
- SMS: `SMS_API_URL`, `SMS_API_TOKEN`, `SMS_SENDER_ID`
- WhatsApp Cloud API: `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`

Use Templates → Test, verify delivery, then disable mock mode in Settings.

## Backup

Back up both:

1. the MySQL database;
2. `backend/storage/app/private`.

Keep `.env` and backups outside the public document root. Restore the database
and private files together so stored file metadata stays consistent.

## Updating the frontend

On a build machine:

```bash
cd frontend
npm ci
npm run lint
npm run build:deploy
```

Commit/upload the regenerated `backend/public/index.html`,
`backend/public/assets/` and `backend/public/.frontend-build.json`.

## Health and diagnostics

- `GET /up` — Laravel health endpoint
- Settings → Queue & Scheduler — queue and failed jobs
- Audit Log — authenticated business/security events
- `backend/storage/logs/laravel.log` — server errors; keep it private

For safe maintenance:

```bash
php artisan down --secret="temporary-maintenance-key"
php artisan migrate --force
php artisan optimize
php artisan queue:restart
php artisan up
```
