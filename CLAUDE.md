# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ปังพอยต์ — snack stall POS / stock / profit system for a family shop (เจ๊แหม่มสับปะรด). UI text, code comments, SQL comments and the README are in Thai; keep new user-facing strings and comments in Thai. Used on a tablet/phone as a home-screen web app.

Stack: Next.js 15 (App Router) + React 19 + TypeScript, Tailwind CSS 4, Supabase (Postgres + Auth + RLS) via `@supabase/ssr`, deployed on Vercel (Node 22).

## Commands

```bash
npm run dev     # local dev (needs .env.local with NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)
npm run build   # production build + type check
npm run lint    # eslint (next config)
```

There is no test suite. Verify changes with `npm run build` and `npm run lint`.

Database changes: add a new timestamped file in `supabase/migrations/` (never edit an applied migration). Migrations are applied in filename order, either pasted into the Supabase SQL Editor or via `npx supabase db push`. `supabase/setup_accounts.sql` (create the two accounts) and `supabase/reset_test_data.sql` (wipe test data) are one-off scripts, not migrations.

## Architecture

### Two accounts, security enforced in the database
- Only two Supabase Auth users exist: `shop@pangpoint.local` (role `staff`, sells only) and `admin@pangpoint.local` (role `admin`). Emails are internal account names, never sent to. Login page picks the account and asks only for a password (`ACCOUNT_EMAIL` in [src/lib/auth.ts](src/lib/auth.ts)). Public sign-up is disabled.
- `profiles.role` is the source of truth. RLS policies use `public.is_admin()`; staff cannot read costs, sales, history or purchases even via direct API calls. Treat RLS + DB functions as the real security boundary; the app-side checks are UX.
- Costs live in a separate admin-only table `product_costs`; admins read products with cost through the `products_admin` view (`security_invoker`). Staff read `products` directly (no cost column).

### All writes go through Postgres functions (RPC)
Business logic lives in `security definer` plpgsql functions, not in TypeScript: `create_sale`, `void_sale`, `add_stock`, `adjust_stock`, `sales_summary`, `rename_supplier`, `admin_set_password` (helpers: `_receive_stock`, `require_admin`, `_clean_name`). Later migrations `create or replace` earlier versions, so the newest migration defining a function is the current one. When changing behavior, write a new migration that replaces the function.

Key rules implemented there:
- `create_sale` reads prices from the DB; never trust client-sent prices. One bill is entirely retail or entirely wholesale.
- Selling is allowed even when stock goes negative (UI shows a warning).
- Cost = weighted average cost per product, recalculated only on `add_stock`; sales and adjustments snapshot `unit_cost` at that moment.
- Product `kind`: `tier` (fixed retail/wholesale price groups, e.g. ขนมแห้ง 15/14, ขนมปัง 20/16) vs `other` (one product row per full price, e.g. "อื่นๆ 80 บาท"; price unique among `other`, including hidden rows).

### Next.js side
- [src/middleware.ts](src/middleware.ts) → [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts): refreshes the session and redirects unauthenticated users to `/login` (uses `getClaims()`, not `getUser()`).
- Server components / actions use `createClient()` from [src/lib/supabase/server.ts](src/lib/supabase/server.ts); client components use [src/lib/supabase/client.ts](src/lib/supabase/client.ts). `getProfile` / `requireProfile` / `requireAdmin` in [src/lib/auth.ts](src/lib/auth.ts) are `server-only` and React-`cache`d.
- Admin mutations are server actions in `src/app/admin/**/actions.ts`: call `requireAdmin()`, call the RPC, return `ActionResult` (`{ ok: true } | { ok: false; error }`), then `revalidatePath("/admin", "layout")`.
- The sell flow ([src/app/sell/[type]/SellFlow.tsx](src/app/sell/[type]/SellFlow.tsx), `type` = retail | wholesale) is a client component that calls `create_sale` directly from the browser; payments are cash or PromptPay QR (`promptpay-qr` + `qrcode.react`).
- Shared types and Thai label maps are in [src/lib/types.ts](src/lib/types.ts). All date/money formatting goes through [src/lib/format.ts](src/lib/format.ts): timezone `Asia/Bangkok`, Buddhist-era dates (`DD/MM/BB`), and `dayRange()` to turn Thai-local dates into `[from, to)` ISO ranges for queries.
