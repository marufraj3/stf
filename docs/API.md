# REST API overview

All endpoints are prefixed with `/api`. Except login, endpoints require:

```http
Authorization: Bearer <sanctum-token>
Accept: application/json
```

Company scope and permissions are validated on the server for every resource.
Archived records use soft deletion where applicable.

## Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/login` | Login and issue expiring Sanctum token |
| GET | `/auth/me` | Current user, roles, permissions and companies |
| PUT | `/auth/password` | Required first-login/password change |
| POST | `/auth/logout` | Revoke current token |
| POST | `/auth/impersonate/{user}` | Audited Super Admin impersonation |
| POST | `/auth/impersonation/stop` | End impersonated token |

## Application data

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/bootstrap` | Authorized configuration; business data stays paginated |
| GET | `/dashboard` | Database-aggregated dashboard counts |
| GET | `/search` | Scoped global search |
| GET | `/resources/{resource}` | Paginated/searchable/sortable collection |
| POST | `/resources/{resource}` | Create record |
| PUT | `/resources/{resource}/{id}` | Update record |
| DELETE | `/resources/{resource}/{id}` | Archive/delete by resource policy |
| POST | `/resources/{resource}/{id}/restore` | Restore soft-deleted record |

Supported resource names are defined centrally in
`backend/app/Services/ErpResourceService.php`.

## Documents and files

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/files/{file}` | Permission- and company-scoped private download |
| POST | `/documents/{document}/renew` | Preserve history and upload new file |

Files accept PDF/JPG/PNG, are MIME-inspected, size-limited and stored outside the
public web root.

## Reminders and templates

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/notifications` | Paginated notification log |
| POST | `/reminders/scan` | Authorized manual expiry scan |
| POST | `/notifications/{notification}/retry` | Queue a failed notification |
| POST | `/templates/{template}/preview` | Render template variables |
| POST | `/templates/{template}/test` | Queue audited test notification |

## Users, roles and settings

| Method | Endpoint | Purpose |
|---|---|---|
| POST/PUT | `/users`, `/users/{user}` | User, roles, status and company access |
| POST/PUT | `/roles`, `/roles/{role}` | DB-driven role permissions |
| PUT | `/settings` | Authorized global/provider settings |
| GET | `/operations` | Queue/scheduler health |
| POST | `/operations/failed-jobs/{uuid}/retry` | Retry failed queue job |

## Imports, reports and audit

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/imports/inspect` | Read headings/sample rows |
| POST | `/imports/preview` | Validate/map without writing business data |
| POST | `/imports/{batch}/commit` | Commit a valid preview |
| GET | `/imports/{batch}/errors` | Download row error report |
| GET | `/reports/export` | CSV/XLSX/PDF report export |
| GET | `/audit-logs` | Server-filtered audit history |

Validation errors return HTTP `422`, missing permissions `403`, unauthenticated
requests `401`, and missing records `404`.
