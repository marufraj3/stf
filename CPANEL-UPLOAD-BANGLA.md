# cPanel File Manager দিয়ে নতুন Frontend আপলোড (Terminal ছাড়া)

Terminal বা SSH লাগবে না। শুধু cPanel → **File Manager** দিয়েই পুরো কাজ হবে।

আপলোড করার ফাইল: **`stf-frontend-upload.zip`** (১৮৩ KB)

---

## কেন এই আপলোডে artisan কমান্ড লাগবে না

আপনি হয়তো ভাবছেন `php artisan cache:clear` জাতীয় কিছু লাগবে কি না। **লাগবে না।**
কারণ:

- এগুলো শুধু **static ফাইল** — Laravel-এর কোনো PHP কোড, config বা route
  পরিবর্তন হয়নি। তাই `config:cache` / `route:cache` rebuild করার দরকার নেই।
- `assets/` ফোল্ডারের ফাইল `.htaccess` অনুযায়ী Laravel-কে বাইপাস করে
  সরাসরি Apache সার্ভ করে।
- `index.html` Laravel `no-cache` header দিয়ে পাঠায়, তাই browser এটা
  জমিয়ে রাখে না।

শুধু ফাইল রিপ্লেস করলেই সাইট নতুন version দেখাবে।

---

## ধাপ ১ — ZIP নামান

এই repository থেকে **`stf-frontend-upload.zip`** ফাইলটি আপনার কম্পিউটারে
download করুন।

ZIP-এর ভিতরে আছে:

```text
index.html
assets/index-BTt4CnGt.js       ← নতুন (print form + Clear Cache বাটন)
assets/index-D8B9I93L.css      ← নতুন
assets/query-vendor-hjre1zmE.js ← নতুন
assets/icons-vendor-DDIf3a0Z.js ← নতুন
assets/react-vendor-CRNOMkF5.js
assets/http-vendor-BpjWgUVE.js
```

---

## ধাপ ২ — সঠিক ফোল্ডারে যান

cPanel → **File Manager** খুলুন, তারপর যান:

```text
/home/USERNAME/stf-group-erp/backend/public
```

`USERNAME` = আপনার cPanel username। ইনস্টলের সময় ফোল্ডারের নাম ভিন্ন দিলে
সেটাই ব্যবহার করুন (যেমন `stf-group-erp-webuzo`)।

**সঠিক ফোল্ডারে আছেন কিনা যাচাই করুন** — ভিতরে এই ফাইলগুলো দেখা যাবে:

```text
index.php
index.html
.htaccess
WEBUZO-ROOT-CHECK.txt
assets/
```

> ⚠️ `index.php` না দেখলে ভুল ফোল্ডারে আছেন। এগোবেন না।

---

## ধাপ ৩ — পুরোনো assets ফোল্ডার ব্যাকআপ করুন

`assets` ফোল্ডারে **right-click → Rename**, নাম দিন:

```text
assets-old
```

এতে কিছু ভুল হলে পুরোনো নামে ফিরিয়ে আনা যাবে। **মুছবেন না** — সাইট ঠিকমতো
চলছে নিশ্চিত হওয়ার পর মুছবেন।

---

## ধাপ ৪ — ZIP আপলোড ও Extract

1. উপরে **Upload** বাটনে ক্লিক করুন
2. `stf-frontend-upload.zip` আপলোড করুন
3. আপলোড শেষে File Manager-এ ফিরে **Reload** চাপুন
4. ZIP ফাইলে **right-click → Extract**
5. Extract path ঠিক এই ফোল্ডারই আছে কিনা দেখে **Extract Files** চাপুন

Extract হলে `index.html` রিপ্লেস করতে চাইবে — **Overwrite / Replace** দিন।

এখন নতুন `assets` ফোল্ডার তৈরি হবে এবং `index.html` আপডেট হবে।

---

## ধাপ ৫ — ZIP মুছে ফেলুন

`stf-frontend-upload.zip` ফাইলটি **Delete** করুন। এটা web-accessible ফোল্ডারে
রেখে দেওয়া ঠিক নয়।

---

## ধাপ ৬ — যাচাই করুন

ব্রাউজারে খুলুন (নিজের ডোমেইন বসিয়ে):

```text
https://shop.aveen.xyz/assets/index-BTt4CnGt.js
```

কোড দেখালে ✅ ঠিক আছে। **404 দেখালে** assets ফোল্ডার ভুল জায়গায় extract
হয়েছে — ধাপ ৪ আবার দেখুন।

এরপর সাইট খুলুন এবং **Ctrl + Shift + R** (Mac-এ **Cmd + Shift + R**) চেপে
hard refresh দিন।

দেখবেন:

- উপরে ডান দিকে আপনার নামে ক্লিক করলে **"Clear Cache & Reload"** অপশন আছে
- Employee-র print form নতুন official layout-এ আসছে

---

## ধাপ ৭ — সব ঠিক থাকলে পরিষ্কার করুন

সাইট ঠিকমতো চলছে নিশ্চিত হলে `assets-old` ফোল্ডারটি **Delete** করুন।

---

## কিছু ভুল হলে (Rollback)

১ মিনিটেই আগের অবস্থায় ফেরা যাবে:

1. নতুন `assets` ফোল্ডার rename করে `assets-new` করুন
2. `assets-old` rename করে `assets` করুন
3. `index.html` ফাইলে **Edit** করে `BTt4CnGt` → `Bmx8d8P_` এবং
   `D8B9I93L` → `CnmSbYDR` (আগের নামগুলো) বসান

তাই ধাপ ৭-এর আগে `assets-old` মুছবেন না।

---

## সমস্যা ও সমাধান

**সাইট সাদা/ফাঁকা দেখাচ্ছে**
→ ব্রাউজারে F12 চেপে Console দেখুন। 404 আসলে assets ভুল জায়গায় extract
হয়েছে। `backend/public/assets/` এর ভিতরে `.js` ফাইলগুলো সরাসরি আছে কিনা
দেখুন — ভিতরে আরেকটা `assets` বা `public-upload` ফোল্ডার থাকলে ফাইলগুলো
এক লেভেল উপরে সরান।

**এখনো পুরোনো version দেখাচ্ছে**
→ Hard refresh দিন (Ctrl+Shift+R), অথবা incognito window-তে খুলুন। Cloudflare
থাকলে সেখান থেকেও cache purge করুন।

**"The production frontend has not been built" লেখা আসছে**
→ `index.html` ফাইলটি `backend/public`-এ নেই। ZIP আবার extract করুন।

**Extract অপশন পাচ্ছি না**
→ ZIP-টি extract না করে ভিতরের ফাইলগুলো নিজের কম্পিউটারে খুলে একটা একটা করে
আপলোড করুন। শুধু খেয়াল রাখবেন `.js`/`.css` ফাইলগুলো `assets` ফোল্ডারের
ভিতরে আর `index.html` তার বাইরে থাকবে।
