# Bourse View Filters — پلن پیاده‌سازی (برای اجرا توسط Claude Code)

> **نقش این سند:** این فایل «منبع حقیقت» (Source of Truth) پروژه است. Claude Code باید پیش از نوشتن هر خط کد، کل سند را بخواند، سپس فازها را به ترتیب بخش ۱۵ اجرا کند و پس از هر فاز معیارهای پذیرش (Acceptance Criteria) را تیک بزند.
>
> **زبان کد:** شناسه‌ها، نام فایل‌ها و کامنت‌های فنی انگلیسی. **زبان رابط کاربری:** فارسی، راست‌چین (RTL).

---

## فهرست

0. خلاصه و اهداف
1. قرارداد داده ورودی (Data Contract) — یافته‌ها از فایل نمونه
2. پشته فناوری (Stack)
3. معماری و ساختار پوشه‌ها
4. خط لوله داده (Data Pipeline)
5. رجیستری پارامترهای مشتق (Derived Metrics)
6. موتور امتیازدهی (Scoring Engine)
7. پروفایل تکنیکال + پروفایل ریسک بازار
8. پروفایل بنیادی بلندمدت
9. پروفایل بنیادی میان‌مدت (فصلی)
10. پروفایل بنیادی کوتاه‌مدت (ماهانه)
11. موتور فیلتر و زبان عبارت (Filter Engine & Expression Language)
12. رابط کاربری، صفحات، جدول‌ها و نمودارها
13. تاریخچه اسنپ‌شات‌ها (مقایسه روزبه‌روز)
14. قوانین کلین‌کد، تست و CLAUDE.md
15. فازهای اجرا و معیارهای پذیرش
16. راهنمای توسعه‌پذیری
17. فرض‌هایی که باید تأیید شوند

---

## 0. خلاصه و اهداف

**Bourse View Filters** یک داشبورد مدیریتی تحت وب، کاملاً سمت کاربر (بدون سرور) است که کاربر هر روز فایل اکسل `screener-plus-YYYY-MM-DD.xlsx` (تاریخ شمسی) را در آن بارگذاری می‌کند و چهار پروفایل امتیازی برای هر نماد می‌بیند:

| # | پروفایل | منبع داده | خروجی |
|---|---|---|---|
| 1 | **تکنیکال** | اندیکاتورها، حجم، جریان پول حقیقی/حقوقی، ریسک، بتا، همبستگی | ۷ فاکتور + امتیاز نهایی ۰–۱۰۰ + **پروفایل ریسک کل بازار** |
| 2 | **بنیادی بلندمدت** | داده‌های سالانه/TTM، نسبت‌های مالی، رشد ۳/۵/۷+ ساله | ۸ فاکتور + امتیاز نهایی |
| 3 | **بنیادی میان‌مدت (فصلی)** | داده‌های MRQ و رشد فصلی | ۷ فاکتور + امتیاز نهایی + پرچم «تحول فصلی» |
| 4 | **بنیادی کوتاه‌مدت (ماهانه)** | درآمد ماهانه و رشدهای ماهانه | ۶ فاکتور + امتیاز نهایی + پرچم «تحول ماهانه» |

**اهداف کلیدی:**
- فهرست بهترین‌ها و بدترین‌ها در هر پروفایل.
- **فیلتر روی هر ستون** (خام، مشتق، امتیاز، فاکتور) با سازنده بصری و زبان عبارت متنی.
- **تعریف پارامتر جدید** توسط کاربر (مثلاً `NI_MRQ / NI_TTM`) که در همه جا (جدول، فیلتر، نمودار، حتی داخل فاکتورها) قابل استفاده باشد.
- تحمل تغییر روزانه: نمادهای جدید، حذف نماد، اضافه شدن ستون جدید، جابه‌جایی ترتیب ستون‌ها.
- معماری لایه‌ای، اعلانی (Declarative) و قابل توسعه: افزودن فاکتور/پارامتر = ویرایش فایل پیکربندی، نه تغییر موتور.

**خارج از محدوده (نسخه ۱):** سرور، احراز هویت، اتصال زنده به TSETMC، معامله.

---

## 1. قرارداد داده ورودی (Data Contract)

### 1.1 یافته‌ها از فایل نمونه `screener-plus-1405-08-04.xlsx`

| مورد | مقدار / رفتار | اقدام لازم |
|---|---|---|
| شیت | یک شیت به نام `Filtered Results` | شیت اول را بخوان؛ نام را hard-code نکن. |
| ابعاد | ۹۵۷ سطر × ۴۴۵ ستون | تعداد سطر/ستون متغیر است. |
| ستون اول | سرستون خالی و تمام مقادیر خالی (`Unnamed: 0`) | ستون‌های بدون نام و تماماً خالی حذف شوند. |
| مقادیر گمشده | رشته `-` (≈۹۸٬۵۰۰ سلول) و `----` | هر دو → `null`. هر رشته غیرعددی در ستون عددی → `null` و ثبت در گزارش سلامت داده. |
| نام ستون‌های کثیف | برخی نام‌ها `\n` دارند: `OP_Margin_TTM_3yGR\n_Arith`، `GP_Margin_TTM_1yGR\n` | نرمال‌سازی: حذف `\n`، trim، فاصله‌ها. نام نرمال‌شده = کلید کانونی. |
| ستون `Chart` | مقدار ثابت «Chart»، بدون هایپرلینک | نادیده گرفته شود (یا لینک ساخته‌شده به TSETMC/سایت دلخواه از روی Symbol در تنظیمات). |
| شناسه یکتا | `Symbol` (بدون تکرار در نمونه) | کلید اصلی. اگر تکرار شد، هشدار و نگه‌داشتن اولی. |
| `Exchange` | `TSE` (۴۳۱)، `IFB` (۳۵۵)، `OTC` (۱۷۱) | نمایش فارسی: بورس / فرابورس / پایه. |
| `Sector` | ۱۱ بخش + `-` (۲ نماد) | `-` → «نامشخص». |
| `Industry` | ۶۱ صنعت (برخی فقط ۱–۳ عضو) | برای امتیازدهی نسبی، حداقل اندازه گروه همتا لازم است (بخش ۶.۳). |
| `FiscalYear` | فرمت `MMDD` پایان سال مالی: `1229`=۲۹ اسفند (۵۹۹)، `930`، `631`، … | به «ماه پایان سال مالی» تبدیل شود؛ برای تحلیل فصلی/فصلی‌بودن لازم است. |
| `LastStatementDate` | تاریخ شمسی `YYYYMMDD` مثل `14050631` | تبدیل به Date شمسی؛ محاسبه «عمر آخرین صورت مالی» (روز). |
| واحد مبالغ | ریال (مثلاً MarketCap = 370,899,018,602,036) | نمایش در «همت» (هزار میلیارد تومان) / «میلیارد تومان» با تنظیمات. |
| نسبت‌ها و بازده‌ها | کسر اعشاری (0.1305 = ۱۳٫۰۵٪) | نمایش درصدی؛ در زبان فیلتر هم `13%` = `0.13`. |
| پوشش داده | درآمد ماهانه (`Rev_1M`) ≈ ۷۰٪، تکنیکال (`RSI`) ≈ ۹۰٪، `Beta_60W` ≈ ۸۰٪، `PtoNAV` ≈ ۱۴٪، `Prod_Mo3MAvgGR` = ۰٪ | امتیازدهی باید با داده ناقص کار کند (بخش ۶.۵). |
| ستون‌های تکراری/هم‌معنا | `macd`≈`MACDLine`، `macdsignal`≈`MACDSignalLine`، `blbands`=`belbands`، `bmbands`=`bembands`، `EVtoS`≈`EVtoS_Monthly` در برخی نمادها | در Data Dictionary به‌عنوان alias علامت بخورند؛ فقط یکی در فاکتورها استفاده شود. |

### 1.2 هویت‌های تأییدشده روی داده (برای استفاده در پارامترهای مشتق)

این روابط روی فایل نمونه با میانه نسبت ≈ ۱٫۰۰۰ تأیید شده‌اند:

- `DebtRatio = بدهی مالی (تسهیلات) / TA_MRQ` ← پس **`Debt = DebtRatio × TA_MRQ`**
- `DebtToEquity = Debt / TSE_MRQ`
- `LiabilityToAsset = TL_MRQ / TA_MRQ`
- `PtoE_ttm = MarketCap / NI_TTM`
- `MarketCap = Price × NumberOfOutstandingShares`
- `High_200D = Price / سقف ۲۰۰ روزه` (۱ یعنی روی سقف) و `Low_200D = Price / کف ۲۰۰ روزه`؛ همین منطق برای `High_20D`، `High_50D`، `Low_20D`، `Low_50D`.
- `CFO ≈ CFOToRev × Rev_TTM`

### 1.3 گروه‌بندی ستون‌ها (Data Dictionary)

فایل `src/config/columns.ts` باید **هر** ستون شناخته‌شده را با این متادیتا ثبت کند: `id`، `label` فارسی، `category`، `unit`، `horizon`، `direction` پیش‌فرض، `description`، `aliases`.

| دسته (`category`) | ستون‌ها (نمونه، نه کامل) |
|---|---|
| `identity` | Company, Symbol, Exchange, Sector, Industry, FiscalYear, LastStatementDate |
| `price` | Price, Open, High, Low, VWAP, DailyChange, Close_1W, Close_1M, Open_1W/1M, High_1W/1M, Low_1W/1M, AvgVWAP_1W/1M |
| `size` | MarketCap, NumberOfOutstandingShares, BaseVolume |
| `incomeAnnual` | Rev_FY, Rev_TTM, GP_FY/TTM, OP_FY/TTM, NI_FY/TTM, EBIT, FE_FY/TTM, EPS_FY, EPS_TTM |
| `incomeQuarterly` | Rev_MRQ, GP_MRQ, OP_MRQ, NI_MRQ, FE_MRQ, EPS_MRQ, EPS_MRQ_LC, NetFx_IRR |
| `incomeMonthly` | Rev_1M |
| `balance` | TA_MRQ/FY, TL_MRQ/FY, TSE_MRQ/FY, RE_MRQ/FY |
| `ratioProfitability` | ROA, ROE, NPMargin, GPMargin, OPMargin, ETR (+ نسخه‌های MRQ حاشیه‌ها) |
| `ratioEfficiency` | AssetTurnover, FixedAssetTO, InvTurnover, InvTurnoverDay, ReceivableTurnover, ReceivableTurnoverDay |
| `ratioLeverage` | LiabilityToAsset, LiabilityToEquity, DebtRatio, DebtToEquity, LTDebtRatio, ICR, CurrentRatio, Quickratio, RetainedEarningToAsset |
| `ratioCashflow` | CFOToRev, CFOToDebt, CFFToRev, CFIToRev, FCFFToRev, FCFFToNI, FCFEToRev, FCFEToNI, CAPEXToRev, CAPEXToNI, PayoutRatio |
| `valuation` | PtoE_ttm, PtoB, PtoS, PtoS_Monthly, PtoFCFF, PtoFCFE, PtoNAV, PtoD, EVtoEBIT, EVtoS, EVtoS_Monthly, DivYield |
| `growthAnnual` | `*_1YrGR`, `*_3YrGR`, `*_5YrGR`, `*_{3,5,7,9,11}yrGR`، `*_yrGR_Arith`، رشد حاشیه‌های TTM سالانه |
| `growthQuarterly` | `*QtrlyGR_QoQ/YoY`، `*_{3,5,7,9,11}qGR`، `*_qGR_Arith`، رشد حاشیه‌های MRQ |
| `growthMonthly` | Rev_1MGR, Rev_{3,5,7,9}MGR, Rev_{3,5,7,9}MGR_Arith, RevCumMonthlyGR_YoY, Prod_Mo3MAvgGR |
| `returns` | Ret_1D, Ret_1W, Ret_1M, Ret_3M, Ret_6M, Ret_YTD, Ret_1Yr, Ret_3Y, Ret_5Y, Custom-Return |
| `risk` | StdDev_90D/60W/36M, SemiStdDev_*, RelativeRange_1D/1W/1M/1Y, Beta_90D/60W/36M, Correlation_90D/60W/36M, natr, atr |
| `liquidity` | CurrentVolume, CurrentValue, AvgVol_{3D…1Yr}, AvgVal_{3D…1Yr}, Turnover, TradeRatio, Amihud_30d/90d |
| `flow` | Individual/InstitutionalPerCapital, Individual/InstitutionalBuyPower, NetIndividual(Volume/Value), NetInstitutional(Volume/Value), BidPressure |
| `technicalTrend` | SMA/EMA/DEMA/TEMA/WMA/TRIMA (20/50/100/200)، kama30, mama, fama, adx, adxr, dx, plus_di, minus_di, aroon*, sar, linearreg*, tsf, ht_trendmode |
| `technicalMomentum` | RSI, macd*, ppo, apo, mom, roc*, cci, cmo, trix, stochastic_*, willr, ultosc, DeMarker, bop |
| `technicalVolume` | obv, ad, adosc, MFI |
| `technicalLevels` | bubands/bmbands/blbands، midpoint*/midprice*، pp_* (standard, fibonacci, demark, camarilla, woodie)، High_/Low_ 20/50/200D |
| `technicalCycle` | ht_dcperiod, ht_dcphase, ht_phasor_*, ht_sine* |

**ستون ناشناخته (جدید):** اگر روزی ستونی آمد که در Dictionary نیست، خودکار با `category: 'uncategorized'` و `label = id` ثبت شود، در صفحه سلامت داده اعلام شود، و **بلافاصله در فیلتر و جدول قابل استفاده باشد.**

**ستون ضروری حذف‌شده:** اگر ستونی که در پروفایل‌ها استفاده شده حذف شود، متریک‌های وابسته `null` می‌شوند، وزنشان بین بقیه بازتوزیع می‌شود (بخش ۶.۵) و هشدار داده می‌شود. برنامه **نباید** کرش کند.

---

## 2. پشته فناوری (Stack)

| لایه | انتخاب | دلیل |
|---|---|---|
| زبان | **TypeScript** (strict) | ۴۴۵ ستون و ده‌ها فرمول؛ تایپ قوی از خطا جلوگیری می‌کند. |
| ابزار ساخت | **Vite** + `vite-plugin-singlefile` | خروجی نهایی **یک فایل `index.html`** که بدون سرور با دابل‌کلیک باز می‌شود. |
| UI | **HTML + CSS + Vanilla TS با Web Components بومی** (بدون React) | مطابق ترجیح کاربر؛ سبک و بدون وابستگی سنگین. |
| استایل | CSS خالص با Custom Properties (Design Tokens)، CSS Grid، منطق `logical properties` برای RTL | تم‌پذیری و نگهداری ساده. |
| خواندن اکسل | **SheetJS** (`xlsx`) — نصب از تاربال رسمی `cdn.sheetjs.com` (نسخه npm قدیمی است) | استاندارد صنعتی، داخل Web Worker. |
| نمودار | **Apache ECharts 5** (tree-shaken import) | Heatmap، Radar، Treemap، Gauge، Scatter، Histogram؛ پشتیبانی RTL قابل قبول. |
| جدول | **Tabulator 6** | مرتب‌سازی، ستون ثابت، رندر مجازی، `textDirection: "rtl"`، انتخاب ستون. |
| تاریخ شمسی | تابع تبدیل اختصاصی کوچک در `core/utils/jalali.ts` (یا `jalaali-js`) | فقط تبدیل و مقایسه لازم است. |
| فونت | **Vazirmatn** (بسته npm `vazirmatn`، باندل محلی) | بدون وابستگی به اینترنت. |
| ذخیره‌سازی | **IndexedDB** (با `idb`) برای اسنپ‌شات‌ها؛ `localStorage` فقط برای ترجیحات سبک (همه داخل try/catch) | |
| تست | **Vitest** (واحد) + **Playwright** (E2E دود) | |
| کیفیت | ESLint (typescript-eslint، `eslint-plugin-boundaries`) + Prettier | اعمال مرزهای معماری. |

نسخه‌ها: آخرین نسخه پایدار هر کتابخانه در زمان شروع پروژه، قفل‌شده در `package-lock.json`.

---

## 3. معماری و ساختار پوشه‌ها

### 3.1 لایه‌ها و جهت وابستگی

```
ui  ──►  app  ──►  core  ◄── config
                     ▲
                 workers (اجرای core در Worker)
```

- **`core/`**: منطق خالص دامنه. **هیچ دسترسی به DOM، window، storage ندارد.** کاملاً تست‌پذیر. ورودی/خروجی داده ساده.
- **`config/`**: تعاریف اعلانی (ستون‌ها، متریک‌ها، فاکتورها، پروفایل‌ها، پریست فیلتر، تم). فقط داده + تایپ.
- **`app/`**: هماهنگ‌کننده (use-cases): بارگذاری فایل، اجرای پایپ‌لاین، Store وضعیت، ذخیره‌سازی، تاریخچه.
- **`ui/`**: کامپوننت‌ها و صفحات. فقط از `app` (و تایپ‌های `core`) استفاده می‌کند؛ هرگز مستقیم موتور امتیاز را صدا نمی‌زند.
- **`workers/`**: پارس اکسل + پایپ‌لاین امتیازدهی در Web Worker تا UI روان بماند.

### 3.2 ساختار پوشه‌ها

```
bourse-view-filters/
├─ CLAUDE.md
├─ PLAN.md                         # همین فایل
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
├─ data/samples/screener-plus-1405-08-04.xlsx   # فایل نمونه کاربر (fixture)
├─ src/
│  ├─ main.ts                      # bootstrap
│  ├─ config/
│  │  ├─ columns.ts                # Data Dictionary (بخش 1.3)
│  │  ├─ derivedMetrics.ts         # پارامترهای مشتق (بخش 5)
│  │  ├─ profiles/
│  │  │  ├─ technical.ts
│  │  │  ├─ fundamentalLong.ts
│  │  │  ├─ fundamentalQuarterly.ts
│  │  │  ├─ fundamentalMonthly.ts
│  │  │  └─ index.ts
│  │  ├─ marketRisk.ts
│  │  ├─ industryOverrides.ts      # تنظیم ویژه بانک/بیمه/سرمایه‌گذاری/لیزینگ
│  │  ├─ filterPresets.ts
│  │  ├─ assumptions.ts            # تورم، نرخ بدون ریسک، … (قابل ویرایش در تنظیمات)
│  │  └─ theme.ts                  # پالت نمودارها همگام با CSS tokens
│  ├─ core/
│  │  ├─ types.ts                  # StockRow, MetricDef, FactorDef, ProfileDef, Score…
│  │  ├─ data/
│  │  │  ├─ normalizeHeaders.ts
│  │  │  ├─ parseValue.ts          # '-' → null، عدد/رشته
│  │  │  ├─ buildDataset.ts        # ستون‌محور (columnar) Float64Array + mask
│  │  │  ├─ schemaValidator.ts     # گزارش سلامت داده
│  │  │  └─ snapshotDate.ts        # استخراج تاریخ از نام فایل
│  │  ├─ metrics/
│  │  │  ├─ registry.ts            # ثبت و حل وابستگی (topological sort)
│  │  │  └─ helpers.ts             # safeDiv, realGrowth, annualize, clamp…
│  │  ├─ scoring/
│  │  │  ├─ normalizers.ts         # percentile, band, boolean, inverse…
│  │  │  ├─ peerGroups.ts          # صنعت/بخش/بازار
│  │  │  ├─ factorEngine.ts
│  │  │  ├─ profileEngine.ts
│  │  │  ├─ grades.ts
│  │  │  └─ flags.ts               # Turnaround، داده کهنه، …
│  │  ├─ market/
│  │  │  └─ marketRiskEngine.ts
│  │  ├─ filters/
│  │  │  ├─ lexer.ts
│  │  │  ├─ parser.ts              # Pratt parser → AST
│  │  │  ├─ ast.ts
│  │  │  ├─ analyzer.ts            # اعتبارسنجی نام‌ها، تشخیص توابع تجمعی
│  │  │  ├─ evaluator.ts           # برداری روی کل دیتاست
│  │  │  ├─ functions.ts           # کتابخانه توابع
│  │  │  ├─ builderModel.ts        # مدل درختی سازنده بصری ↔ AST
│  │  │  └─ errors.ts              # پیام‌های خطای فارسی با موقعیت
│  │  └─ utils/ (jalali.ts, format.ts, stats.ts)
│  ├─ app/
│  │  ├─ store.ts                  # Store ساده observable (pub/sub)
│  │  ├─ pipeline.ts               # load → normalize → derive → score → market
│  │  ├─ workerClient.ts
│  │  ├─ persistence/ (snapshotRepo.ts, settingsRepo.ts, presetsRepo.ts, customMetricsRepo.ts)
│  │  └─ services/ (exportService.ts, historyService.ts)
│  ├─ workers/pipeline.worker.ts
│  ├─ ui/
│  │  ├─ styles/ (tokens.css, base.css, layout.css, components.css)
│  │  ├─ components/               # <bv-kpi-card>, <bv-score-badge>, <bv-data-table>, <bv-chart>, <bv-filter-builder>, <bv-expression-editor>, <bv-drawer>, <bv-factor-bar>…
│  │  ├─ pages/                    # overview, technical, market-risk, long-term, quarterly, monthly, filter-studio, stock-detail, settings, data-health
│  │  ├─ charts/                   # factory های ECharts: radar.ts, heatmap.ts, scatterQuadrant.ts, histogram.ts, treemap.ts, gauge.ts
│  │  └─ router.ts                 # hash router ساده
│  └─ i18n/fa.ts                   # همه رشته‌های UI
└─ tests/
   ├─ unit/ (parseValue, headers, metrics, normalizers, factorEngine, lexer, parser, evaluator, jalali)
   ├─ golden/                      # خروجی امتیاز ۱۰ نماد نمونه از فایل fixture
   └─ e2e/smoke.spec.ts
```

### 3.3 مدل داده درون‌حافظه

داده به‌صورت **ستون‌محور** نگه داشته شود (هر ستون عددی = `Float64Array` با `NaN` برای null) تا فیلتر و امتیازدهی برداری و سریع باشد. ستون‌های متنی آرایه `string[]`.

```ts
interface Dataset {
  snapshotDate: JalaliDate;            // از نام فایل یا ورودی کاربر
  symbols: string[];                   // کلید اصلی، اندیس i
  text: Record<string, string[]>;      // Company, Sector, Industry, Exchange …
  num: Record<string, Float64Array>;   // خام + مشتق + امتیاز + فاکتور
  meta: Record<string, FieldMeta>;     // label, unit, category, source: 'raw'|'derived'|'custom'|'score'
}
```

---

## 4. خط لوله داده (Data Pipeline)

اجرا در Worker؛ هر مرحله یک تابع خالص:

1. **Read**: `ArrayBuffer` → SheetJS → آرایه سطرها (شیت اول).
2. **Normalize headers**: حذف `\n`/فاصله، حذف ستون‌های بی‌نام-تماماً‌خالی، حل alias.
3. **Parse values**: `'-'`، `'----'`، `''`، `'N/A'` → `null`؛ رشته عددی → عدد؛ درصد متنی → کسر.
4. **Validate** (`schemaValidator`): ستون‌های ضروری موجود؟ ستون‌های جدید؟ نمادهای تکراری؟ پوشش هر ستون (٪ غیرخالی)؟ مقادیر نامعقول (مثلاً MarketCap ≤ 0)؟ → `DataHealthReport`.
5. **Build dataset** ستون‌محور.
6. **Derive**: محاسبه پارامترهای مشتق سیستمی (بخش ۵) و سپس پارامترهای سفارشی کاربر به ترتیب وابستگی.
7. **Score**: چهار پروفایل (بخش ۶–۱۰) + پرچم‌ها.
8. **Market**: پروفایل ریسک بازار (بخش ۷.۳).
9. **Diff** با اسنپ‌شات قبلی (بخش ۱۳): نماد جدید/حذف‌شده، تغییر امتیازها.
10. بازگشت به thread اصلی → Store → رندر.

**تاریخ اسنپ‌شات:** از نام فایل با regex `(\d{4})-(\d{2})-(\d{2})` (شمسی). اگر پیدا نشد، دیالوگ انتخاب تاریخ.

**عملکرد هدف:** کل پایپ‌لاین برای ~۱۰۰۰ نماد × ۴۵۰ ستون < ۱٫۵ ثانیه؛ بازمحاسبه امتیاز پس از تغییر وزن < ۲۰۰ms (debounce ۳۰۰ms).

---

## 5. رجیستری پارامترهای مشتق (Derived Metrics)

### 5.1 قرارداد تعریف

```ts
interface MetricDef {
  id: string;                    // 'D_DebtToRev'  (پیشوند D_ برای مشتق سیستمی، C_ برای سفارشی کاربر)
  label: string;                 // 'بدهی مالی به فروش'
  category: Category;
  unit: 'ratio' | 'percent' | 'rial' | 'days' | 'times' | 'price' | 'score' | 'flag';
  horizon?: 'long' | 'quarter' | 'month' | 'technical';
  direction: 'higher' | 'lower' | 'band' | 'neutral';
  requires: string[];            // ستون‌های لازم — برای حل وابستگی و گزارش
  compute: (r: RowAccessor, ctx: MetricContext) => number | null;  // سیستمی
  // یا:
  expression?: string;           // برای متریک‌های سفارشی کاربر (همان زبان فیلتر)
  description: string;           // فرمول و تفسیر، در Tooltip نمایش داده شود
}
```

**قوانین محاسبه:**
- `safeDiv(a, b)` → اگر `b` صفر/null باشد `null`.
- نسبت‌هایی که مخرج منفی بی‌معنی دارد (مثل P/E با سود منفی): به‌جای `null` مقدار ویژه `NEGATIVE_BASE` برگردانده شود تا نرمال‌ساز آن را در **بدترین** صدک قرار دهد (نه حذف).
- **تعدیل تورم** (`ctx.assumptions.inflation`، پیش‌فرض قابل ویرایش ۳۵٪ سالانه):
  - `realGrowth(g, years=1) = (1+g)/(1+π) − 1` برای رشد سالانه/CAGR.
  - برای رشد فصلی QoQ از `π_q = (1+π)^(1/4) − 1` و برای ماهانه MoM از `π_m = (1+π)^(1/12) − 1`.
  - در تنظیمات کلید «رشد اسمی / واقعی» وجود دارد؛ پیش‌فرض: **واقعی** در امتیازدهی، **اسمی** در نمایش خام.
- `ctx.assumptions.riskFreeRate` (نرخ بازده بدون ریسک / YTM اوراق، قابل ویرایش، پیش‌فرض ۳۰٪) برای «اسپرد بازده سود».

### 5.2 فهرست پارامترهای مشتق سیستمی

#### الف) ترازنامه، اهرم و نقدینگی (بلندمدت)

| id | عنوان | فرمول | جهت |
|---|---|---|---|
| `D_Debt` | بدهی مالی (تسهیلات) | `DebtRatio × TA_MRQ` | — |
| `D_DebtToRev` | **بدهی مالی به فروش** | `D_Debt / Rev_TTM` | کمتر بهتر |
| `D_TLToRev` | کل بدهی به فروش | `TL_MRQ / Rev_TTM` | کمتر |
| `D_DebtToMcap` | بدهی مالی به ارزش بازار | `D_Debt / MarketCap` | کمتر |
| `D_EV` | ارزش شرکت (تقریبی، بدون کسر وجه نقد) | `MarketCap + D_Debt` | — |
| `D_DebtToOP` | سال‌های بازپرداخت بدهی با سود عملیاتی | `D_Debt / OP_TTM` (OP≤0 → NEGATIVE_BASE) | کمتر |
| `D_FEtoOP` | هزینه مالی به سود عملیاتی | `FE_TTM / OP_TTM` | کمتر |
| `D_FEtoRev` | هزینه مالی به فروش | `FE_TTM / Rev_TTM` | کمتر |
| `D_EquityToAsset` | نسبت مالکانه | `TSE_MRQ / TA_MRQ` | بیشتر |
| `D_ROIC` | بازده سرمایه به‌کاررفته (تقریبی) | `EBIT × (1 − ETR) / (TSE_MRQ + D_Debt)` | بیشتر |
| `D_AltmanZ_approx` | Altman Z تعدیل‌شده (بدون جزء سرمایه در گردش) | `3.3·EBIT/TA + 0.6·MarketCap/TL + 1.0·Rev_TTM/TA + 1.4·RE/TA` (TA=TA_MRQ، RE=RE_MRQ) | بیشتر |
| `D_CCC_approx` | چرخه تبدیل (بدون دوره پرداخت) | `InvTurnoverDay + ReceivableTurnoverDay` | کمتر |

#### ب) کیفیت سود و جریان نقد

| id | عنوان | فرمول | جهت |
|---|---|---|---|
| `D_CFO` | جریان نقد عملیاتی TTM | `CFOToRev × Rev_TTM` | — |
| `D_CFOtoNI` | **کیفیت سود** (نقد به سود) | `D_CFO / NI_TTM` (فقط NI>0) | بیشتر (باند ۰٫۸–۲) |
| `D_Accruals` | اقلام تعهدی به دارایی | `(NI_TTM − D_CFO) / TA_MRQ` | کمتر |
| `D_FCFF` | جریان نقد آزاد شرکت | `FCFFToRev × Rev_TTM` | — |
| `D_FCFFYield` | بازده جریان نقد آزاد | `D_FCFF / MarketCap` | بیشتر |
| `D_FxShareNI` | سهم سود/زیان ارزی از سود | `NetFx_IRR / |NI_TTM|` | نزدیک صفر بهتر (کیفیت) |

#### ج) ارزش‌گذاری

| id | عنوان | فرمول | جهت |
|---|---|---|---|
| `D_EarningsYield` | بازده سود | `NI_TTM / MarketCap` | بیشتر |
| `D_EYSpread` | اسپرد بازده سود به نرخ بدون ریسک | `D_EarningsYield − riskFreeRate` | بیشتر |
| `D_PEG_approx` | PEG تقریبی | `PtoE_ttm / (realGrowth(NI_3YrGR)×100)` (رشد ≤ ۰ → NEGATIVE_BASE) | کمتر |
| `D_OPYieldEV` | بازده عملیاتی بر EV | `OP_TTM / D_EV` | بیشتر |

#### د) روند ترازنامه (مقایسه MRQ با FY — میان‌مدت)

| id | عنوان | فرمول | جهت |
|---|---|---|---|
| `D_dTL` | رشد بدهی از پایان سال | `TL_MRQ / TL_FY − 1` | کمتر |
| `D_dTA` | رشد دارایی از پایان سال | `TA_MRQ / TA_FY − 1` | بیشتر |
| `D_dEquity` | رشد حقوق صاحبان سهام | `TSE_MRQ / TSE_FY − 1` | بیشتر |
| `D_dLevGap` | تغییر نسبت بدهی | `TL_MRQ/TA_MRQ − TL_FY/TA_FY` | کمتر |
| `D_dRE` | تغییر سود انباشته به دارایی | `(RE_MRQ − RE_FY) / TA_MRQ` | بیشتر |

#### ه) فصلی (میان‌مدت)

| id | عنوان | فرمول | جهت |
|---|---|---|---|
| `D_NI_MRQ_toTTM` | **سهم سود فصل آخر از سود ۱۲ ماهه** | `NI_MRQ / NI_TTM` (خنثی ≈ ۰٫۲۵) | بیشتر |
| `D_NI_MRQ_toFY` | **نسبت سود فصل آخر به سود سال مالی** | `NI_MRQ / NI_FY` | بیشتر |
| `D_NI_RunRate` | سود فصل سالانه‌شده به TTM | `NI_MRQ × 4 / NI_TTM` | بیشتر |
| `D_Rev_RunRateQ` | فروش فصل سالانه‌شده به TTM | `Rev_MRQ × 4 / Rev_TTM` | بیشتر |
| `D_FwdEY_Q` | **سود فصل سالانه‌شده به ارزش بازار** | `NI_MRQ × 4 / MarketCap` | بیشتر |
| `D_FwdPE_Q` | P/E پیش‌رو بر پایه فصل | `MarketCap / (NI_MRQ × 4)` | کمتر |
| `D_RevYield_Q` | فروش فصل سالانه‌شده به ارزش بازار | `Rev_MRQ × 4 / MarketCap` | بیشتر |
| `D_OPYield_Q` | سود عملیاتی فصل سالانه‌شده به EV | `OP_MRQ × 4 / D_EV` | بیشتر |
| `D_dNPMargin_Q` | بهبود حاشیه خالص فصل نسبت به TTM | `NPMarginMRQ − NPMargin` | بیشتر |
| `D_dGPMargin_Q` | بهبود حاشیه ناخالص فصل | `GPMarginMRQ − GPMargin` | بیشتر |
| `D_dOPMargin_Q` | بهبود حاشیه عملیاتی فصل | `OPMarginMRQ − OPMargin` | بیشتر |
| `D_DebtToRev_Q` | بدهی مالی به فروش فصل سالانه‌شده | `D_Debt / (Rev_MRQ × 4)` | کمتر |
| `D_FEtoOP_Q` | هزینه مالی فصل به سود عملیاتی فصل | `FE_MRQ / OP_MRQ` | کمتر |
| `D_NonOpShare_Q` | سهم سود غیرعملیاتی فصل | `(NI_MRQ − OP_MRQ × (1 − ETR) + FE_MRQ×(1−ETR)) / |NI_MRQ|` | کمتر (کیفیت) |
| `D_NI_PrevQ_est` | تخمین سود فصل قبل | `NI_MRQ / (1 + NIQtrlyGR_QoQ)` | — |
| `D_StatementAgeDays` | عمر آخرین صورت مالی | `snapshotDate − LastStatementDate` (روز) | کمتر |

#### و) ماهانه (کوتاه‌مدت)

| id | عنوان | فرمول | جهت |
|---|---|---|---|
| `D_Rev1M_toAvg12` | **درآمد ماه آخر به میانگین ماهانه ۱۲ ماه** | `Rev_1M / (Rev_TTM / 12)` | بیشتر |
| `D_Rev1M_toAvg12_real` | همان، تعدیل تورم | `D_Rev1M_toAvg12 / (1+π)^(6.5/12)` (میانه پنجره TTM ≈ ۶٫۵ ماه قبل) | بیشتر (>۱ یعنی رشد واقعی) |
| `D_Rev1M_toQAvg` | **درآمد ماه آخر به میانگین ماهانه فصل آخر** | `Rev_1M / (Rev_MRQ / 3)` | بیشتر |
| `D_Rev1M_toFYAvg` | درآمد ماه آخر به میانگین ماهانه سال مالی | `Rev_1M / (Rev_FY / 12)` | بیشتر |
| `D_Rev1M_toNI_FY` | **درآمد ماه به سود سال** | `Rev_1M / NI_FY` | بیشتر (اهرم درآمد بر سود) |
| `D_RevYield_M` | درآمد ماه سالانه‌شده به ارزش بازار | `Rev_1M × 12 / MarketCap` | بیشتر |
| `D_ImpliedNI_M` | **سود ضمنی سالانه از درآمد ماه** | `Rev_1M × 12 × NPMarginMRQ` (اگر خالی: `NPMargin`) | — |
| `D_ImpliedPE_M` | P/E ضمنی ماهانه | `MarketCap / D_ImpliedNI_M` | کمتر |
| `D_ImpliedEarnGrowth_M` | رشد ضمنی سود نسبت به سود سال | `D_ImpliedNI_M / NI_FY − 1` | بیشتر |
| `D_RevAccel_M` | شتاب درآمد ماهانه | `Rev_1MGR − Rev_3MGR` | بیشتر |
| `D_RevConsistency_M` | ثبات رشد ماهانه | `1 − |Rev_3MGR_Arith − Rev_3MGR| / (|Rev_3MGR_Arith| + |Rev_3MGR| + ε)` | بیشتر |

#### ز) تکنیکال (نرمال‌سازی‌شده تا بین نمادها قابل مقایسه شوند)

| id | فرمول | تفسیر |
|---|---|---|
| `D_PxToSMA20/50/200` | `Price / SMA_xD − 1` | فاصله از میانگین |
| `D_MAAlignment` | میانگین بولی‌های: `Price>SMA_20D`، `SMA_20D>SMA_50D`، `SMA_50D>SMA_200D`، `EMA_50D>EMA_200D`، `Price>sar` | ۰ تا ۱ |
| `D_DirectionalADX` | `((plus_di − minus_di)/(plus_di + minus_di)) × min(adx/25, 1)` | −۱ تا +۱ |
| `D_RegSlopeNorm` | `linearreg_slope / Price` | شیب نرمال |
| `D_MACDHistNorm` | `macdHistogram / Price` | |
| `D_BollingerPctB` | `(Price − blbands) / (bubands − blbands)` | ۰=باند پایین، ۱=بالا |
| `D_PivotPos` | `(Price − pp_standard_s1) / (pp_standard_r1 − pp_standard_s1)` | موقعیت بین حمایت و مقاومت |
| `D_PxToVWAP1M` | `Price / AvgVWAP_1M − 1` | |
| `D_VolSurge_5_90` | `AvgVol_5D / AvgVol_90D` | ورود حجم |
| `D_VolSurge_20_1Y` | `AvgVol_20D / AvgVol_1Yr` | |
| `D_VolToday_30` | `CurrentVolume / AvgVol_30D` | |
| `D_LogLiquidity` | `log10(AvgVal_20D)` | |
| `D_NetIndToVal` | `NetIndividualValue / AvgVal_20D` | ورود پول حقیقی نسبت به نقدشوندگی |
| `D_ADOscNorm` | `adosc / AvgVol_20D` | |
| `D_DownsideRatio` | `SemiStdDev_90D / StdDev_90D` | سهم نوسان نزولی |
| `D_BetaDeviation` | `|Beta_60W − 1|` | |

> هر متریک باید **یک تست واحد** با یک سطر دستی و یک سطر لبه (null، صفر، منفی) داشته باشد.

---

## 6. موتور امتیازدهی (Scoring Engine)

### 6.1 سلسله‌مراتب

```
Profile (امتیاز نهایی 0–100)
 └─ Factor (4 تا 8 عدد، هر کدام 0–100، وزن‌دار)
     └─ Metric (ستون خام یا مشتق، نرمال‌شده به 0–100، وزن‌دار)
```

### 6.2 قرارداد اعلانی

```ts
type NormalizerSpec =
  | { kind: 'percentile'; direction: 'higher' | 'lower' }           // پیش‌فرض
  | { kind: 'band'; ideal: [number, number]; hard: [number, number] } // مثل RSI: ایده‌آل 50–68، صفر زیر 25 و بالای 85
  | { kind: 'boolean'; trueScore?: number }
  | { kind: 'linear'; min: number; max: number; direction: 'higher' | 'lower' }; // برای مقادیر با مقیاس مطلق (مثلاً D_MAAlignment)

interface FactorMetric { metric: string; weight: number; normalizer: NormalizerSpec; }

interface FactorDef {
  id: string; label: string; weight: number; description: string;
  metrics: FactorMetric[];
  peerScope?: 'market' | 'sector' | 'industry';  // پیش‌فرض از پروفایل
  minCoverage?: number;                            // پیش‌فرض 0.5 از وزن متریک‌ها
}

interface ProfileDef {
  id: 'technical' | 'fundamentalLong' | 'fundamentalQuarterly' | 'fundamentalMonthly' | string;
  label: string;
  defaultPeerScope: 'market' | 'sector' | 'industry';
  peerBlend?: number;            // مثلاً 0.5 = نیمی صدک بازار، نیمی صدک صنعت
  factors: FactorDef[];          // 4 ≤ length ≤ 8 — با assertion در زمان بارگذاری
  minCoverage: number;           // پیش‌فرض 0.6 از وزن فاکتورها
  eligibility?: (row) => boolean // مثلاً پروفایل ماهانه فقط برای نمادهای دارای Rev_1M
  weightPresets?: Record<string, Record<string, number>>; // «متعادل»، «تهاجمی»، «محافظه‌کار»
}
```

### 6.3 گروه همتا (Peer Group)
- **صدک** هر متریک درون گروه همتا محاسبه می‌شود: اگر `industry` حداقل **۱۰ مقدار معتبر** دارد همان صنعت؛ وگرنه `sector` (حداقل ۱۰)؛ وگرنه کل بازار.
- پیش‌فرض: تکنیکال → بازار؛ بنیادی‌ها → `peerBlend = 0.5` (ترکیب صنعت و بازار) تا هم شرکت‌های خوب صنعت‌های ضعیف و هم بهترین‌های کل بازار دیده شوند. در UI کلید «رتبه نسبت به: بازار / صنعت / ترکیبی».

### 6.4 نرمال‌سازی
- **Percentile rank** (رتبه‌ای، مقاوم به داده پرت و مستقل از واحد) → 0–100. مقادیر مساوی رتبه میانگین.
- `NEGATIVE_BASE` → امتیاز ۰.
- `band`: داخل بازه ایده‌آل ۱۰۰، خطی تا ۰ در مرزهای سخت.
- برای آمار تجمعی بازار (میانگین‌ها) **winsorize** در صدک ۱ و ۹۹.

### 6.5 داده ناقص
- امتیاز فاکتور = میانگین وزنی متریک‌های **موجود**؛ اگر وزن موجود < `minCoverage` → فاکتور `null`.
- امتیاز پروفایل = میانگین وزنی فاکتورهای موجود؛ اگر < `minCoverage` → پروفایل `null` (نمایش «داده ناکافی»).
- **ضریب اطمینان (Confidence)** = وزن پوشش‌داده‌شده / کل وزن؛ کنار امتیاز نمایش داده شود و قابل فیلتر باشد (`conf.long > 0.8`).
- (اختیاری در تنظیمات) کاهش امتیاز نهایی برای صورت مالی کهنه: اگر `D_StatementAgeDays > 200` ضریب ۰٫۹.

### 6.6 درجه‌بندی و برچسب

| امتیاز | درجه | برچسب |
|---|---|---|
| ≥ ۸۰ | A | عالی |
| ۶۵–۸۰ | B | خوب |
| ۵۰–۶۵ | C | متوسط |
| ۳۵–۵۰ | D | ضعیف |
| < ۳۵ | E | بسیار ضعیف |

### 6.7 خروجی برای هر نماد
فیلدهای قابل فیلتر: `score.<profile>`، `factor.<profile>.<factorId>`، `conf.<profile>`، `rank.<profile>` (رتبه در بازار)، `rankInIndustry.<profile>`، `grade.<profile>`، `flag.<flagId>`، و `score.composite`.

### 6.8 امتیاز ترکیبی (Composite)
میانگین وزنی چهار پروفایل؛ پیش‌فرض: تکنیکال ۳۰٪، بلندمدت ۳۰٪، فصلی ۲۵٪، ماهانه ۱۵٪ (اگر ماهانه null بود، وزنش بازتوزیع شود). قابل ویرایش.

### 6.9 تنظیمات ویژه صنایع مالی (`industryOverrides.ts`)
برای صنایع: «بانکها و موسسات اعتباری»، «بیمه»، «سرمایه گذاری»، «سرمایه گذاری استانی»، «لیزینگ»، «تامین سرمایه»، «فعالیتهای مرتبط با اوراق بهادار»:
- غیرفعال: فاکتور کارایی عملیاتی، CurrentRatio، Quickratio، InvTurnoverDay، D_CCC_approx، GPMargin.
- بانک/لیزینگ: متریک‌های بدهی مالی غیرفعال (بدهی جزء ماهیت کسب‌وکار است)؛ ROE و ROA وزن بیشتر.
- سرمایه‌گذاری: `PtoNAV` (کمتر بهتر) با وزن بالا به فاکتور ارزش‌گذاری اضافه شود.
- این override ها اعلانی‌اند: `{ industries: [...], disableMetrics: [...], extraMetrics: {...}, weightMultipliers: {...} }`.

---

## 7. پروفایل تکنیکال + ریسک بازار

### 7.1 فاکتورها (۷ فاکتور) — `config/profiles/technical.ts`

| # | فاکتور | وزن پیش‌فرض | متریک‌ها (نرمال‌ساز) |
|---|---|---|---|
| T1 | **روند (Trend)** | ۲۲٪ | `D_MAAlignment` (linear 0–1)، `D_DirectionalADX` (linear −1..1)، `aroonosc` (linear −100..100)، `D_RegSlopeNorm` (pct↑)، `D_PxToSMA200` (band: ایده‌آل ۰ تا ۰٫۳۵، سخت −۰٫۳ / ۰٫۸)، `D_PxToSMA50` (pct↑) |
| T2 | **مومنتوم** | ۱۸٪ | `RSI` (band ۵۰–۶۸، سخت ۲۵/۸۵)، `D_MACDHistNorm` (pct↑)، `ppo` (pct↑)، `Ret_1M`، `Ret_3M`، `Ret_6M` (pct↑ = قدرت نسبی)، `cci` (band ۰–۱۵۰)، `stochastic_slowk` (band ۴۰–۸۰)، `ultosc` (band ۵۰–۷۰)، `trix` (pct↑) |
| T3 | **حجم و نقدشوندگی** | ۱۲٪ | `D_VolSurge_5_90` (band ۱٫۱–۲٫۵)، `D_VolSurge_20_1Y` (pct↑)، `D_VolToday_30` (pct↑)، `D_LogLiquidity` (pct↑)، `Turnover` (pct↑)، `Amihud_30d` (pct↓ = نقدشوندگی بهتر) |
| T4 | **جریان پول هوشمند (حقیقی/حقوقی)** | ۱۶٪ | `IndividualBuyPower` (pct↑)، `NetIndividual` (pct↑)، `D_NetIndToVal` (pct↑)، `BidPressure` (pct↑)، `MFI` (band ۵۰–۸۰)، `D_ADOscNorm` (pct↑) |
| T5 | **نوسان و ریسک کل** (امتیاز بالا = ریسک کمتر) | ۱۲٪ | `StdDev_90D` (pct↓)، `SemiStdDev_90D` (pct↓)، `natr` (pct↓)، `RelativeRange_1M` (pct↓)، `D_DownsideRatio` (pct↓)، `StdDev_60W` (pct↓) |
| T6 | **موقعیت قیمت و ساختار** | ۱۰٪ | `High_200D` (pct↑ = نزدیکی به سقف/شکست)، `High_50D` (pct↑)، `D_BollingerPctB` (band ۰٫۵–۰٫۹)، `D_PivotPos` (band ۰٫۳–۰٫۸)، `D_PxToVWAP1M` (pct↑) |
| T7 | **ریسک سیستماتیک (بتا و همبستگی)** | ۱۰٪ | `Beta_60W` (pct↓)، `Beta_90D` (pct↓)، `Correlation_60W` (pct↓ = تنوع‌بخشی بیشتر)، `Beta_36M` (pct↓) |

**پریست وزن‌ها:** «متعادل» (جدول بالا)، «تهاجمی/مومنتوم» (T1/T2/T4 بیشتر، T5/T7 کمتر)، «محافظه‌کار» (T5/T7 و T3 بیشتر).

**خروجی جانبی:** «امتیاز ریسک نماد» = میانگین وزنی T5 (۵۰٪)، T7 (۳۰٪)، ریسک نقدشوندگی = 100 − صدک `Amihud_30d` معکوس (۲۰٪) → برای پروفایل ریسک بازار.

### 7.2 پرچم‌های تکنیکال (`flags.ts`)
- `flag.goldenCross`: `SMA_50D > SMA_200D` و `D_PxToSMA50 < 0.05` (نزدیک کراس) — یا اگر تاریخچه موجود، کراس واقعی.
- `flag.breakout200`: `High_200D ≥ 0.98` و `D_VolSurge_5_90 ≥ 1.5`.
- `flag.oversold`: `RSI < 30` و `willr < −80`.
- `flag.smartMoneyIn`: `NetIndividual > 0` و `IndividualBuyPower ≥ 1.5`.
- `flag.illiquid`: `AvgVal_20D` کمتر از آستانه تنظیمات.

### 7.3 پروفایل ریسک کل بازار — `config/marketRisk.ts`، `core/market/marketRiskEngine.ts`

**دو روش وزن‌دهی (کلید در UI):** هم‌وزن (Equal-weight) و وزن ارزش بازار (Cap-weight)؛ گزینه سوم: ریشه دوم ارزش بازار (√Cap، برای کاهش اثر نمادهای بسیار بزرگ).

| مؤلفه | محاسبه | تفسیر ریسک |
|---|---|---|
| **میانگین امتیاز ریسک نمادها** | میانگین وزنی امتیاز ریسک (بخش ۷.۱) | بالا = ریسک کمتر |
| **پهنای بازار (Breadth)** | ٪ نمادهای `Price > SMA_50D`، ٪ `Price > SMA_200D`، نسبت مثبت‌ها به منفی‌ها از `DailyChange` | پهنای کم = ریسک بالا |
| **اشباع** | ٪ `RSI > 70` و ٪ `RSI < 30` | |
| **جریان پول حقیقی کل بازار** | Σ `NetIndividualValue` (و به تفکیک بخش) | خروج پول = ریسک |
| **نوسان بازار** | میانگین وزنی `StdDev_90D` و `natr` | |
| **ریسک سیستماتیک** | میانگین وزنی `Beta_60W` و `Correlation_60W` | همبستگی بالا = ریسک سیستمی |
| **بازده** | میانگین وزنی `Ret_1W`، `Ret_1M`، `Ret_3M` | |
| **نزدیکی به سقف** | ٪ نمادهای `High_200D > 0.95` | |
| **پراکندگی** | انحراف معیار مقطعی `Ret_1M` | |

**شاخص نهایی «دماسنج ریسک بازار» (۰–۱۰۰، بالا = پرریسک):** ترکیب وزنی مؤلفه‌ها پس از تبدیل به مقیاس ۰–۱۰۰. تا قبل از وجود تاریخچه، تبدیل با آستانه‌های مطلق قابل تنظیم انجام شود؛ پس از ۲۰ اسنپ‌شات، تبدیل بر اساس **صدک نسبت به تاریخچه خودِ بازار** (بخش ۱۳).
رژیم‌ها: `< ۳۰` کم‌ریسک، `۳۰–۵۵` متعادل، `۵۵–۷۵` پرریسک، `> ۷۵` بحرانی.
همین محاسبه **به تفکیک Sector** هم انجام شود (برای Heatmap).

---

## 8. پروفایل بنیادی بلندمدت (۸ فاکتور) — `fundamentalLong.ts`

**هدف:** ارزیابی کیفیت عملیات و سلامت مالی شرکت در افق چندساله، بر پایه صورت سود و زیان (سالانه/TTM)، ترازنامه و جریان وجوه نقد.

| # | فاکتور | وزن | متریک‌ها |
|---|---|---|---|
| L1 | **سودآوری** | ۲۰٪ | `ROE`، `ROA`، `D_ROIC`، `NPMargin`، `OPMargin`، `GPMargin` (همه pct↑) |
| L2 | **رشد بلندمدت (واقعی)** | ۱۸٪ | realGrowth: `Rev_3YrGR`، `Rev_5YrGR`، `NI_3YrGR`، `NI_5YrGR`، `OP_3YrGR`، `OP_5YrGR`، `GP_5YrGR` (pct↑) |
| L3 | **پایداری و کیفیت رشد** | ۱۰٪ | رشد بسیار بلندمدت: `Rev_7yrGR`، `Rev_9yrGR`، `NI_7yrGR`؛ روند حاشیه: `GP_Margin_TTM_5yGR`، `OP_Margin_TTM_5yGR`، `NP_Margin_TTM_5yGR` (pct↑)؛ ثبات: `1 − |Rev_5yrGR_Arith − Rev_5YrGR| / …` (مشتق `D_GrowthConsistency_5y`) |
| L4 | **سلامت مالی و اهرم** | ۱۶٪ | `LiabilityToAsset` ↓، `LiabilityToEquity` ↓، `DebtToEquity` ↓، **`D_DebtToRev` ↓**، `D_DebtToOP` ↓، `ICR` ↑، `D_FEtoOP` ↓، `CurrentRatio` (band ۱٫۲–۳)، `Quickratio` ↑، `D_AltmanZ_approx` ↑ |
| L5 | **کیفیت سود و جریان نقد** | ۱۲٪ | `CFOToRev` ↑، `D_CFOtoNI` (band ۰٫۸–۲)، `D_Accruals` ↓، `FCFFToRev` ↑، `FCFEToRev` ↑، `CFOToDebt` ↑، `|D_FxShareNI|` ↓ |
| L6 | **کارایی عملیاتی** | ۸٪ | `AssetTurnover` ↑، `FixedAssetTO` ↑، `InvTurnoverDay` ↓، `ReceivableTurnoverDay` ↓، `D_CCC_approx` ↓ |
| L7 | **ارزش‌گذاری** | ۱۲٪ | `PtoE_ttm` ↓ (سود منفی = بدترین)، `PtoB` ↓، `PtoS` ↓، `EVtoEBIT` ↓، `PtoFCFF` ↓، `D_EYSpread` ↑، `D_PEG_approx` ↓، (`PtoNAV` ↓ برای سرمایه‌گذاری‌ها) |
| L8 | **بازده سهامدار** | ۴٪ | `DivYield` ↑، `PayoutRatio` (band ۰٫۳–۰٫۸۵)، `RetainedEarningToAsset` ↑ |

**امتیاز پیوتروسکی ساده‌شده (`D_PiotroskiLite`، ۰ تا ۷) — نمایش به‌صورت Badge و قابل فیلتر:**
1. `ROA > 0` 2. `D_CFO > 0` 3. `D_CFO > NI_TTM` 4. `NI_TTM/TA_MRQ > NI_FY/TA_FY` (بهبود ROA) 5. `TL_MRQ/TA_MRQ < TL_FY/TA_FY` (کاهش اهرم) 6. `GPMargin > GP_FY/Rev_FY` (بهبود حاشیه) 7. `Rev_TTM/TA_MRQ > Rev_FY/TA_FY` (بهبود گردش دارایی).

پریست‌ها: «متعادل»، «کیفیت» (L1, L4, L5 بیشتر)، «رشد» (L2, L3)، «ارزش» (L7 بیشتر).

---

## 9. پروفایل بنیادی میان‌مدت — فصلی (۷ فاکتور) — `fundamentalQuarterly.ts`

**هدف:** کشف شرکت‌هایی که **در فصل آخر متحول شده‌اند** و ارزش بررسی بیشتر دارند.

| # | فاکتور | وزن | متریک‌ها |
|---|---|---|---|
| Q1 | **جهش سود فصل** | ۲۲٪ | `NIQtrlyGR_QoQ`، `NIQtrlyGR_YoY` (real)، `OPQtrlyGR_QoQ`، `OPQtrlyGR_YoY`، `GPQtrlyGR_YoY`، `D_NI_RunRate`، **`D_NI_MRQ_toFY`**، **`D_NI_MRQ_toTTM`** |
| Q2 | **رشد فروش فصل** | ۱۴٪ | `RevQtrlyGR_QoQ`، `RevQtrlyGR_YoY` (real)، `D_Rev_RunRateQ` |
| Q3 | **بهبود حاشیه سود فصل** | ۱۶٪ | `D_dNPMargin_Q`، `D_dGPMargin_Q`، `D_dOPMargin_Q`، `NP_Margin_MRQ_QrtlyGR_YoY`، `GP-Margin-MRQ-QrtlyGR-YoY`، `OP-Margin-MRQ-QrtlyGR-YoY`، سطح `NPMarginMRQ` |
| Q4 | **ارزش‌گذاری بر پایه فصل** | ۱۶٪ | **`D_FwdEY_Q`** ↑، `D_FwdPE_Q` ↓، `D_RevYield_Q` ↑، `D_OPYield_Q` ↑ |
| Q5 | **پایداری روند چندفصلی** | ۱۰٪ | `Rev_3qGR`، `Rev_5qGR`، `NI_3qGR`، `OP_3qGR`، `GP_5qGR`، `OP-Margin-MRQ-3qGR`، `NP_Margin_MRQ_3qGR` (pct↑) — تمایز جهش یک‌باره از روند پایدار |
| Q6 | **تحولات ترازنامه و بدهی فصل** | ۱۲٪ | `D_dLevGap` ↓، `D_dTL` ↓، `D_dEquity` ↑، `D_dRE` ↑، `D_DebtToRev_Q` ↓، `D_FEtoOP_Q` ↓ |
| Q7 | **کیفیت سود فصل** | ۱۰٪ | `D_NonOpShare_Q` ↓، سهم ارزی (`NetFx_IRR / |NI_MRQ|`) ↓، `D_StatementAgeDays` ↓ |

**پرچم‌های فصلی:**
- `flag.turnaroundQ` (**تحول/بازگشت به سودآوری**): `NI_MRQ > 0` و (`NI_FY < 0` یا `D_NI_PrevQ_est < 0` یا `NIQtrlyGR_QoQ` خالی به‌دلیل پایه منفی و `NI_TTM − NI_MRQ < 0`).
- `flag.marginBreakout`: `D_dNPMargin_Q > 0.05` و `NIQtrlyGR_YoY > π`.
- `flag.earningsSurprise`: `D_NI_RunRate > 1.5`.
- `flag.staleStatement`: `D_StatementAgeDays > 200`.
- `flag.oneOffRisk`: `D_NonOpShare_Q > 0.5`.

**«شاخص تحول فصلی» (`score.qTransform`):** میانگین Q1، Q3 و Q2 (وزن ۵۰/۳۰/۲۰) — مستقل از ارزش‌گذاری، برای فهرست «متحول‌شده‌های فصل».

---

## 10. پروفایل بنیادی کوتاه‌مدت — ماهانه (۶ فاکتور) — `fundamentalMonthly.ts`

**هدف:** کشف شرکت‌هایی که **در ماه آخر متحول شده‌اند**. `eligibility`: فقط نمادهای دارای `Rev_1M` معتبر (~۷۰٪)؛ بقیه «گزارش ماهانه ندارد».

| # | فاکتور | وزن | متریک‌ها |
|---|---|---|---|
| M1 | **مومنتوم درآمد ماهانه** | ۲۲٪ | `Rev_1MGR` (real)، `Rev_3MGR`، `Rev_5MGR`، `D_RevAccel_M` |
| M2 | **درآمد ماه نسبت به گذشته (Run-rate)** | ۲۴٪ | **`D_Rev1M_toAvg12_real`**، **`D_Rev1M_toQAvg`**، `D_Rev1M_toFYAvg` |
| M3 | **رشد تجمعی سالانه** | ۱۴٪ | `RevCumMonthlyGR_YoY` (real)، `Rev_7MGR`، `Rev_9MGR` |
| M4 | **ارزش‌گذاری بر پایه درآمد ماهانه** | ۱۶٪ | `PtoS_Monthly` ↓، `EVtoS_Monthly` ↓، `D_RevYield_M` ↑ |
| M5 | **سود ضمنی** | ۱۶٪ | `D_ImpliedPE_M` ↓، `D_ImpliedEarnGrowth_M` ↑، **`D_Rev1M_toNI_FY`** ↑ |
| M6 | **ثبات** | ۸٪ | `D_RevConsistency_M`، `Rev_3MGR_Arith`، `Rev_5MGR_Arith`؛ (`Prod_Mo3MAvgGR` در صورت پر بودن — در نمونه فعلی خالی است) |

**ملاحظه فصلی‌بودن (Seasonality):** رشد ماه‌به‌ماه در ایران فصلی است (اسفند/فروردین). بنابراین وزن M2 و M3 (مقایسه با میانگین و YoY) بیشتر از MoM خالص است. یک تنظیم «حالت فصلی‌بودن» نیز در نظر گرفته شود که در فروردین وزن `Rev_1MGR` را کاهش دهد.

**پرچم‌های ماهانه:**
- `flag.recordMonth`: `D_Rev1M_toAvg12_real > 1.3` و `D_Rev1M_toQAvg > 1.15`.
- `flag.monthlyTurn`: `Rev_1MGR > 0.25` و `Rev_3MGR < 0` (برگشت روند).
- `flag.cheapOnMonthly`: `D_ImpliedPE_M < 5` و `D_ImpliedNI_M > 0`.

**«شاخص تحول ماهانه» (`score.mTransform`):** میانگین M1، M2 (۵۰/۵۰).

---

## 11. موتور فیلتر و زبان عبارت

### 11.1 الزامات
- فیلتر روی **هر** فیلد: ستون خام، مشتق سیستمی، پارامتر سفارشی، امتیاز، فاکتور، رتبه، پرچم، ضریب اطمینان، فیلدهای متنی.
- دو حالت هم‌ارز: **سازنده بصری** و **ویرایشگر عبارت متنی**، با همگام‌سازی دوطرفه (Builder → متن همیشه؛ متن → Builder اگر ساختار پشتیبانی شود، وگرنه «حالت پیشرفته»).
- **فیلتر سراسری** (روی همه صفحات اعمال می‌شود) + **فیلتر صفحه**.
- **بدون `eval`/`new Function`**: پارسر اختصاصی.

### 11.2 گرامر (EBNF)

```
expr       := orExpr
orExpr     := andExpr ( ('OR' | 'یا' | '||') andExpr )*
andExpr    := notExpr ( ('AND' | 'و' | '&&') notExpr )*
notExpr    := ('NOT' | 'نه' | '!') notExpr | compare
compare    := additive ( compOp additive
                       | 'IN' '(' literal (',' literal)* ')'
                       | 'NOT IN' '(' … ')'
                       | 'BETWEEN' additive 'AND' additive
                       | 'CONTAINS' string
                       | 'IS NULL' | 'IS NOT NULL' )?
compOp     := '>' | '>=' | '<' | '<=' | '=' | '==' | '!=' | '<>'
additive   := multiplic ( ('+'|'-') multiplic )*
multiplic  := unary ( ('*'|'/'|'%') unary )*
unary      := '-' unary | power
power      := primary ( '^' unary )?
primary    := number | string | 'true' | 'false' | 'null'
            | identifier | '[' rawName ']' | call | '(' expr ')'
number     := digits ('.' digits)? ( '%' | 'K' | 'M' | 'B' | 'T' | 'همت' )?   // 20% → 0.2 ، 5همت → 5e13 ریال
identifier := [A-Za-z_][A-Za-z0-9_.\-]*     // score.technical, factor.fundamentalLong.L4
call       := identifier '(' (expr (',' expr)*)? ')'
```

- ارقام فارسی (۰–۹) و عربی در Lexer به لاتین تبدیل شوند.
- نام ستون‌های دارای کاراکتر خاص با براکت: `[OP-Margin-MRQ-3qGR]`.
- رشته با `"..."` یا `'...'`.

### 11.3 معنای null (مثل SQL)
- عملیات حسابی با null → null. مقایسه با null → false. `IS NULL` برای بررسی صریح.
- `coalesce(x, y)` / `ifnull(x, y)` برای مقدار جایگزین.

### 11.4 کتابخانه توابع (`functions.ts`) — هر تابع: نام، امضا، توضیح فارسی، مثال

| دسته | توابع |
|---|---|
| ریاضی | `abs, min, max, log, ln, sqrt, pow, round(x, n), floor, ceil, clamp(x, lo, hi), sign` |
| null/منطق | `coalesce, ifnull, isnull, if(cond, a, b), safe_div(a, b)` |
| مالی | `real(g, periods_per_year=1)` (تعدیل تورم)، `annualize(x, periods)`، `cagr(end, start, years)` |
| مقطعی (Cross-sectional) | `pct_rank(x)` بازار، `sector_pct(x)`، `industry_pct(x)`، `zscore(x)`، `sector_avg(x)`، `sector_median(x)`، `top_n(x, n)` (بولی)، `rank(x)` |
| متن | `contains(s, sub)`، `starts_with(s, p)` |

**اجرای دو مرحله‌ای:** `analyzer` توابع مقطعی را در AST تشخیص داده، ابتدا بردار کامل آن‌ها را روی کل دیتاست (یا گروه) محاسبه و cache می‌کند، سپس ارزیابی سطری انجام می‌شود. ارزیابی **برداری** (روی `Float64Array`) پیاده شود.

### 11.5 پارامترهای سفارشی (Custom Metrics)
- کاربر تعریف می‌کند: `id` (پیشوند خودکار `C_`)، عنوان فارسی، عبارت، واحد، جهت (بالاتر بهتر/کمتر بهتر)، دسته.
  مثال: `C_QtrShare = NI_MRQ / NI_FY` ، `C_DebtToRevQ = DebtRatio * TA_MRQ / (Rev_MRQ * 4)`.
- پارامتر سفارشی می‌تواند از پارامتر سفارشی دیگر استفاده کند → **گراف وابستگی + مرتب‌سازی توپولوژیک + تشخیص حلقه** (خطای فارسی: «وابستگی چرخه‌ای: C_a → C_b → C_a»).
- بلافاصله در: انتخاب‌گر ستون جدول‌ها، فیلترها، محورهای نمودار Scatter و **ویرایشگر فاکتورها** (افزودن به یک فاکتور با وزن و جهت) در دسترس است.
- ذخیره در IndexedDB؛ **Export/Import JSON** (برای پشتیبان و انتقال).

### 11.6 سازنده بصری (`<bv-filter-builder>`)
- هر ردیف: [انتخاب فیلد با جستجو و گروه‌بندی بر اساس دسته] [عملگر متناسب با نوع] [مقدار].
- هنگام انتخاب فیلد عددی: **هیستوگرام کوچک** توزیع + min / میانه / max + پوشش داده؛ مقدار با واحد درست (درصد/همت/روز) ورودی گرفته شود.
- فیلد متنی (`Sector`, `Industry`, `Exchange`): چندانتخابی با شمارنده.
- گروه‌های تودرتو AND/OR، کشیدن‌ورها کردن ردیف‌ها، فعال/غیرفعال کردن موقت هر شرط.
- شمارنده زنده: «۱۲۳ نماد از ۹۵۷».
- **فیلترهای سریع (Chips)** بالای هر صفحه: بازار، بخش، صنعت، بازه ارزش بازار، حداقل ارزش معاملات ۲۰ روزه، حداقل اطمینان.

### 11.7 فیلترهای ذخیره‌شده (Presets) — `filterPresets.ts`
پریست‌های پیش‌ساخته (کاربر می‌تواند ویرایش/کپی کند):
- **سهم فصل آخر از سود سال بالا:** `NI_MRQ / NI_FY > 0.35 AND NI_MRQ > 0`
- **جهش سود فصلی + روند صعودی:** `flag.turnaroundQ OR factor.fundamentalQuarterly.Q1 > 80 AND score.technical > 60`
- **ورود پول حقیقی در روند:** `flag.smartMoneyIn AND factor.technical.T1 > 65`
- **ارزان با رشد:** `PtoE_ttm BETWEEN 0 AND 7 AND real(NI_3YrGR) > 0.1`
- **رکورد درآمد ماهانه:** `flag.recordMonth AND Exchange IN ("TSE","IFB")`
- **کم‌ریسک بنیادی قوی:** `factor.technical.T5 > 70 AND score.fundamentalLong > 70 AND D_DebtToRev < 0.3`
- **فقط بازار بورس، صنایع غیرمالی:** `Exchange = "TSE" AND NOT Sector = "خدمات مالی"`

### 11.8 پیام خطا
خطاها با موقعیت کاراکتر و پیشنهاد: «ستون `NI_MRQQ` پیدا نشد. منظورتان `NI_MRQ` است؟» (فاصله Levenshtein). تکمیل خودکار نام فیلدها و توابع در ویرایشگر متنی.

---

## 12. رابط کاربری

### 12.1 تم رنگی (تیره: فیروزه‌ای، سرمه‌ای، آبی) — `ui/styles/tokens.css`

```css
:root {
  /* سطوح (سرمه‌ای) */
  --bg:            #070E1D;
  --surface-1:     #0C1730;
  --surface-2:     #112042;
  --surface-3:     #182B55;
  --border:        #22396B;
  --border-subtle: #172A50;

  /* برند */
  --turquoise-400: #2DD4BF;
  --turquoise-500: #14B8A6;
  --turquoise-600: #0D9488;
  --blue-400:      #60A5FA;
  --blue-500:      #3B82F6;
  --blue-700:      #1D4ED8;
  --navy-600:      #1E3A8A;

  /* متن */
  --text:          #E6EEF8;
  --text-muted:    #93A6C4;
  --text-faint:    #5F7397;

  /* وضعیت (کم‌اشباع، هماهنگ با تم) */
  --positive:      #2DD4BF;   /* فیروزه‌ای = خوب/صعود */
  --negative:      #F06A7A;   /* صورتی-قرمز ملایم = بد/نزول */
  --warning:       #F2B85B;
  --neutral:       #7C8DB0;

  /* مقیاس امتیاز (۰→۱۰۰): ضعیف → متوسط → عالی */
  --score-e: #F06A7A; --score-d: #C77D9A; --score-c: #7C8DB0;
  --score-b: #3B82F6; --score-a: #2DD4BF;

  --radius: 10px; --gap: 16px;
  --font: 'Vazirmatn', system-ui, sans-serif;
}
```
- Heatmap ترتیبی: `#0C1730 → #1E3A8A → #3B82F6 → #14B8A6 → #2DD4BF`.
- Heatmap واگرا (مثبت/منفی، مثل جریان پول): `#F06A7A ← #112042 → #2DD4BF`.
- پالت دسته‌ای نمودار (ترتیب ثابت): `#2DD4BF, #3B82F6, #A78BFA, #60A5FA, #F2B85B, #5EEAD4, #818CF8, #93A6C4`.
- کنتراست متن ≥ 4.5:1؛ رنگ هرگز تنها حامل معنا نباشد (فلش ▲▼ و برچسب هم باشد).
- `dir="rtl"` روی `<html>`؛ اعداد داخل جدول با `font-variant-numeric: tabular-nums` و LTR ایزوله (`<bdi>`) برای علامت منفی.

### 12.2 اسکلت صفحه
- **نوار بالا:** لوگوی Bourse View Filters، تاریخ اسنپ‌شات، دکمه «بارگذاری فایل روز» (+ Drag & Drop روی کل صفحه)، فیلتر سراسری (خلاصه + دکمه ویرایش)، جستجوی نماد (Ctrl+K).
- **منوی کناری (سمت راست):** نمای کلی، تکنیکال، ریسک بازار، بنیادی بلندمدت، بنیادی فصلی، بنیادی ماهانه، استودیو فیلتر، پارامترهای سفارشی، سلامت داده، تنظیمات.
- **کشوی جزئیات نماد** (Drawer از چپ) با کلیک روی هر نماد در هر جا.
- ریسپانسیو: ≥ ۱۲۸۰px چیدمان کامل؛ تبلت: منوی جمع‌شونده؛ موبایل: کارت‌ها به‌جای جدول‌های عریض.

### 12.3 صفحات

**الف) نمای کلی (Overview)**
- ردیف KPI: تعداد نمادها (بعد از فیلتر)، دماسنج ریسک بازار، ٪ بالای SMA200، جریان پول حقیقی امروز (همت)، میانگین امتیاز هر پروفایل، تعداد پرچم‌های تحول فصلی/ماهانه.
- **نمودار ربع‌ها (Quadrant Scatter):** محور X = امتیاز بنیادی بلندمدت، محور Y = امتیاز تکنیکال، اندازه حباب = √MarketCap، رنگ = Sector. چهار ربع: «ستاره‌ها»، «ارزان‌های فراموش‌شده»، «حباب‌های مومنتوم»، «پرهیز». (محورها از هر فیلد قابل انتخاب.)
- جدول «Top 10 ترکیبی» و «تازه‌واردهای Top 20» (از تاریخچه).
- Treemap بازار: اندازه = ارزش بازار، رنگ = امتیاز انتخابی (یا Ret_1D).

**ب) هر صفحه پروفایل (تکنیکال / بلندمدت / فصلی / ماهانه)** — با کامپوننت مشترک `ProfilePage` و پیکربندی:
- انتخاب پریست وزن + دکمه «ویرایش وزن‌ها» (اسلایدرها؛ مجموع خودکار ۱۰۰٪).
- جدول **بهترین‌ها** و **بدترین‌ها** (N قابل تنظیم: ۱۰/۲۰/۵۰) با ستون‌ها: نماد، شرکت، صنعت، امتیاز (Badge رنگی + درجه)، **نوار فاکتورها** (mini stacked bars یا ۷ خانه رنگی)، اطمینان، پرچم‌ها، تغییر امتیاز نسبت به دیروز.
- جدول کامل (همه نمادهای فیلترشده) با انتخاب ستون، مرتب‌سازی، ستون نماد ثابت، Export.
- **Heatmap فاکتورها:** ردیف = Top N نماد، ستون = فاکتورها.
- **هیستوگرام توزیع امتیاز** بازار با خط میانه.
- **میانگین امتیاز به تفکیک Sector** (نمودار میله‌ای افقی، مرتب‌شده).
- صفحه فصلی و ماهانه: تب اضافه «متحول‌شده‌ها» (بر اساس `score.qTransform`/`score.mTransform` و پرچم‌ها) + Scatter «رشد سود فصل (YoY) در برابر P/E پیش‌رو».

**ج) ریسک بازار**
- Gauge دماسنج ریسک (هم‌وزن / وزن ارزش بازار / √Cap — کلید).
- کارت مؤلفه‌ها (بخش ۷.۳) با مقدار و جهت.
- Heatmap ریسک به تفکیک Sector × مؤلفه.
- جریان پول حقیقی به تفکیک Sector (میله واگرا).
- خط زمانی دماسنج ریسک و پهنای بازار (از تاریخچه).
- Scatter بتا × انحراف معیار (اندازه = ارزش بازار).

**د) جزئیات نماد (Drawer / صفحه)**
- سربرگ: نماد، شرکت، بازار، صنعت، قیمت، تغییر روز، ارزش بازار، عمر صورت مالی.
- **چهار Radar** (یکی برای هر پروفایل) + مقایسه با میانه صنعت (لایه دوم کم‌رنگ).
- برای هر فاکتور: باز شدنی؛ هر متریک با مقدار خام، واحد، صدک (نوار)، صدک در صنعت، و فرمول (Tooltip).
- سطوح حمایت/مقاومت (Pivot ها، بولینگر، SMA ها) روی یک خط افقی قیمت.
- تاریخچه امتیازها (Sparkline، از اسنپ‌شات‌ها).
- دکمه «مقایسه با…» (تا ۴ نماد، Radar هم‌پوشان).

**ه) استودیو فیلتر**
- سازنده بصری + ویرایشگر متنی + پیش‌نمایش نتایج زنده.
- مدیریت پریست‌ها (ذخیره، تغییر نام، کپی، حذف، Export/Import).
- خروجی نتایج به Excel/CSV.

**و) پارامترهای سفارشی** — فهرست، ایجاد/ویرایش با پیش‌نمایش (توزیع مقدار و پوشش)، تست روی یک نماد.

**ز) سلامت داده** — گزارش `schemaValidator`: ستون‌های جدید/حذف‌شده، نمادهای جدید/حذف‌شده نسبت به دیروز، پوشش هر ستون (جدول قابل جستجو)، سلول‌های غیرعددی، نمادهای بدون Sector.

**ح) تنظیمات** — فرض‌ها (تورم، نرخ بدون ریسک، آستانه نقدشوندگی)، دامنه همتا، وزن ترکیبی، واحد نمایش مبالغ، ارقام فارسی/لاتین، ویرایشگر پیشرفته پروفایل‌ها (افزودن/حذف متریک از فاکتور، تغییر جهت و وزن، بازگشت به پیش‌فرض)، Export/Import کل تنظیمات.

### 12.4 قالب‌بندی اعداد
- مبالغ: `۳۷۰٫۹ همت` (پیش‌فرض) یا میلیارد تومان. درصدها: `۱۳٫۰۵٪`. نسبت‌ها: ۲ رقم اعشار. null: `—`.
- تمام قالب‌بندی‌ها در `core/utils/format.ts` با `Intl.NumberFormat('fa-IR')`.

---

## 13. تاریخچه اسنپ‌شات‌ها

- با هر بارگذاری، یک اسنپ‌شات فشرده در IndexedDB ذخیره شود: `{ date, symbols, scores (4 پروفایل + composite + فاکتورها), keyMetrics (Price, MarketCap, Ret_1D, NetIndividualValue), marketRisk }`. (حجم هر اسنپ‌شات ≈ چند صد KB؛ نگهداری پیش‌فرض ۲۵۰ روز معاملاتی، قابل تنظیم.)
- بارگذاری مجدد فایل همان تاریخ → جایگزینی (با تأیید).
- قابلیت‌ها: «تغییر امتیاز نسبت به اسنپ‌شات قبل» (ستون Δ)، فیلدهای فیلترپذیر `delta.score.<profile>`، «تازه‌واردهای Top N»، «خارج‌شده‌ها»، سری زمانی دماسنج ریسک، Sparkline امتیاز هر نماد، و پس از ≥ ۲۰ روز، نرمال‌سازی مؤلفه‌های ریسک بازار نسبت به تاریخچه.
- Export/Import کل تاریخچه به JSON (پشتیبان).

---

## 14. قوانین کلین‌کد، تست و CLAUDE.md

### 14.1 قوانین
1. **جداسازی لایه‌ها** (بخش ۳.۱) با `eslint-plugin-boundaries` اجباری شود. `core` هیچ import از `ui`/`app`/DOM ندارد.
2. **Open/Closed:** افزودن متریک، فاکتور، پروفایل، تابع فیلتر، پریست یا نمودار **فقط با افزودن به config/registry**؛ موتورها تغییر نمی‌کنند.
3. **توابع خالص** در `core`؛ بدون state سراسری؛ ورودی‌ها immutable.
4. **بدون عدد جادویی:** همه آستانه‌ها، وزن‌ها و باندها در `config/`.
5. TypeScript `strict: true`، `noUncheckedIndexedAccess: true`؛ ممنوعیت `any` (به‌جز مرزهای کتابخانه با توضیح).
6. توابع ≤ ۴۰ خط، فایل‌ها ≤ ۳۰۰ خط (به‌جز فایل‌های config)؛ هر ماژول یک مسئولیت.
7. **نام‌گذاری:** `camelCase` برای متغیر/تابع، `PascalCase` برای تایپ/کلاس، `kebab-case` برای فایل‌های UI و تگ‌های Web Component (`bv-*`)، پیشوند `D_` و `C_` برای متریک‌های مشتق و سفارشی.
8. **مدیریت خطا:** توابع قابل‌شکست در `core` نوع `Result<T, AppError>` برمی‌گردانند؛ UI خطای فارسی نشان می‌دهد؛ هیچ خطای داده نباید کل برنامه را متوقف کند.
9. **همه رشته‌های UI** در `i18n/fa.ts`.
10. **مستندسازی فرمول:** هر `MetricDef.description` فرمول و تفسیر را دارد و همان در Tooltip نمایش داده می‌شود (یک منبع حقیقت).
11. **دسترس‌پذیری:** ناوبری با کیبورد، `aria-label` برای نمودارها (خلاصه متنی)، فوکوس قابل‌مشاهده.
12. **عملکرد:** محاسبات سنگین در Worker؛ جدول‌ها مجازی؛ نمودارها با `dispose` هنگام خروج از صفحه.
13. **کامیت‌ها:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`).

### 14.2 تست
- **واحد (Vitest):** parseValue، normalizeHeaders، jalali، همه متریک‌های مشتق (نمونه دستی + لبه‌ها)، normalizers (percentile با تساوی، band)، factorEngine (بازتوزیع وزن، minCoverage)، lexer/parser/evaluator (اولویت عملگرها، null، IN/BETWEEN، ارقام فارسی، `20%`، توابع مقطعی، پیام خطا)، تشخیص حلقه پارامتر سفارشی.
- **Golden:** با فایل `data/samples/screener-plus-1405-08-04.xlsx`، امتیاز ۴ پروفایل برای ۱۰ نماد منتخب (مثلاً ذوب، فولاد، فملی، شستا، خودرو، وبملت، …) snapshot شود؛ هر تغییر عمدی در وزن‌ها با به‌روزرسانی آگاهانه snapshot.
- **مقاومت داده:** fixture های مصنوعی: ستون حذف‌شده، ستون جدید، ترتیب ستون متفاوت، نماد تکراری، فایل تقریباً خالی.
- **E2E (Playwright):** بارگذاری فایل نمونه → نمایش ۹۵۷ نماد → اعمال پریست → تعریف پارامتر سفارشی و فیلتر روی آن → باز کردن جزئیات نماد → Export.
- پوشش هدف: `core/` ≥ ۸۵٪.

### 14.3 محتوای `CLAUDE.md` (در فاز ۰ ساخته شود)
```md
# Bourse View Filters
- Source of truth: PLAN.md. Read relevant section before each task.
- Commands: npm run dev | npm run build (single-file dist/index.html) | npm test | npm run test:e2e | npm run lint
- Layering: ui → app → core ← config. core has NO DOM/storage access. Enforced by ESLint.
- Add a metric: config/derivedMetrics.ts + unit test. Add a factor: config/profiles/*.ts. Never edit engines for new content.
- Missing values: '-', '----', '' → null. Never crash on missing/new columns.
- UI text only in src/i18n/fa.ts. RTL. Theme tokens only from ui/styles/tokens.css.
- No eval/new Function. Filter language is parsed by core/filters.
- Sample data: data/samples/screener-plus-1405-08-04.xlsx (golden tests).
- After each phase: run lint + tests, update the phase checklist in PLAN.md §15.
```

---

## 15. فازهای اجرا و معیارهای پذیرش

> Claude Code: هر فاز را کامل کن، `npm run lint && npm test` را سبز کن، چک‌باکس‌ها را در این فایل تیک بزن، سپس به فاز بعد برو.

**فاز ۰ — اسکلت پروژه**
- [x] Vite + TS strict + ESLint (boundaries) + Prettier + Vitest + Playwright + `vite-plugin-singlefile`.
- [x] `CLAUDE.md`، tokens.css، فونت Vazirmatn محلی، پوسته RTL با منوی کناری و router.
- ✅ پذیرش: `npm run build` یک `dist/index.html` تولید می‌کند که آفلاین با دابل‌کلیک باز می‌شود.

**فاز ۱ — لایه داده**
- [ ] Worker + SheetJS، normalizeHeaders، parseValue، buildDataset ستون‌محور، snapshotDate، schemaValidator.
- [ ] Data Dictionary کامل (`columns.ts`) برای همه ۴۴۴ ستون معنادار.
- [ ] صفحه «سلامت داده» و یک جدول خام ساده.
- ✅ پذیرش: فایل نمونه → ۹۵۷ نماد، ستون خالی اول حذف، `-` به null، نام‌های دارای `\n` نرمال؛ تست‌های مقاومت داده سبز.

**فاز ۲ — متریک‌های مشتق**
- [ ] registry با حل وابستگی، helpers (safeDiv، realGrowth، NEGATIVE_BASE)، همه متریک‌های بخش ۵.۲ + تست.
- ✅ پذیرش: برای «ذوب»: `D_Debt ≈ 1.464e14`، `D_DebtToRev ≈ 0.213`، `LiabilityToAsset` بازسازی‌شده ≈ ۰٫۶۵۴۵ (تست واحد).

**فاز ۳ — موتور امتیاز + تکنیکال + ریسک بازار**
- [ ] normalizers، peerGroups، factorEngine، profileEngine، grades، flags.
- [ ] پروفایل تکنیکال (۷ فاکتور) و marketRiskEngine (۳ روش وزن‌دهی، به تفکیک Sector).
- ✅ پذیرش: assertion «۴ ≤ تعداد فاکتور ≤ ۸»؛ داده ناقص باعث NaN در خروجی نمی‌شود؛ golden test تکنیکال.

**فاز ۴ — سه پروفایل بنیادی**
- [ ] بلندمدت (۸)، فصلی (۷)، ماهانه (۶)، industryOverrides، Piotroski-lite، شاخص‌های تحول، composite.
- ✅ پذیرش: نمادهای بدون `Rev_1M` در ماهانه «گزارش ندارد»؛ بانک‌ها بدون متریک‌های غیرفعال امتیاز می‌گیرند؛ golden tests.

**فاز ۵ — موتور فیلتر**
- [ ] lexer (ارقام فارسی، `%`، `همت`)، Pratt parser، analyzer، evaluator برداری، کتابخانه توابع، پیام خطای فارسی + پیشنهاد نام.
- ✅ پذیرش: ≥ ۶۰ تست پارسر/ارزیاب سبز؛ عبارت `NI_MRQ / NI_FY > 35% AND Exchange IN ("TSE","IFB") AND score.technical >= 60` درست ارزیابی می‌شود؛ ارزیابی روی ۱۰۰۰ نماد < ۲۰ms.

**فاز ۶ — صفحات اصلی UI**
- [ ] کامپوننت‌های پایه (KPI، Badge، FactorBar، DataTable روی Tabulator، Chart wrapper روی ECharts).
- [ ] Overview، ۴ صفحه پروفایل (ProfilePage مشترک)، ریسک بازار، Drawer جزئیات نماد.
- ✅ پذیرش: همه نمودارهای بخش ۱۲.۳ رندر و با تغییر فیلتر سراسری به‌روز می‌شوند.

**فاز ۷ — استودیو فیلتر و پارامترهای سفارشی**
- [ ] سازنده بصری ↔ متن، فیلتر سراسری/صفحه، Chips سریع، پریست‌ها (ذخیره/Export/Import)، پارامتر سفارشی با گراف وابستگی، افزودن پارامتر سفارشی به فاکتور.
- ✅ پذیرش: کاربر `C_QtrShare = NI_MRQ / NI_FY` را تعریف، در جدول ستونش را می‌بیند، روی آن فیلتر می‌کند و به فاکتور Q1 اضافه‌اش می‌کند؛ پس از رفرش صفحه باقی است.

**فاز ۸ — تاریخچه**
- [ ] snapshotRepo، Δ امتیاز، تازه‌واردها، سری زمانی ریسک بازار، Sparkline.
- ✅ پذیرش: با دو فایل تاریخ متفاوت (fixture مصنوعی دوم) ستون Δ و فهرست تازه‌واردها درست است.

**فاز ۹ — تنظیمات، Export، پرداخت نهایی**
- [ ] صفحه تنظیمات (فرض‌ها، وزن‌ها، ویرایشگر پروفایل)، Export جدول به xlsx/csv، دسترس‌پذیری، E2E کامل، README کاربری فارسی.
- ✅ پذیرش: E2E سبز؛ Lighthouse Accessibility ≥ ۹۰؛ بارگذاری کامل فایل نمونه < ۲ ثانیه روی لپ‌تاپ معمولی.

---

## 16. راهنمای توسعه‌پذیری

| می‌خواهم… | کجا |
|---|---|
| پارامتر مشتق جدید سیستمی | `config/derivedMetrics.ts` + تست در `tests/unit/metrics` |
| پارامتر جدید بدون کد | صفحه «پارامترهای سفارشی» (عبارت) |
| فاکتور جدید / تغییر وزن پیش‌فرض | `config/profiles/<profile>.ts` |
| پروفایل پنجم (مثلاً «سود نقدی») | فایل جدید در `config/profiles/` + ثبت در `index.ts` — صفحه آن خودکار از `ProfilePage` ساخته می‌شود |
| تابع جدید زبان فیلتر | `core/filters/functions.ts` (نام، امضا، توضیح، پیاده‌سازی برداری) |
| پریست فیلتر | `config/filterPresets.ts` |
| نمودار جدید | factory در `ui/charts/` + استفاده در صفحه |
| ستون جدید اکسل | خودکار قابل استفاده؛ برای برچسب/دسته فارسی به `columns.ts` اضافه شود |
| قوانین ویژه یک صنعت | `config/industryOverrides.ts` |

---

## 17. فرض‌هایی که باید تأیید شوند (در Data Dictionary قابل اصلاح)

1. ستون‌های `*_3YrGR` / `*_3yrGR` / `*_3qGR` (بدون `_Arith`) **نرخ رشد مرکب (CAGR)** و نسخه‌های `_Arith` **میانگین حسابی رشدهای دوره‌ای** فرض شده‌اند.
2. `Rev_1MGR` = رشد درآمد ماه آخر نسبت به ماه قبل؛ `Rev_3MGR` = رشد میانگین ۳ ماه اخیر نسبت به ۳ ماه قبل از آن (یا CAGR ماهانه) — باید با منبع داده تأیید شود.
3. `IndividualBuyPower` = سرانه خرید حقیقی ÷ سرانه فروش حقیقی (قدرت خریدار حقیقی)؛ `NetIndividual` = خالص ورود حقیقی ÷ ارزش معاملات.
4. `BidPressure` = فشار تقاضا در دفتر سفارش (بالاتر = تقاضای بیشتر).
5. `EPS_MRQ_LC` = EPS فصل بر پایه آخرین سرمایه (Last Capital).
6. `EBIT` در برخی نمادها خالی است؛ در صورت نیاز `OP_TTM` جایگزین تقریبی می‌شود (`coalesce(EBIT, OP_TTM)`).
7. `DebtRatio` = بدهی مالی (تسهیلات) ÷ کل دارایی — **تأییدشده** روی داده.
8. نرخ تورم و نرخ بدون ریسک پیش‌فرض‌هایی تقریبی‌اند و کاربر باید در تنظیمات به‌روز کند.
9. داده‌ها شامل صندوق‌ها (ETF) نیستند؛ اگر روزی اضافه شدند، با `eligibility` از پروفایل‌های بنیادی کنار گذاشته شوند.
