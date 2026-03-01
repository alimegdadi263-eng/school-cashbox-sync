# بناء ملف Windows EXE (Electron)

## المتطلبات
- Node.js v20 أو أحدث
- npm

## الخطوات

### 1) تثبيت المكتبات
```bash
npm install
```

### 2) إنشاء ملف .env (مطلوب)
أنشئ ملف `.env` في المجلد الرئيسي يحتوي على:
```
VITE_SUPABASE_URL=https://jsglrvtlafynkdqbfyos.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzZ2xydnRsYWZ5bmtkcWJmeW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjI1NDksImV4cCI6MjA4NzU5ODU0OX0.TsULEYJiku2N04FwFVNdCj6qzrB-o3WhtUiFrtJl0Yo
VITE_SUPABASE_PROJECT_ID=jsglrvtlafynkdqbfyos
```

### 3) بناء ملف EXE
```bash
npm run electron:build
```

سيتم إنشاء ملف التثبيت في مجلد `release/`

### 4) تشغيل محلي (للتطوير)
```bash
npm run electron:dev
```

## ملاحظات
- التطبيق يتطلب اتصال بالإنترنت للمصادقة وإدارة المستخدمين
- البيانات المالية (الحركات والأرصدة) تُحفظ محلياً على جهاز المستخدم
- بيانات الحسابات (يوزر وباسوورد) محفوظة في السحابة
- حساب الأدمن محمي ببيانات دخول خاصة لا يمكن إنشاء أدمن آخر
