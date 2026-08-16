# Release verification

Release date: 2026-07-26

## Webuzo package checks

- Laravel `GET /up` route resolved with HTTP 200
- Laravel root route resolved with HTTP 200
- `backend/public/index.php`, `index.html` and `.htaccess` are present
- Every JavaScript and CSS asset referenced by `index.html` is present
- `WEBUZO-ROOT-CHECK.txt` is included for Document Root diagnosis
- Local `.env`, logs, SQLite test database, test uploads and frontend
  `node_modules` are excluded

## Automated checks

- TypeScript: `tsc --noEmit` passed
- Production frontend: Vite build and Laravel-public sync passed
- PHP 8.3 syntax: application, routes, migrations, seeders, scripts and tests
  passed
- Comprehensive integration smoke: passed
- Fresh seed: 4 companies, 5 roles, 16 document types, 1 admin
- Fresh business data: 0 employees, 0 vehicles, 0 documents
- SQL: 33 relational tables; no `app_state` JSON data architecture

## Integration smoke coverage

- Login and forced password change
- Authenticated bootstrap with no demo business records
- Configuration-only bootstrap; business lists remain server-paginated
- Employee, vehicle and document creation
- Employee identity-document projection without loading every document
- Private file MIME validation, authorization and company isolation
- Vehicle assignment history
- Server-side pagination, search and sorting
- Company-scoped global search by employee, document and vehicle identifiers
- Database-aggregated dashboard
- Multi-role users and company-scoped API denial
- Separate company-document permission without cross-owner data leakage
- Audited Super Admin impersonation
- Idempotent expiry scan, queued notifications and retries
- Document renewal history, including renewals without an optional issue date
- Template preview and queued test
- CSV report generation
- Import inspect/preview/commit
- Archive and restore
- Queue/failed-job operations status
- Audit recording

## Release contents

- React/Vite source and production build
- Laravel 12 source and installed Composer dependencies
- MySQL fresh-install SQL
- Migrations and seeders
- `.env.example` files
- Bangla cPanel guide, deployment guide, API overview and Supervisor template

The final hosting environment must still supply its own database credentials,
application key, document-root mapping, cron, queue process and external
notification credentials.
