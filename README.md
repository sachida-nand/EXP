# Expense Manager

An Android-first personal expense tracker built with Expo + React Native that uses a Google Sheet as its database and Google Drive for receipt storage. Sign in with Google, set your monthly salary, allocate it across fixed-cost buckets (rent, EMI, family) and a wallet bucket, then log day-to-day spends — including by sharing UPI payment screenshots from PhonePe / GPay / Paytm directly into the app.

Everything the app writes lives in your own Drive. There is no app server.

## Stack

- **Expo SDK 54** + **React Native 0.81** + **TypeScript**
- **Expo Router 6** (file-based routing, grouped routes for `(auth)` and `(app)`)
- **Google Sheets API v4** as the durable store
- **Google Drive API v3** for receipt uploads and folder management
- **Firebase Google Sign-In** + native `@react-native-google-signin/google-signin` for OAuth
- **`@react-native-ml-kit/text-recognition`** for offline OCR on shared screenshots
- **`expo-share-intent`** for receiving images from the Android share sheet
- **`expo-secure-store`** for token, sheet-id, drafts, and other on-device persistence

## Features

- **Google sign-in** with PIN and optional biometric unlock; multi-account switching
- **Onboarding wizard** that creates a per-user `Expense Manager — <Name>` Sheet on first launch with five tabs: `Salary`, `Allocations`, `Daily Wallet`, `Fixed Payments`, plus a parent Drive folder
- **Salary screen** — set monthly salary, allocate to fixed buckets and a wallet bucket; carry-forward from the previous month is computed and stored on the salary row
- **Wallet screen**
  - Hero card with live balance, budget, and carry-forward
  - Add / **edit** / delete spends with optional screenshot receipts (compressed before upload)
  - Per-spend **"Deduct from wallet" toggle** for tracking cash you've lent without affecting your budget; "Lent" entries show an amber chip
  - Filters: `All / Spent / Lent`, by date, by paid-to (with autocomplete chips fed from past recipients)
  - CSV export of the filtered view
- **Fixed payments screen** — log payments against allocated buckets with paid/given semantics
- **Dashboard** — month overview, remaining balance, masked-by-default amounts, quick add
- **Import via UPI screenshot** (Android share-target or in-app picker)
  - Per-app parser (PhonePe / GPay / Paytm / generic) extracts amount, recipient, message, txn id, and date
  - Confirmation modal lets the user correct any field, route the entry to wallet or to a fixed bucket, and persist as a draft (in `SecureStore`) or commit to the Sheet
  - Auto-uploads the screenshot as the receipt
- **History** — month-grouped breakdown of salary / allocations / wallet / fixed across the whole sheet, with CSV export. Defaults to current month for fast render
- **Drive layout** — both the Sheet and Receipts folder live inside `Expense Manager — <Name>/`. Existing users are migrated automatically on next launch

## Project layout

```
app/                     Expo Router file-based routes
  (auth)/                login, PIN, multi-step setup wizard
  (app)/                 dashboard, salary, wallet, fixed, history, import, settings
  _layout.tsx            root Stack + Guard (auth-aware redirects)
  +native-intent.tsx     deep-link defensive fallback for share-intent URLs
components/
  modals/                AddSpendModal, ImportPaymentModal, SpendDetails, etc.
  ui/                    SpendRow, HeroCard, BucketRow, ConfirmDialog, …
context/
  AuthContext.tsx        Firebase + native Google sign-in, token lifecycle
  DataContext.tsx        single hydration source for the active month
hooks/                   useAuth, useSheets, …
services/
  auth/googleAuth.ts     access-token refresh + dedupe
  sheets/                per-tab CRUD (salaryService, walletService, …)
  drive/driveReceipts.ts folder ensure, image upload, layout migration
  ocr/                   ML Kit wrapper + per-app UPI parser
  storage/               SecureStore wrappers (auth, drafts, recents)
constants/               sheetConfig (tabs/headers), colors, default buckets
types/                   shared TS types (WalletSpend, Allocation, ParsedPayment, …)
utils/                   date helpers, CSV builder, currency formatters
```

## Quick start

### Prerequisites

- Node 20+
- Android Studio + a connected device or emulator (this project is Android-first; iOS share-intent + ML Kit need additional setup not covered here)
- A **Firebase** project with Google Sign-In enabled and an Android app registered with your debug SHA-1 (and release SHA-1 when you ship)
- A **Google Cloud** project with the Sheets API and Drive API enabled

### Setup

1. Install dependencies

   ```sh
   npm install
   ```

2. Drop your Firebase config (`google-services.json`) under `android/app/` and update `app.json` with your bundle id.

3. Native build is required because `expo-share-intent` and `@react-native-ml-kit/text-recognition` ship native code:

   ```sh
   npx expo prebuild --clean
   npm run android
   ```

   After this, sharing an image from any Android app should show **Expense Manager** in the system share sheet.

### Running day-to-day

```sh
npm run android         # build + launch on connected Android
npx expo start --clear  # dev server (Metro) for JS-only changes
npx tsc --noEmit        # type-check
```

If you change anything in `app.json` plugins or add a native module, re-run `npx expo prebuild --clean && npm run android`.

## Data model

### Drive layout

```
My Drive
└── Expense Manager — <Your Name>/
    ├── Expense Manager — <Your Name>            (the spreadsheet)
    └── Expense Manager — <Your Name> — Receipts/
        └── <month>-<year>-<source>-<timestamp>.jpg
```

### Spreadsheet tabs

| Tab | Columns |
| --- | --- |
| `Salary` | month, year, salary_amount, source, date_credited, carry_forward, created_at |
| `Allocations` | month, year, bucket_name, bucket_type, allocated_amount, last_month_amount, created_at |
| `Daily Wallet` | date, month, year, amount, paid_to, purpose*, notes, receipt_link, balance_after, created_at, deducts_wallet |
| `Fixed Payments` | month, year, bucket_name, payment_type, amount, paid_to, date_paid, receipt_link, created_at, notes |

`*` `purpose` is preserved for back-compat with older sheets but is no longer written from the UI; new rows leave it empty.

### On-device storage (`expo-secure-store`)

Per-user keys: OAuth tokens + expiry, refresh token, sheet id, parent + receipts folder ids, PIN hash, biometric flag, currency, salary day, persisted bucket icons, recent paid-to list, payment drafts, and a one-time `driveLayoutMigrated` flag.

## Architecture notes

- **Sheets-as-DB**: every screen reads via small per-tab services that map row-shape → typed records. Writes append or `updateRow` (PUT to a fixed range). Row deletion uses `batchUpdate` with the tab's gid.
- **Single hydration path**: `DataContext.hydrateFor` runs all current-month reads + `fetchTabGids` in one parallel batch when the active month changes. Carry-forward is read straight from the salary row (computed and stored when the user saves their salary).
- **Auth + token refresh**: `getFreshAccessToken` dedupes parallel refresh calls via a module-level `inFlightRefresh` promise so concurrent screens don't trigger Google's "previous promise did not settle" error.
- **Share-intent**: `useShareIntent` is mounted inside `app/(app)/_layout.tsx` so it only fires once the navigator and auth are ready. Cold-start GPay shares are wrapped in `InteractionManager.runAfterInteractions` + a defensive try / retry loop because the navigator-mount race can throw on the very first frame.
- **OCR pipeline**: ML Kit recognizes text → `upiParser.ts` runs source detection (PhonePe / GPay / Paytm markers) → per-source regexes extract amount / recipient / message / txn id / date with confidence flags → the import modal highlights low-confidence fields in amber so the user can correct them.

## License

Personal project. Not licensed for redistribution.
