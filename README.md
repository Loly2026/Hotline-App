# Hotline Egypt

تطبيق Hotline Egypt عبارة عن نظام متكامل يشمل:
- Backend API (Node.js + Express + SQLite)
- Mobile App (Expo React Native) يعمل على Android و iOS
- قاعدة بيانات قابلة للتوسعة لتغطية جميع محافظات مصر

## 1) مكونات المشروع

- `/Users/mohamedibrahimhelmy/Documents/New project/backend`: الخادم + قاعدة البيانات + أدوات الاستيراد
- `/Users/mohamedibrahimhelmy/Documents/New project/mobile`: تطبيق الموبايل

## 2) تشغيل الـ Backend

المتطلبات:
- Node.js 20+

الأوامر:

```bash
cd /Users/mohamedibrahimhelmy/Documents/New\ project/backend
npm install
npm run seed
npm run start
```

السيرفر سيعمل على:
- `http://localhost:4000`

### أهم الـ API
- `GET /health`
- `GET /api/categories`
- `GET /api/governorates`
- `GET /api/stats/coverage`
- `GET /api/contacts/popular?limit=8`
- `POST /api/contacts/:id/request`
- `GET /api/contacts?q=...&category=...&governorate=...&limit=...&offset=...`

## 3) تشغيل تطبيق الموبايل

المتطلبات:
- Node.js 20+
- Expo CLI
- Android Studio أو Xcode

الأوامر:

```bash
cd /Users/mohamedibrahimhelmy/Documents/New\ project/mobile
npm install
npm run start
```

إذا كان السيرفر ليس على الجهاز المحلي، عيّن متغير البيئة:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_IP:4000 npm run start
```

## 4) تغطية جميع المحافظات وكل الأرقام

قاعدة البيانات حاليًا تحتوي:
- كل محافظات مصر (27 محافظة)
- فئات الخدمات الأساسية
- مجموعة أولية من الأرقام القومية وأرقام أمثلة لخدمات متعددة

لإدخال جميع الأرقام الفعلية (مراكز خدمة، مستشفيات، بنوك، صيانة...):
1. جهز ملف CSV بنفس أعمدة القالب:
   - `/Users/mohamedibrahimhelmy/Documents/New project/backend/data/contacts-template.csv`
2. شغّل الاستيراد:

```bash
cd /Users/mohamedibrahimhelmy/Documents/New\ project/backend
npm run import:csv -- /path/to/your-full-contacts.csv
```

لاستيراد من hotlinesegypt.com تلقائيًا:

```bash
cd /Users/mohamedibrahimhelmy/Documents/New\ project/backend
npm install
npm run import:hotlinesegypt
```

لمعرفة النواقص في التغطية (أي فئة لا تحتوي أرقامًا في محافظة معيّنة):

```bash
cd /Users/mohamedibrahimhelmy/Documents/New\ project/backend
npm run report:coverage
```

لتنظيف بيانات الهوتلاين بعد الاستيراد (دمج الفئات المتشابهة + تمييز غير الهاتفي + تقرير تكرارات):

```bash
cd /Users/mohamedibrahimhelmy/Documents/New\ project/backend
npm run clean:hotlines
```

## 5) ملاحظات جودة البيانات

- يفضل أن تكون الأرقام من مصادر رسمية لكل جهة.
- استخدم `source_url` و`last_verified` لتتبع المراجعة الدورية.
- يمكن جدولة تحديث شهري للبيانات لمنع أي أرقام قديمة.
