# cPanel-এ ইনস্টল করার নিয়ম

এই release-এ React production build, Laravel API, `vendor`, complete SQL এবং
সব source code আছে। Hosting-এ Node.js লাগবে না।

## ১. Hosting requirement

- PHP 8.2 বা নতুন
- MySQL 8+ অথবা MariaDB 10.6+
- PHP extensions: `bcmath`, `ctype`, `curl`, `dom`, `fileinfo`, `mbstring`,
  `openssl`, `pdo_mysql`, `tokenizer`, `xml`, `zip`
- Cron Job
- Queue worker চালানোর জন্য Supervisor সবচেয়ে ভালো; না থাকলে Cron fallback
  ব্যবহার করা যাবে

## ২. File upload

ZIP extract করুন web root-এর বাইরে:

```text
/home/CPANEL_USER/stf-group-erp/
```

Domain বা subdomain-এর Document Root দিন:

```text
/home/CPANEL_USER/stf-group-erp/backend/public
```

পুরো Laravel project `public_html`-এ প্রকাশ করবেন না। শুধু `backend/public`
web-accessible হওয়া নিরাপদ। Main domain-এর document root পরিবর্তন করা না গেলে
একটি subdomain তৈরি করে উপরের path দিন।

## ৩. Database

1. cPanel → MySQL Databases থেকে নতুন empty database ও user তৈরি করুন।
2. user-কে database-এর `ALL PRIVILEGES` দিন।
3. phpMyAdmin-এ নতুন database select করুন।
4. এই file import করুন:

```text
database/TRUST-GROUP-ERP-COMPLETE-FRESH-INSTALL.sql
```

এই SQL 33টি normalized table তৈরি করে। এতে demo employee, vehicle বা document
নেই।

SQL import করলে পরে `migrate:fresh`, `db:wipe` বা `--seed` চালাবেন না—এগুলো
data reset করতে পারে।

### পুরোনো (৪ কোম্পানির) database আপগ্রেড

আগের version-এ তৈরি database-এ উপরের fresh-install file **import করবেন না**—
তাতে সব live data মুছে যাবে। আগে database backup নিন, তারপর একবার import করুন:

```text
database/UPGRADE-STF-GROUP-5-COMPANIES.sql
```

এটি পুরোনো ৪টি কোম্পানির নাম আপডেট করে, ৫ম কোম্পানি
TRUST AND FIRST TRADING (GARAGE) যোগ করে, QID ১৫ / Passport ৯০ / Istimara ৩০
দিনের alert setting যোগ করে এবং Labour Contract-কে staff document বানায়।
Script-টি একাধিকবার চালালেও কোনো ক্ষতি হবে না।

## ৪. Environment

`backend/.env.example` copy করে `backend/.env` বানান। অন্তত এগুলো পরিবর্তন করুন:

```dotenv
APP_URL=https://erp.yourdomain.com
APP_KEY=

DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=cpanel_database_name
DB_USERNAME=cpanel_database_user
DB_PASSWORD=strong_database_password

QUEUE_CONNECTION=database
CACHE_STORE=database
SESSION_DRIVER=database
ERP_PRIVATE_DISK=local
```

তারপর Terminal/SSH থেকে:

```bash
cd /home/CPANEL_USER/stf-group-erp/backend
php artisan key:generate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## ৫. Folder permission

`backend/storage` এবং `backend/bootstrap/cache` PHP process-এর writable হতে
হবে। সাধারণত directory `775` এবং file `664` যথেষ্ট। কখনো `777` দেবেন না।

Employee/document upload `backend/storage/app/private`-এ থাকে এবং direct URL
দিয়ে খোলা যায় না; authenticated API permission ছাড়া download হবে না।

## ৬. Scheduler

cPanel Cron Jobs-এ প্রতি মিনিটে:

```cron
* * * * * cd /home/CPANEL_USER/stf-group-erp/backend && /usr/local/bin/php artisan schedule:run >> /dev/null 2>&1
```

আপনার hosting-এর PHP path আলাদা হলে cPanel-এর PHP path ব্যবহার করুন। Expiry
scan application timezone `Asia/Qatar` অনুযায়ী প্রতিদিন 09:00-এ চলে।

## ৭. Queue worker

Supervisor থাকলে `docs/supervisor-stf-erp.conf`-এর path/user পরিবর্তন করে
install করুন।

Supervisor না থাকলে cPanel Cron fallback:

```cron
* * * * * cd /home/CPANEL_USER/stf-group-erp/backend && /usr/local/bin/php artisan queue:work --stop-when-empty --tries=3 --timeout=120 >> /dev/null 2>&1
```

## ৮. প্রথম Login

```text
Email: admin@trustgroup.local
Password: password
```

প্রথম login-এর পর system কমপক্ষে ১২ অক্ষরের নতুন password দিতে বাধ্য করবে।

## ৯. Live notification

Default installation-এ Settings → Notification Providers-এর `Safe test mode`
চালু থাকে; তাই external message পাঠাবে না। Email/SMS/WhatsApp credentials
`.env`-এ বসিয়ে test message যাচাই করার পর Super Admin হিসেবে safe test mode
বন্ধ করুন।

## ১০. Final check

- `/up` খুললে application health response আসে
- login-এর পর Employee, Vehicle ও Document count `0`
- চারটি company দেখা যায়
- নতুন HR user বানিয়ে company scope দিলে অন্য company-এর data দেখতে পারে না
- Settings → Queue & Scheduler-এ worker/failed-job status দেখা যায়
- Cron ও queue চালানোর পর test notification processed হয়

সমস্যা হলে আগে `backend/storage/logs/laravel.log` দেখুন; browser-এর frontend
Console error একা database/API error-এর পূর্ণ কারণ দেখায় না।
