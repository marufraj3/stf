# আপডেট নোট — Bank Document, Vehicle Fleet, Company Licenses ও Loading Animation

এই রিলিজে যা যা যোগ/ঠিক করা হয়েছে (English summary at the bottom).

## ১. All Bank Document পেজ

- **Account Phone Expire** যোগ করা হয়েছে (Bank Card Expire-এর পাশাপাশি)।
  নতুন কলাম: `bank_documents.account_phone_expiry_date`
- ডিজাইন এখন **Employee Directory পেজের মতো**: হেডার কার্ড, KPI স্ট্রিপ,
  ফিল্টার টুলবার, বড় টেবিল, প্রতি রো-তে **View Details / Edit / Delete** বাটন।
- **ডকুমেন্ট ভিউ ঠিক করা হয়েছে।** আগে `Doc → View` ক্লিক করলে লগিন পেজ চলে
  আসত, কারণ লিংকটা `/files/12` এ সরাসরি যেত যেখানে auth token থাকত না।
  এখন ফাইলটা API client দিয়ে (Bearer token সহ) লোড হয়ে **Preview Modal**-এ
  দেখায় — ছবি হলে ইনলাইন, PDF হলে iframe, সাথে Download + Print বাটন।
- **View Details** মডাল থেকে সব তথ্য দেখা ও **Print** করা যায়।
- ফিল্টার: search, bank card status, account phone status, phone ownership।
- Employee dropdown এখন server-side search করে (৩০০+ এমপ্লয় থাকলেও দ্রুত)।

## ২. Vehicle Fleet পেজ

- নতুন ফিল্ড যোগ করা যায় ও কার্ডে দেখা যায়:
  **Plate No, Reg Date, Issue Date, Expiry Date, Renew Date, Chassis No,
  Engine No**
  নতুন কলাম: `vehicles.issue_date`, `vehicles.expiry_date`, `vehicles.renew_date`
- Expiry Date-এর পাশে অটো এক্সপায়ারি ব্যাজ (Valid / Expiring / Expired)।
- **Vehicle Documents প্রিভিউ** করা যায় (Istimara/Insurance) — সিকিউর প্রিভিউ
  মডাল, Download ও Print সহ।
- **View Details** বাটনে ক্লিক করলে পুরো ডিটেইল শিট খোলে (registration,
  vehicle, drivers, documents, notes) এবং **Print** করা যায়।
- আগের কোডে Vehicle পেজে একটা JSX সিনট্যাক্স এরর ছিল যার জন্য পুরো frontend
  build fail করত — সেটাও ঠিক করা হয়েছে।

## ৩. Company Licenses পেজ

Dynamic Document পেজের মতো পূর্ণ CRUD:

- **Add License** (প্রতি কোম্পানির কার্ডে আলাদা বাটনও আছে)
- **Edit**, **Delete** (আর্কাইভে যায়), **Restore**
- **Preview** (সিকিউর অ্যাটাচমেন্ট ভিউয়ার) ও **Renew**
- Search + "Deleted / archived licenses" ফিল্টার

## ৪. লোডিং এনিমেশন (সবচেয়ে গুরুত্বপূর্ণ)

- **গ্লোবাল ব্যস্ততা ইন্ডিকেটর**: প্রতিটি API কল `services/busy.ts` ট্র্যাকারের
  মধ্য দিয়ে যায়।
  - যেকোনো রিকোয়েস্ট চললে উপরে **পাতলা অ্যাম্বার প্রোগ্রেস বার**।
  - Add / Edit / Delete (POST/PUT/PATCH/DELETE) চললে **স্পিনার সহ ব্লকিং
    ওভারলে** ("Saving…" / "Deleting…") — এডমিন বারবার ক্লিক করতে পারবে না,
    ডুপ্লিকেট রেকর্ডও তৈরি হবে না।
- বাটন-লেভেল স্পিনার: Save, Delete, Archive, Restore বাটনে।
- টেবিল/কার্ড লোড হওয়ার সময় **skeleton animation**।
- মডিউল লোড হওয়ার সময় Suspense স্পিনার।

## ৫. স্পিড / পারফরম্যান্স (৩০০+ এমপ্লয় + অনেক ডকুমেন্টের জন্য)

Frontend:

- সব মডিউল **lazy load (code splitting)** — প্রথম লোডে মূল bundle ~৭৯ kB
  (আগে সব একসাথে আসত)। বাকি স্ক্রিন দরকার হলে তখন নামে।
- React Query cache: `staleTime` 60s, `gcTime` 10 min, window focus refetch বন্ধ।
- `refreshData()` এখন শুধু **active** query invalidate করে, আগের মতো পুরো
  cache নয়।
- সব লিস্ট server-side paginated + debounced search (আগের মতোই, কিন্তু bank
  document ও company license পেজেও এখন প্রযোজ্য)।

Backend:

- Dashboard-এ ~২০টা আলাদা `COUNT(*)` query-র বদলে **৩টা aggregate query**
  (documents, employees, notifications)।
- Urgent documents eager load (N+1 বন্ধ)।
- Bank document লিস্টে `bankFile` ও `company` eager load।
- নতুন ডাটাবেস ইনডেক্স:
  - `vehicles (company_id, expiry_date)`
  - `employees (company_id, full_name)`, `employees (employee_code)`
  - `documents (owner_type, owner_id)`, `documents (company_id, expiry_date)`
  - `bank_documents (employee_name)`, `bank_documents (account_phone_expiry_date)`

## ৬. ডাটাবেস আপডেট কীভাবে চালাবেন

**Laravel migration দিয়ে (recommended):**

```bash
cd backend
php artisan migrate --force
```

**অথবা phpMyAdmin / SQL দিয়ে (live data নষ্ট হবে না, বারবার চালানো নিরাপদ):**

```text
database/UPGRADE-FLEET-DATES-AND-BANK-PHONE-EXPIRY.sql
```

নতুন ইনস্টলের জন্য `database/TRUST-GROUP-ERP-COMPLETE-FRESH-INSTALL.sql`
আপডেট করা হয়েছে (bank_documents, employee_messages, নতুন কলাম ও ইনডেক্স সহ)।

আপডেটের পর:

```bash
cd backend
php artisan config:clear && php artisan cache:clear && php artisan route:clear
```

---

## English summary

- Bank Documents: added **account phone expiry** next to bank card expiry,
  rebuilt the page in the Employee Directory style (View Details / Edit /
  Delete), and fixed document viewing — attachments are now streamed through
  the authenticated API into a preview modal instead of navigating to
  `/files/{id}`, which used to dump the admin on the login page.
- Vehicle Fleet: Plate No, Reg Date, Issue Date, Expiry Date, Renew Date,
  Chassis No and Engine No are editable and displayed; vehicle documents can be
  previewed; **View Details** shows the full sheet and prints. Also fixed a JSX
  syntax error that broke the production build.
- Company Licenses: full add / edit / delete / restore / preview / renew, the
  same way the Dynamic Documents screen works.
- Loading animation: a global request tracker drives a top progress bar for
  reads and a blocking spinner overlay for every add/edit/delete, plus
  button-level spinners and table/card skeletons.
- Performance: route-level code splitting, tuned React Query caching, scoped
  cache invalidation, aggregate dashboard queries, eager loading and seven new
  database indexes.
