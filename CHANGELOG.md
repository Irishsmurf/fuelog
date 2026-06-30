# Changelog

## [2.4.0](https://github.com/Irishsmurf/fuelog/compare/v2.3.0...v2.4.0) (2026-06-30)


### Features

* **functions:** add --verbose per-vehicle breakdown to odometer backfill ([#218](https://github.com/Irishsmurf/fuelog/issues/218)) ([f207832](https://github.com/Irishsmurf/fuelog/commit/f20783276a566cfee709c798206396e7395a0192))
* **functions:** add script to assign stations to coordinate-only logs ([#219](https://github.com/Irishsmurf/fuelog/issues/219)) ([dec135b](https://github.com/Irishsmurf/fuelog/commit/dec135b768081bd7787e2e86e2ed5ee86a661b5a))
* **functions:** backfill odometer readings from distance history ([#216](https://github.com/Irishsmurf/fuelog/issues/216)) ([d2cb326](https://github.com/Irishsmurf/fuelog/commit/d2cb3269e578b35582df87b06cf40028a90dec3e))
* log fuel-ups at a later time and location ([#213](https://github.com/Irishsmurf/fuelog/issues/213)) ([c80f11f](https://github.com/Irishsmurf/fuelog/commit/c80f11f9ec53dc5d3a1ed4d9a814d4f6abf68831))
* **map:** make Map page full-bleed across the viewport ([#220](https://github.com/Irishsmurf/fuelog/issues/220)) ([9825f38](https://github.com/Irishsmurf/fuelog/commit/9825f3871790dc7068fde23d58d9ecf4f371f40b))


### Bug Fixes

* allow log updates without a receipt and stop modal viewport clipping ([#215](https://github.com/Irishsmurf/fuelog/issues/215)) ([f6a9a81](https://github.com/Irishsmurf/fuelog/commit/f6a9a8142016b03d941b2e3ef0e2ecda58049c77))
* **functions:** avoid Overpass 406 in assign-stations script ([#221](https://github.com/Irishsmurf/fuelog/issues/221)) ([db98827](https://github.com/Irishsmurf/fuelog/commit/db98827db50411735747562d1bb0f57084f36f8d))
* **functions:** pin Firestore project in odometer backfill script ([#217](https://github.com/Irishsmurf/fuelog/issues/217)) ([21839d6](https://github.com/Irishsmurf/fuelog/commit/21839d6592fbfd2bde69b81b9e2ec51c8e91cef1))
* prevent undefined Firestore fields and clarify save errors ([#212](https://github.com/Irishsmurf/fuelog/issues/212)) ([62b0855](https://github.com/Irishsmurf/fuelog/commit/62b08551e5337760da2c7c0f9a88c7ae3a4bfd66))
* resolve ERR_REQUIRE_ESM from jose/jwks-rsa ([#207](https://github.com/Irishsmurf/fuelog/issues/207)) ([48b2627](https://github.com/Irishsmurf/fuelog/commit/48b262770c810d5f7b735fdce886b629e2d7e3bd))
* use correct Interactions API parameters for Gemini thinking config ([#209](https://github.com/Irishsmurf/fuelog/issues/209)) ([293465a](https://github.com/Irishsmurf/fuelog/commit/293465af674483d68cc5f85b42dc228b981a51df))


### Performance Improvements

* compress receipt images before uploading to storage ([#211](https://github.com/Irishsmurf/fuelog/issues/211)) ([51b9552](https://github.com/Irishsmurf/fuelog/commit/51b955206cb1be9096b4a78b0555ea6a738b7f7c))

## [2.3.0](https://github.com/Irishsmurf/fuelog/compare/v2.2.0...v2.3.0) (2026-06-17)


### Features

* add Admin Console page for sending test notifications ([#169](https://github.com/Irishsmurf/fuelog/issues/169)) ([e0accea](https://github.com/Irishsmurf/fuelog/commit/e0acceaf05db78c2f07b18f3c53906703f20d79e))
* add sendTestNotification callable for developer test notifications ([#167](https://github.com/Irishsmurf/fuelog/issues/167)) ([d0cc135](https://github.com/Irishsmurf/fuelog/commit/d0cc13515cf274da35ffa0264818124df5645559)), closes [#166](https://github.com/Irishsmurf/fuelog/issues/166)
* add vercel deployment and playwright smoke test pipeline ([#179](https://github.com/Irishsmurf/fuelog/issues/179)) ([e6b4cd6](https://github.com/Irishsmurf/fuelog/commit/e6b4cd67c963a23b45e10e064425d47829661b9f))
* Client-side Heatmap Implementation ([#182](https://github.com/Irishsmurf/fuelog/issues/182)) ([c06db11](https://github.com/Irishsmurf/fuelog/commit/c06db11143902e6c25bb3defdb5217a82b1df0ee))
* default-sort Stations page by proximity to current location ([#178](https://github.com/Irishsmurf/fuelog/issues/178)) ([c4e4a24](https://github.com/Irishsmurf/fuelog/commit/c4e4a247ecd85fda766544274e24cb941eef8cbd))
* implement advanced supply chain security (SAST) ([#188](https://github.com/Irishsmurf/fuelog/issues/188)) ([979690e](https://github.com/Irishsmurf/fuelog/commit/979690e8455cbb70f26f470ac955f5180f2604e3)), closes [#177](https://github.com/Irishsmurf/fuelog/issues/177)
* **ui:** premium glassmorphic redesign of Quick Log page ([#195](https://github.com/Irishsmurf/fuelog/issues/195)) ([d185d97](https://github.com/Irishsmurf/fuelog/commit/d185d979e2da6c5d2f23610ed318226c4ce97e1a))


### Bug Fixes

* resolve 'L is not defined' in production ([#189](https://github.com/Irishsmurf/fuelog/issues/189)) ([9545a61](https://github.com/Irishsmurf/fuelog/commit/9545a6137e42526f255dddc4de55c0e8081af92f))
* resolve production crash and translate maintenance section ([#190](https://github.com/Irishsmurf/fuelog/issues/190)) ([6a756d4](https://github.com/Irishsmurf/fuelog/commit/6a756d442a7538944c35d90edb3c233f04bfd998))
* show the user's UID on the Admin Console access-denied screen ([#180](https://github.com/Irishsmurf/fuelog/issues/180)) ([c6e5ce0](https://github.com/Irishsmurf/fuelog/commit/c6e5ce0927c13b8751f077fadbba9e3675668014))

## [2.2.0](https://github.com/Irishsmurf/fuelog/compare/v2.1.0...v2.2.0) (2026-06-16)


### Features

* add cost-per-litre trend line to HistoryPage chart ([#109](https://github.com/Irishsmurf/fuelog/issues/109)) ([4bc1e95](https://github.com/Irishsmurf/fuelog/commit/4bc1e95d5b4002afee0ef1596f06ff591a93e9ea))
* add multi-vehicle efficiency comparison chart to HistoryPage ([#110](https://github.com/Irishsmurf/fuelog/issues/110)) ([b02e6c4](https://github.com/Irishsmurf/fuelog/commit/b02e6c47be1f37229869098b280e9421b417126f))
* make language switcher reachable from anywhere in the app ([#139](https://github.com/Irishsmurf/fuelog/issues/139)) ([#159](https://github.com/Irishsmurf/fuelog/issues/159)) ([035268f](https://github.com/Irishsmurf/fuelog/commit/035268f3d1a8e0257b912b60e7b6c7f42a4bafaf))
* move CSV import into Profile, add one-time onboarding prompt ([#154](https://github.com/Irishsmurf/fuelog/issues/154)) ([#161](https://github.com/Irishsmurf/fuelog/issues/161)) ([d34fb0b](https://github.com/Irishsmurf/fuelog/commit/d34fb0b161cf8ef9dcc68b75a21551b0241f2201))
* persist notification opt-in and gate weekly digest by it ([#108](https://github.com/Irishsmurf/fuelog/issues/108)) ([e720f2f](https://github.com/Irishsmurf/fuelog/commit/e720f2f4d5754afcb796a2f1e848af85683f041e))
* use a quieter CartoDB basemap theme for all maps ([#140](https://github.com/Irishsmurf/fuelog/issues/140)) ([c831360](https://github.com/Irishsmurf/fuelog/commit/c831360d3fb91227c8261c46ecbb2c0d31db60d7))


### Bug Fixes

* clip overflowing card content instead of letting it escape the card ([#162](https://github.com/Irishsmurf/fuelog/issues/162)) ([#163](https://github.com/Irishsmurf/fuelog/issues/163)) ([4068305](https://github.com/Irishsmurf/fuelog/commit/4068305c01e70ba141aed354ebcaaf272ee06241))
* drop Dashboard from mobile bottom nav to reduce crowding ([#141](https://github.com/Irishsmurf/fuelog/issues/141)) ([#158](https://github.com/Irishsmurf/fuelog/issues/158)) ([31f592b](https://github.com/Irishsmurf/fuelog/commit/31f592b3cb00550f18e08675913fe51fb2310784))
* group map markers by stationId and use a themed pin icon ([#150](https://github.com/Irishsmurf/fuelog/issues/150)) ([c6d499f](https://github.com/Irishsmurf/fuelog/commit/c6d499fda070963d792db491e9f73b12612198da))
* recalculate distance reactively when odometer or last reading changes ([#135](https://github.com/Irishsmurf/fuelog/issues/135)) ([#157](https://github.com/Irishsmurf/fuelog/issues/157)) ([31752bb](https://github.com/Irishsmurf/fuelog/commit/31752bbb34bb8ebfc247f6025163d2d55e83b910))
* regenerate PWA icon set to match amber/navy branding ([#165](https://github.com/Irishsmurf/fuelog/issues/165)) ([c409856](https://github.com/Irishsmurf/fuelog/commit/c4098569b777a455a93fda8f3070da5ebfb904f0))


### Performance Improvements

* pre-map stations by coordinate in FuelMapPage grouping ([#140](https://github.com/Irishsmurf/fuelog/issues/140)) ([6110eab](https://github.com/Irishsmurf/fuelog/commit/6110eab233033b379ddc5092a25ffcfd8d11402f))

## [2.1.0](https://github.com/Irishsmurf/fuelog/compare/v2.0.0...v2.1.0) (2026-06-16)


### Features

* Add ability to edit fuel log location directly from History page table view ([#95](https://github.com/Irishsmurf/fuelog/issues/95)) ([9f3c09b](https://github.com/Irishsmurf/fuelog/commit/9f3c09bb27ce6ab39262531d47223007b5bf6fae))
* add Codecov Test Analytics via JUnit XML reporter ([#66](https://github.com/Irishsmurf/fuelog/issues/66)) ([120b1b2](https://github.com/Irishsmurf/fuelog/commit/120b1b291fb3ae5e42d55d035ce480be7c5ed0a3))
* add Dashboard page with monthly fuel spend summary ([#100](https://github.com/Irishsmurf/fuelog/issues/100)) ([95680eb](https://github.com/Irishsmurf/fuelog/commit/95680eb8730e589910159785c03a86bb52ba1693))
* add full-stack observability ([#67](https://github.com/Irishsmurf/fuelog/issues/67)) ([6316e09](https://github.com/Irishsmurf/fuelog/commit/6316e09262e81bcf551fefd5f7abb5329f2fba55))
* add npm audit and env var validation to CI ([#76](https://github.com/Irishsmurf/fuelog/issues/76)) ([bb0e886](https://github.com/Irishsmurf/fuelog/commit/bb0e8867c2eb524f77255fabd236459ed1244c0f))
* amber design system, SVG brand assets, redirect auth, Stations i18n ([#103](https://github.com/Irishsmurf/fuelog/issues/103)) ([3e73fd3](https://github.com/Irishsmurf/fuelog/commit/3e73fd35160e069e19d76b2c5e11ac3bb43f1f27))
* configure Gemini model and thinking budget via env vars ([#75](https://github.com/Irishsmurf/fuelog/issues/75)) ([6d1c132](https://github.com/Irishsmurf/fuelog/commit/6d1c132335d0e3e462c56c5ab4ce3c0fb1d580cc))
* expand Firebase with Cloud Functions, FCM notifications, and aggregation queries ([#68](https://github.com/Irishsmurf/fuelog/issues/68)) ([c9baea6](https://github.com/Irishsmurf/fuelog/commit/c9baea6f6500e782bad45e12d009b5b66edc7622))
* FCM-based monthly budget alerts for fuel spend ([#101](https://github.com/Irishsmurf/fuelog/issues/101)) ([b5ca6a6](https://github.com/Irishsmurf/fuelog/commit/b5ca6a67e13480906e8ce8ca2268cc171ee91eca))
* implement odometer-based fuel logging with smart distance calculation ([#92](https://github.com/Irishsmurf/fuelog/issues/92)) ([8b59114](https://github.com/Irishsmurf/fuelog/commit/8b59114d45e5fbf4c0b0598ffc21a9e3f9a27241))
* petrol station association and clustering ([#93](https://github.com/Irishsmurf/fuelog/issues/93)) ([1804b47](https://github.com/Irishsmurf/fuelog/commit/1804b471fdc4bc9d22e7eb4c273c46d3a3078259))
* redesign Lifetime Totals with icon cards for better UX ([#71](https://github.com/Irishsmurf/fuelog/issues/71)) ([44b5e48](https://github.com/Irishsmurf/fuelog/commit/44b5e4899a4b25e19a0d01b15fc5e5e01a9e8986))
* remove feature flag gating on Stations page ([#121](https://github.com/Irishsmurf/fuelog/issues/121)) ([03569e7](https://github.com/Irishsmurf/fuelog/commit/03569e765369a03222963546d9b6d5b9f054635b))
* show a map of the station's location on StationDetail ([#126](https://github.com/Irishsmurf/fuelog/issues/126)) ([a71cdbb](https://github.com/Irishsmurf/fuelog/commit/a71cdbb03ca5e26512a9dc01e829fb9d81d12ce2))


### Bug Fixes

* address review feedback on AuthContext tests + build error ([#96](https://github.com/Irishsmurf/fuelog/issues/96)) ([c0792e9](https://github.com/Irishsmurf/fuelog/commit/c0792e941ae81fffb9978282483871b821601c06))
* address review feedback on budget alert function ([#101](https://github.com/Irishsmurf/fuelog/issues/101)) ([66f1492](https://github.com/Irishsmurf/fuelog/commit/66f14929618b3350cc3d3dbb10c3ec45f2496eca))
* address review feedback on DashboardPage ([#100](https://github.com/Irishsmurf/fuelog/issues/100)) ([6c94950](https://github.com/Irishsmurf/fuelog/commit/6c949501aa9e603da68d2012ad9caa31f9c72c6d))
* cap Gemini thinking budget to 512 tokens for receipt extraction ([#74](https://github.com/Irishsmurf/fuelog/issues/74)) ([b5b2cad](https://github.com/Irishsmurf/fuelog/commit/b5b2cad4b1b5f47902b9275e9381df43743417dc))
* fetch real fuel logs for StationsPage instead of hardcoded empty array ([#122](https://github.com/Irishsmurf/fuelog/issues/122)) ([337bdb4](https://github.com/Irishsmurf/fuelog/commit/337bdb4ba0eff7229c2d3740f1cc5b6750f39ac1))
* gracefully handle Remote Config IndexedDB init failure (closes [#69](https://github.com/Irishsmurf/fuelog/issues/69)) ([#70](https://github.com/Irishsmurf/fuelog/issues/70)) ([172e5c2](https://github.com/Irishsmurf/fuelog/commit/172e5c2107c7a1a75887c046e633a7500e82b33d))
* guard against infinite reload loop on dynamic import chunk failure ([#72](https://github.com/Irishsmurf/fuelog/issues/72)) ([02772a5](https://github.com/Irishsmurf/fuelog/commit/02772a580e31869889803c07ce56ea868e00c9f2))
* handle stale PWA cache causing failed dynamic chunk imports (closes [#72](https://github.com/Irishsmurf/fuelog/issues/72)) ([21f7006](https://github.com/Irishsmurf/fuelog/commit/21f7006c4dddbf23bead5f11889f016c3635382c))
* initialise Firebase Analytics with measurementId ([#65](https://github.com/Irishsmurf/fuelog/issues/65)) ([2dc3094](https://github.com/Irishsmurf/fuelog/commit/2dc309453f53081935ea6793c62a88226c7a5e27))
* keep low-GPS-accuracy warning visible instead of overwriting it ([#107](https://github.com/Irishsmurf/fuelog/issues/107)) ([e9ba246](https://github.com/Irishsmurf/fuelog/commit/e9ba246ef9a6533121400047fa29926a9cb05186))
* **nav:** prevent shifting and layout squishing due to long localized labels ([#143](https://github.com/Irishsmurf/fuelog/issues/143)) ([ca5470a](https://github.com/Irishsmurf/fuelog/commit/ca5470acdf6843beda39d4ff3deb7843bfc17bf4))
* propagate Firestore errors instead of swallowing them ([#98](https://github.com/Irishsmurf/fuelog/issues/98)) ([5f37618](https://github.com/Irishsmurf/fuelog/commit/5f3761877931f8531a106350a1c3ae301d0e8f8b))
* propagate Firestore errors instead of swallowing them ([#98](https://github.com/Irishsmurf/fuelog/issues/98)) ([#111](https://github.com/Irishsmurf/fuelog/issues/111)) ([dcf6b50](https://github.com/Irishsmurf/fuelog/commit/dcf6b50c2a622ca0586d013da1838e14475b3627))
* replace getSignedUrl with Firebase download URLs in processReceipt ([#73](https://github.com/Irishsmurf/fuelog/issues/73)) ([029edf6](https://github.com/Irishsmurf/fuelog/commit/029edf6b707ae3264256f7eb33fd419d842099b7))
* replace nested scrollbar on StationDetail recent logs with show-more ([#130](https://github.com/Irishsmurf/fuelog/issues/130)) ([56734d7](https://github.com/Irishsmurf/fuelog/commit/56734d760783387c252c62e47cabc78630f82da1))
* skip station auto-association on low GPS accuracy ([#107](https://github.com/Irishsmurf/fuelog/issues/107)) ([1f0a191](https://github.com/Irishsmurf/fuelog/commit/1f0a191bb711f724c47f07accb4b54a524131dc5))
* standardize all displayed dates to dd/MM/yyyy format ([#127](https://github.com/Irishsmurf/fuelog/issues/127)) ([2d6a19d](https://github.com/Irishsmurf/fuelog/commit/2d6a19d205f49bb02ea7ca6e5921c63cb9e00ea5))
* translate new i18n keys instead of leaving placeholders ([#129](https://github.com/Irishsmurf/fuelog/issues/129)) ([43ea503](https://github.com/Irishsmurf/fuelog/commit/43ea503468e39ec64a950d7f340e43d72de19c60))
* translate Stations placeholder strings in all non-English locales ([#128](https://github.com/Irishsmurf/fuelog/issues/128)) ([a26c51a](https://github.com/Irishsmurf/fuelog/commit/a26c51a2578e36aed1edfedd5934d38336be6d1d))
* validate receipt file type/size and surface upload errors ([#106](https://github.com/Irishsmurf/fuelog/issues/106)) ([1f1d868](https://github.com/Irishsmurf/fuelog/commit/1f1d86873356183913996d4545b6ba20101272ea))
* widen content column for table-heavy pages to stop horizontal scroll ([#124](https://github.com/Irishsmurf/fuelog/issues/124)) ([242c44f](https://github.com/Irishsmurf/fuelog/commit/242c44f9e301c1f072062985de4358bf07c8b1df))
* wire up hardcoded user-facing strings to i18n ([#129](https://github.com/Irishsmurf/fuelog/issues/129)) ([44302bd](https://github.com/Irishsmurf/fuelog/commit/44302bdbcd942c9bce5ae3d9bf3e94d5fd1e404e))
* wire up remaining hardcoded strings found by strengthened i18n check ([#129](https://github.com/Irishsmurf/fuelog/issues/129)) ([b0035fd](https://github.com/Irishsmurf/fuelog/commit/b0035fd9898925c4c89fd18925b9e900ca67bcf5))
