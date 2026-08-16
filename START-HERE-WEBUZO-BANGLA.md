# Webuzo-তে STF Group ERP ইনস্টল

এই package-টি Laravel 12 + React production release। পুরোনো plain-PHP
`login-fixed` package-এর সঙ্গে এটি মেশাবেন না।

## ১. ZIP কোথায় Extract করবেন

Webuzo File Manager-এ ZIP-টি আপনার account home directory-তে upload ও extract
করুন। Extract হওয়ার পর structure হবে:

```text
/home/USERNAME/stf-group-erp-webuzo/
├── backend/
├── database/
├── docs/
└── frontend/
```

পুরো project সরাসরি public web folder-এ expose করবেন না।

## ২. Domain Document Root

Webuzo → Domains → Manage Domains → `shop.aveen.xyz` → Edit থেকে Document Root
এই folder-এ দিন:

```text
/home/USERNAME/stf-group-erp-webuzo/backend/public
```

`USERNAME`-এর জায়গায় Webuzo-তে দেখানো আপনার আসল account username থাকবে।
Document Root অবশ্যই `backend/public` দিয়ে শেষ হবে।

সঠিক folder-এর ভেতরে সরাসরি এগুলো দেখা যাবে:

```text
index.php
index.html
.htaccess
WEBUZO-ROOT-CHECK.txt
assets/
```

Save করার পর আগে খুলুন:

```text
https://shop.aveen.xyz/WEBUZO-ROOT-CHECK.txt
```

এখানে `STF GROUP ERP WEB ROOT OK` দেখালে Document Root ঠিক। এটিও 404 হলে
Laravel বা database নয়—Webuzo domain এখনও অন্য folder-এ point করছে।

## ৩. PHP

Domain-এর PHP version 8.2 বা নতুন নির্বাচন করুন। প্রয়োজনীয় extensions:

```text
bcmath, ctype, curl, dom, fileinfo, mbstring, openssl,
pdo_mysql, tokenizer, xml, zip
```

## ৪. Database

নতুন empty database ও database user তৈরি করে user-কে `ALL PRIVILEGES` দিন।
তারপর phpMyAdmin-এ import করুন:

```text
database/TRUST-GROUP-ERP-COMPLETE-FRESH-INSTALL.sql
```

পুরোনো ৬-table বা plain-PHP SQL import করবেন না।

## ৫. Environment File

`backend/.env.example` copy করে `backend/.env` বানিয়ে অন্তত এগুলো দিন:

```dotenv
APP_URL=https://shop.aveen.xyz
APP_KEY=

DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=YOUR_DATABASE
DB_USERNAME=YOUR_DATABASE_USER
DB_PASSWORD=YOUR_DATABASE_PASSWORD

QUEUE_CONNECTION=database
CACHE_STORE=database
SESSION_DRIVER=database
```

## ৬. Terminal Commands

```bash
cd /home/USERNAME/stf-group-erp-webuzo/backend
php artisan key:generate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

`storage` ও `bootstrap/cache` directory writable রাখুন। সাধারণত directory
permission `775` যথেষ্ট; `777` দেবেন না।

## ৭. Final Test

এই ক্রমে পরীক্ষা করুন:

```text
https://shop.aveen.xyz/WEBUZO-ROOT-CHECK.txt
https://shop.aveen.xyz/up
https://shop.aveen.xyz/
```

- Root-check 404: Webuzo Document Root ভুল।
- Root-check চলে, কিন্তু `/up` 404: `.htaccess`/rewrite বা PHP handler সমস্যা।
- `/up` 500: `backend/.env`, `APP_KEY`, PHP extension, permission বা Laravel
  log পরীক্ষা করুন।
- `/up` চলে, কিন্তু home page সমস্যা: React build/assets পরীক্ষা করুন।

## ৮. Login

```text
Email: admin@trustgroup.local
Password: password
```

প্রথম login-এ কমপক্ষে ১২ অক্ষরের নতুন password দিতে হবে।

