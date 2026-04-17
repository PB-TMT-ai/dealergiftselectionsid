# Dealer Gift Scheme Directory

Internal tool for Sales Managers / Territory Managers to help Q4 dealer-retailers redeem scheme points against gifts. Mobile-first. Next.js + Supabase.

## Seeded users

| Role  | Name        | PIN  |
|-------|-------------|------|
| admin | Admin       | 9999 |
| sm_tm | SM North    | 1111 |
| sm_tm | TM Central  | 2222 |

## 1) Prerequisites

- Node 18+ (Node 20 recommended)
- A Supabase project (create at https://supabase.com/dashboard)
- The source Excel file: `FY 26 Q4 dealer scheme_v2.xlsx` (with sheets `Dealer data` + `Costing`)

## 2) Install

```bash
npm install
cp .env.example .env.local
```

## 3) Create Supabase project + run migration

1. Go to https://supabase.com/dashboard → **New project** (free tier is fine).
2. In the project, open **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Generate a `SESSION_SECRET` (any 32+ char random string):
   ```bash
   openssl rand -hex 32
   ```
4. Paste all three into `.env.local`.
5. Open **SQL Editor → New query**, paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and **Run**.

## 4) Seed the database

```bash
npm run seed -- --file "C:/Users/2750834/Downloads/FY 26 Q4 dealer scheme_v2.xlsx"
```

Expected output:
```
✓ Seed complete.
  gifts_catalog: 6
  retailers:     761
  app_users:     3
```

The seed script is idempotent — safe to re-run.

### Gift point costs (derived)

The FY26 `Costing` sheet only carries ₹ values for physical gifts. The seeder derives
`points_required = gift_value_inr / 5` (matching the prior year's 1 pt = ₹5 ratio), e.g.:

| Gift                                      | ₹        | Points |
|-------------------------------------------|----------|--------|
| Foot massager                             | ₹3,750   | 750    |
| Sony - sound bar, woofer and speakers     | ₹15,000  | 3,000  |
| Robot Vacuum cleaner                      | ₹21,000  | 4,200  |
| Apple iPad                                | ₹34,000  | 6,800  |
| Samsung front-load washing machine        | ₹37,500  | 7,500  |
| Amazon voucher                            | flexible | 1 pt = ₹4 |

## 5) Develop

```bash
npm run dev
# → http://localhost:3000
```

Log in with PIN `1111` (SM/TM view) or `9999` (admin view).

## 6) Deploy to Vercel

1. Push the repo to GitHub.
2. Import the repo in https://vercel.com/new.
3. Add the same 3 env vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`) in **Project → Settings → Environment Variables**.
4. Deploy. No additional configuration required.

## Business rules (enforced at multiple layers)

- **Total redeemed ≤ earned points** — enforced by frontend, `/api/selections`, and the `replace_selections` Postgres RPC.
- **Voucher minimum = 250 points** — enforced by frontend, API, RPC, *and* a database trigger (`trg_voucher_min`) so even raw inserts are rejected.
- **Voucher ₹ conversion: 1 point = ₹4** (physical gifts use their catalog `gift_value_inr`). Constants live in [`src/lib/constants.ts`](src/lib/constants.ts).
- **Save is atomic** — a save replaces all prior selections for the retailer in a single transaction.

## Project layout

```
app/                     # Next.js App Router pages + API routes
  (sm)/...               # SM/TM routes (dashboard, retailer detail)
  (admin)/...            # Admin-only routes
  api/...                # JSON endpoints
components/              # Client components
src/lib/                 # Server/client utilities (constants, session, summary, suggest, export)
src/types/               # Shared TypeScript types
supabase/migrations/     # SQL schema + RPC + trigger
scripts/seed.ts          # Idempotent Excel → DB seeder
```

## Verification checklist

Run through each after first deploy:

- [ ] `npm run build` passes with no errors
- [ ] Mobile (375px): login, dashboard, retailer detail, admin — no horizontal scroll
- [ ] SM/TM can save multiple gifts and reopen to see them persisted
- [ ] `curl -X POST .../api/selections` with total > earned returns 400
- [ ] In Supabase SQL editor, `insert into gift_selections ... (voucher, 249)` raises `voucher minimum is 250 points`
- [ ] Retailer with 249 balance → voucher disabled in UI
- [ ] SM/TM hitting `/admin` → redirected to `/dashboard`
- [ ] Admin export → .xlsx opens with 4 sheets; voucher row ₹ = points × 4
- [ ] Re-running `npm run seed` produces identical counts
