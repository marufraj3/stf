# STF Group ERP

Production deployment package for the Trust Group multi-company employee,
document-expiry, vehicle and notification management system.

## Stack

- React 19, Vite, Tailwind CSS, React Router
- Axios, TanStack Query, React Hook Form
- Laravel 12 REST API, PHP 8.2+
- MySQL 8+/MariaDB 10.6+
- Laravel Sanctum, database queue and scheduler

## Included

- Five isolated companies: Seaf Al Safer Limousine, Trust And First Trading And
  Contracting, Trust And First Delivery Services, Fly Safe Travels And Tours and
  Trust And First Trading (Garage)
- Per-company logo upload (PNG/JPG) with an automatic code-badge fallback
- Dedicated Seaf Al Safer Limousine workspace: staff details, identity document
  uploads (QID, Passport, Driving Licence, Labour Contract) and vehicle Istimara
- Expiry alert box driven by per-document-type lead times: QID 15 days,
  Passport 90 days, Istimara 30 days
- Normalized relational database (33 tables; no JSON state blob)
- Real server-enforced RBAC, multi-role users and company scope
- Audited Super Admin impersonation/role testing
- Employees, documents, renewals, vehicles and driver history
- Secure private file storage and authenticated downloads
- Expiry reminders with Email/SMS/WhatsApp provider adapters, queue retries and
  duplicate prevention
- Notification templates, reports, CSV/XLSX/PDF export and bulk import preview
- Archive/restore, audit log, queue status and failed-job retry
- Production frontend already built into `backend/public`
- Complete fresh-install SQL and Laravel migrations/seeders
- `database/UPGRADE-STF-GROUP-5-COMPANIES.sql` to upgrade an existing 4-company
  database in place, without losing any live data

## Start here

For Webuzo installation, read
[`START-HERE-WEBUZO-BANGLA.md`](START-HERE-WEBUZO-BANGLA.md).

For cPanel/shared-hosting installation, read
[`docs/INSTALL-BANGLA.md`](docs/INSTALL-BANGLA.md).

For server deployment and operational commands, read
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Default first login:

```text
Email: admin@trustgroup.local
Password: password
```

The application forces a new password of at least 12 characters immediately
after the first login.

## Fresh data state

The seed contains system configuration only:

- 5 companies
- 5 system roles and their permissions
- 16 document types
- 2 default notification templates
- 1 Super Admin account
- 0 employees
- 0 vehicles
- 0 documents
- 0 reminders, notifications or audit records

## Local development

Backend:

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

For a same-origin production build:

```bash
cd frontend
npm ci
npm run build:deploy
```

This copies only the generated SPA assets into `backend/public` while keeping
Laravel's `index.php` and `.htaccess`.
