# Bourse-View-Filter

داشبورد امتیازدهی و فیلتر نمادهای بورس تهران — **کاملاً محلی و بدون سرور**.
فایل اکسل روزانه `screener-plus-YYYY-MM-DD.xlsx` را در مرورگر بارگذاری کنید؛ همه پردازش‌ها روی همان دستگاه انجام می‌شود و هیچ داده‌ای جایی ارسال نمی‌شود.

پلن کامل پروژه: [PLAN.md](PLAN.md)

## پیش‌نیازها

- [Node.js](https://nodejs.org/) نسخه ۲۰ یا بالاتر (همراه npm)
- [Git](https://git-scm.com/)
- [VS Code](https://code.visualstudio.com/) (اختیاری، برای توسعه)

## نصب (یک بار)

در ترمینال VS Code (`` Ctrl+` ``) این دستورها را اجرا کنید:

```bash
git clone https://github.com/SajjadMohammadii/Bourse-View-Filter.git
cd Bourse-View-Filter
code .                      # باز کردن پروژه در VS Code

npm run setup               # نصب همه وابستگی‌ها + مرورگر تست (Playwright)

# افزونه‌های پیشنهادی VS Code (ESLint، Prettier، Vitest، Playwright):
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension vitest.explorer
code --install-extension ms-playwright.playwright
```

> اگر `code` در ترمینال شناخته نشد: در VS Code کلید `Ctrl+Shift+P` ← «Shell Command: Install 'code' command in PATH».
> با باز کردن پروژه، VS Code خودش هم نصب افزونه‌های پیشنهادی را پیشنهاد می‌دهد.

## دیدن نتیجه

**حالت توسعه (با بارگذاری خودکار تغییرات):**

```bash
npm run dev
```

سپس در مرورگر آدرس <http://localhost:5173> را باز کنید.

**نسخه نهایی تک‌فایلی (بدون نیاز به هیچ سروری):**

```bash
npm run build
```

فایل `dist/index.html` ساخته می‌شود؛ کافی است روی آن دابل‌کلیک کنید تا در مرورگر باز شود. این فایل را می‌توانید به هر کسی بدهید و بدون اینترنت کار می‌کند.

## دستورهای دیگر

| دستور | کار |
|---|---|
| `npm test` | اجرای تست‌های واحد (Vitest) |
| `npm run test:e2e` | ساخت نسخه نهایی و اجرای تست‌های مرورگر (Playwright) |
| `npm run lint` | بررسی کیفیت کد و مرزهای معماری |
| `npm run format` | قالب‌بندی خودکار کد |
