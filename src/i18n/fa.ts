/** All UI strings (PLAN.md §14.1 rule 9). Keep keys grouped by screen. */
export const fa = {
  app: {
    name: 'Bourse View Filters',
    loadFile: 'بارگذاری فایل روز',
    dropHere: 'فایل اکسل را اینجا رها کنید',
    snapshot: 'اسنپ‌شات',
    noSnapshot: 'فایلی بارگذاری نشده',
    searchSymbol: 'جستجوی نماد (Ctrl+K)',
    menu: 'منو',
    loading: 'در حال پردازش…',
    comingSoon: 'این بخش در فازهای بعدی تکمیل می‌شود.',
  },
  nav: {
    overview: 'نمای کلی',
    technical: 'تکنیکال',
    marketRisk: 'ریسک بازار',
    fundamentalLong: 'بنیادی بلندمدت',
    fundamentalQuarterly: 'بنیادی فصلی',
    fundamentalMonthly: 'بنیادی ماهانه',
    filterStudio: 'استودیو فیلتر',
    customMetrics: 'پارامترهای سفارشی',
    rawData: 'داده خام',
    dataHealth: 'سلامت داده',
    settings: 'تنظیمات',
  },
  empty: {
    title: 'هنوز فایلی بارگذاری نشده است',
    body: 'فایل اکسل روز (مثل screener-plus-1405-08-04.xlsx) را بارگذاری کنید یا روی صفحه بکشید و رها کنید. همه پردازش‌ها روی همین مرورگر انجام می‌شود و هیچ داده‌ای به سرور ارسال نمی‌شود.',
  },
} as const;

export type Strings = typeof fa;
