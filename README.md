# Oakline — Lifestyle E-Commerce Platform

A full-stack, production-oriented lifestyle store (home decor, kitchen & dining, bags, watches, accessories, personal care, gifts) with a customer storefront, customer accounts, transactional checkout, and a role-based admin dashboard. Built for a Bangladesh-first deployment (BDT, divisions/districts shipping zones, Cash on Delivery) with Stripe card payments and an adapter layer for bKash, Nagad and SSLCommerz.

---

## Contents

1. [Features](#features)
2. [Technology stack](#technology-stack)
3. [Architecture](#architecture)
4. [Prerequisites](#prerequisites)
5. [Getting started](#getting-started)
6. [Environment variables](#environment-variables)
7. [Database: migrations & seed](#database-migrations--seed)
8. [Admin account setup](#admin-account-setup)
9. [Payments](#payments)
10. [Image storage (Cloudinary)](#image-storage-cloudinary)
11. [Email](#email)
12. [Testing](#testing)
13. [Production build & deployment](#production-build--deployment)
14. [Security model](#security-model)
15. [Roles & permissions](#roles--permissions)
16. [What is live vs. awaiting credentials](#what-is-live-vs-awaiting-credentials)
17. [Troubleshooting](#troubleshooting)

---

## Features

**Storefront** — admin-managed homepage (hero carousel, categories, trending / best sellers / new arrivals, promo banner, collections, brand story, testimonials, newsletter, Instagram), product listing with database-backed filters (category & subcategory, brand, colour, size, price range, availability, rating, on-sale) and sorting, instant search, product pages (gallery + zoom, variants, stock-aware add to bag, Buy now, specifications, shipping & returns, verified-purchase reviews, related & recently viewed), cart drawer and cart page (coupons, stock warnings, free-delivery meter), multi-step checkout (address book, live delivery quotes, COD / Stripe), order tracking (account and guest lookup), wishlist, customer accounts (profile, addresses, orders, cancellations, return requests, password), blog, and content pages (about, contact, FAQ, policies). SEO: dynamic metadata, canonical URLs, Open Graph, Product/Breadcrumb/Article/FAQ JSON-LD, `sitemap.xml`, `robots.txt`.

**Admin (`/admin`)** — analytics dashboard with date filters, orders (status workflow, payment status, internal notes, tracking, cancellations, refunds, printable invoice + PDF), returns, payments, customers (block/unblock, spend), products (variants, images, specifications, SEO, bulk actions), categories, brands & attributes, inventory (adjustments, low/out-of-stock alerts, movement log, CSV report), coupons, reviews moderation, contact messages & newsletter, homepage & banners, collections, testimonials, blog, shipping zones (division / district / area), store settings, staff & roles (configurable permission matrix), and an activity (audit) log. Global search (Ctrl/⌘ K) and a notification centre.

## Technology stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Route Handlers, Turbopack), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Radix), Lucide icons, Sonner toasts, Recharts |
| Forms & data | React Hook Form + Zod (shared client/server schemas), TanStack Query |
| Database | PostgreSQL 14+ with Prisma ORM 7 (`@prisma/adapter-pg` driver adapter) |
| Auth | Custom session auth: opaque tokens in HTTP-only cookies, HMAC-hashed in DB, bcrypt passwords, RBAC |
| Payments | Cash on Delivery, Stripe Checkout (+ verified webhooks); adapter interface for bKash / Nagad / SSLCommerz |
| Media | Cloudinary (server-side signed uploads with magic-byte validation) |
| Email | Nodemailer (SMTP) with a console fallback in development |
| PDF | pdf-lib (invoices) |
| Tests | Vitest (unit + integration against PostgreSQL), Playwright (end-to-end) |

> **Why custom auth instead of Auth.js?** Auth.js v5 is still in beta, and its credentials provider forces JWT sessions, which makes instant revocation (blocking a customer, removing a staff role, "sign out other devices") awkward. Database sessions give us immediate revocation, per-request permission loading and simple auditing with very little code (`src/lib/auth/*`).

## Architecture

```text
prisma/
  schema.prisma          # 40+ models — catalog, inventory, orders, payments, content, RBAC, audit
  migrations/            # SQL migrations (prisma migrate)
  seed.ts, seed/         # RBAC, settings, Super Admin (from env) and demo content
scripts/create-admin.ts  # create / reset a Super Admin
src/
  app/
    (store)/             # storefront routes (home, products, categories, cart, checkout, account, blog, pages…)
    (auth)/              # login, register, password reset, email verification
    admin/               # admin dashboard (server-guarded by requireStaff)
    api/                 # REST route handlers (public, account, admin, webhooks)
    sitemap.ts, robots.ts
  components/            # ui (shadcn), shared, layout, products, cart, checkout, account, home, admin/*
  hooks/                 # use-cart, use-wishlist, use-selection
  lib/
    api.ts               # route() wrapper: auth, permissions, CSRF origin check, rate limit, Zod, error envelope
    auth/                # sessions, crypto (bcrypt, HMAC token hashing), page guards
    pricing.ts           # pure pricing, coupon, shipping and totals rules (unit tested)
    order-status.ts      # order state machine
    permissions.ts       # permission keys + default role grants
    payments/            # provider interface, Stripe, registry (bKash/Nagad/SSLCommerz adapters)
    validations/         # Zod schemas shared by forms and APIs
    email/, storage/, sanitize.ts, rate-limit.ts, money.ts, env.ts, prisma.ts
  services/              # business logic (catalog, cart, checkout, orders, inventory, coupons, shipping, auth…)
  services/admin/        # admin-side services
  proxy.ts               # coarse redirect for signed-out /admin and /account (Next 16 "proxy", formerly middleware)
tests/
  unit/, integration/, e2e/
```

Key design decisions:

* **Every product has at least one variant.** Simple products get a single default variant; stock lives in `Inventory` (one row per variant). Cart, checkout and inventory logic only ever deal with variants.
* **Denormalized, indexed sort fields** on `Product` (`effectivePrice`, `stockQuantity`, `soldCount`, `ratingAvg`) keep listing filters/sorting in SQL. They are maintained by the services that change the underlying data.
* **Orders are snapshots**: names, SKUs, prices, unit cost and the shipping address are copied onto the order, so later catalog edits never rewrite history.
* **Money is `Decimal(12,2)`** in the database and `decimal.js` in code. No floating-point currency math.
* **Server-authoritative checkout**: one database transaction re-prices the cart, revalidates the coupon (with an atomic usage-limit check), recomputes shipping for the destination, reserves stock with a conditional `UPDATE … WHERE quantity >= n` (no overselling under concurrency), writes the order/payment/history and clears the cart. A client-generated idempotency key (unique in the DB) makes double submissions return the same order.
* **Caching**: Next 16 Cache Components are disabled on purpose: almost every route is session- or database-driven. Settings and the category tree use `unstable_cache` with tag invalidation (`revalidateTag(tag, { expire: 0 })`) on admin writes.

## Prerequisites

* Node.js **20.9+** (tested with Node 24) and npm 10+
* PostgreSQL **14+** (tested with 18)
* Optional: Cloudinary, Stripe and SMTP accounts (see [What is live vs. awaiting credentials](#what-is-live-vs-awaiting-credentials))

## Getting started

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create a database
createdb lifestyle_ecommerce            # or: psql -c "CREATE DATABASE lifestyle_ecommerce"

# 3. Configure environment
cp .env.example .env
#   → set DATABASE_URL, AUTH_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (see below)

# 4. Apply migrations and seed demo data + your Super Admin
npm run db:deploy
npm run db:seed

# 5. Start the dev server
npm run dev                              # http://localhost:3000  — admin at /admin
```

Generate a strong `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Environment variables

All variables are documented in [`.env.example`](.env.example). Server variables are validated at runtime (`src/lib/env.ts`); misconfiguration fails fast with a readable message. Only `NEXT_PUBLIC_*` variables reach the browser, and none of them are secret.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | ≥32 chars; keys the HMAC used to hash session/reset tokens |
| `AUTH_URL`, `NEXT_PUBLIC_APP_URL` | ✅ in prod | Public base URL (links in emails, Stripe redirects, CSRF origin allow-list) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | for seeding | Initial Super Admin (read only by the seed / `admin:create` scripts) |
| `TEST_DATABASE_URL` | for integration tests | A **separate, disposable** database — the suite wipes it |
| `CLOUDINARY_*` | optional | Image uploads in the admin |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_CURRENCY` | optional | Card payments |
| `SMTP_*`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL` | optional | Transactional email |

## Database: migrations & seed

```bash
npm run db:migrate     # dev: create/apply a migration after editing prisma/schema.prisma
npm run db:deploy      # prod/CI: apply pending migrations
npm run db:generate    # regenerate the Prisma client (runs automatically on install/build)
npm run db:seed        # RBAC + settings + Super Admin + demo content (idempotent for RBAC/settings)
npm run db:reset       # DEV ONLY: drop, re-migrate and re-seed
npm run db:studio      # browse data
```

Prisma 7 reads its connection from [`prisma.config.ts`](prisma.config.ts) (which loads `.env`), not from `schema.prisma`.

**Demo content** (skipped with `SEED_DEMO=false`): 10 categories with subcategories, 8 brands, 49 products (with colour/size variants, sale prices, featured items and some low/out-of-stock items), shipping zones for Dhaka / suburbs / rest of Bangladesh, 5 coupons (`WELCOME10`, `FLAT500`, `FREESHIP`, `HOME15`, and the expired `SUMMER20`), banners, homepage sections, collections, testimonials, 3 blog posts, 6 demo customers, 42 historical COD orders across ~4 months (so the dashboard charts have real data) and verified-purchase reviews.

Demo customers (skip them with `SEED_DEMO_CUSTOMERS=false`; e.g. `ayesha@example.com`) use the password `Customer#2026`. They exist only when demo data is seeded — **never seed demo data in production** (`SEED_DEMO=false`).

Product photos in the demo data are hot-linked from Unsplash (free to use). Replace them with your own via the admin (uploads go to Cloudinary).

## Admin account setup

The first Super Admin is created from environment variables — no credentials are hardcoded anywhere.

```bash
# Option A — during seeding
SEED_ADMIN_EMAIL=owner@yourstore.com SEED_ADMIN_PASSWORD='a-long-unique-passphrase' npm run db:seed

# Option B — any time (also resets the password of an existing account and signs it out everywhere)
npm run admin:create -- --email owner@yourstore.com --password 'a-long-unique-passphrase' --name "Store Owner"
```

Then sign in at `/login` — staff are taken to `/admin`. Additional staff are created in **Admin → Staff & roles**. Passwords must be at least 10 characters for Super Admins.

## Payments

| Method | Status |
|---|---|
| Cash on Delivery | Live. Orders start `PENDING / UNPAID`; marking an order **Delivered** records the cash collection and sets the payment to `PAID`. Can be disabled in Settings → Commerce, and per delivery method. |
| Stripe (cards) | Live once keys are set. Uses Stripe Checkout; the order total is calculated on the server. Payment is confirmed **only** by a signature-verified webhook (or by retrieving the session from Stripe on the success page) — never by trusting the redirect. Expired sessions automatically cancel the order and release stock. Refunds are issued through the Stripe API from the order page. |
| bKash / Nagad / SSLCommerz | Adapter slots exist (`src/lib/payments/registry.ts`) and appear at checkout as "coming soon". They report `isConfigured() = false` until a real adapter with verified IPN/webhook handling is implemented — no payment is ever simulated. |

**Stripe setup**

1. Set `STRIPE_SECRET_KEY` (and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) from the Stripe dashboard. `STRIPE_CURRENCY` defaults to `bdt`; use `usd` if your account can't charge BDT.
2. Add a webhook endpoint `https://YOUR_DOMAIN/api/webhooks/stripe` with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Local development: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use the printed `whsec_…` secret.

**Adding a Bangladeshi gateway**: implement the `PaymentProvider` interface (`src/lib/payments/types.ts`) — `initiate()` creates the hosted payment and returns its URL; add a route under `src/app/api/webhooks/<provider>` that verifies the provider's signature/IPN (and re-queries the transaction status server-to-server) before marking the payment paid; register it in `registry.ts`.

## Image storage (Cloudinary)

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (optionally `CLOUDINARY_UPLOAD_FOLDER`). Admin uploads go through `POST /api/admin/uploads`, which requires a staff permission, is rate limited, enforces a 5 MB limit and checks the file's **magic bytes** (JPEG/PNG/WebP/AVIF only — SVG and disguised files are rejected) before uploading server-side. Without Cloudinary, image fields accept pasted URLs instead. `res.cloudinary.com` and `images.unsplash.com` are optimized by `next/image`; other hosts render unoptimized.

## Email

With `SMTP_HOST` (and credentials) set, the store sends: email verification, password reset, order confirmation, order status updates (incl. tracking numbers), and admin alerts (new orders, contact messages → `ADMIN_NOTIFICATION_EMAIL`). Without SMTP, emails are printed to the server log so every flow still works locally.

## Testing

```bash
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint (next/core-web-vitals + TypeScript)
npm run test:unit          # pure business rules: pricing, coupons, shipping, totals, inventory, permissions, order states, validation, upload sniffing
npm run test:integration   # services + API handlers against PostgreSQL (requires TEST_DATABASE_URL)
npm test                   # unit + integration
npm run test:e2e           # Playwright (see below)
```

**Integration tests** run real services against `TEST_DATABASE_URL` (migrated automatically, wiped between files). They cover registration/login/blocking/password reset, cart rules, transactional checkout (totals, stock, coupons, idempotency, concurrent oversell protection, rollback), order lifecycle (transitions, restocking, COD collection, refunds, returns), inventory adjustments, Stripe session verification, and API security (CSRF origin check, validation envelope, rate limiting, RBAC).

**End-to-end tests** need a seeded database and the admin credentials:

```bash
npm run db:seed
E2E_ADMIN_EMAIL=owner@yourstore.com E2E_ADMIN_PASSWORD='…' npm run test:e2e
# or against a running server:
E2E_BASE_URL=http://localhost:3000 E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npm run test:e2e
```

First run: `npx playwright install chromium`.

## Production build & deployment

```bash
npm ci
npm run db:deploy                 # apply migrations
SEED_DEMO=false npm run db:seed   # roles, settings and your Super Admin only
npm run build
npm run start                     # serves on PORT (default 3000)
```

**Any Node host (VPS, Docker, Render, Railway, Fly.io):** run the commands above, put the app behind a TLS-terminating reverse proxy (nginx/Caddy) that forwards `X-Forwarded-For` / `X-Forwarded-Host`, and use a process manager (systemd/PM2). Set `NODE_ENV=production` so session cookies are `Secure`.

**Vercel (automatic deploys):** every push to `main` rebuilds and deploys the whole app. Set `DATABASE_URL` to the **pooled** connection string (runtime) and `DIRECT_URL` to the **direct/non-pooled** one: the build script (`scripts/migrate-on-deploy.mjs`) then applies pending Prisma migrations automatically on production deploys only (never on previews or local builds), retrying while a scale-to-zero database wakes up. If a migration fails, the build fails and the previous version stays live.

Checklist: strong `AUTH_SECRET`; `AUTH_URL`/`NEXT_PUBLIC_APP_URL` set to the public HTTPS origin; Stripe webhook configured; SMTP configured; Cloudinary configured; demo data **not** seeded; database backups enabled.

## Security model

* Passwords: bcrypt (cost 12). Login timing is equalized for unknown emails; errors don't reveal whether an account exists.
* Sessions: 256-bit random tokens in `HttpOnly`, `SameSite=Lax`, `Secure` (prod) cookies; only an HMAC-SHA256 of the token is stored. Blocking a user, resetting a password or changing roles takes effect on the next request; "change password" signs out other devices.
* Authorization: every API route goes through `route()` (`src/lib/api.ts`) which enforces auth, staff status and the specific permission on the **server**; admin pages call `requireStaff(permission)`. The UI only hides what the server would reject.
* CSRF: mutating requests must carry an `Origin`/`Referer` matching the host (plus `SameSite=Lax` cookies). Webhooks are exempt and verify signatures instead.
* Input: Zod validation on every input; Prisma parameterizes all SQL (raw queries use tagged templates); admin rich text is sanitized with an allow-list (`sanitize-html`); user text (reviews, messages) is stripped of HTML; React escapes output.
* Rate limiting (PostgreSQL-backed, works across instances): login, registration, password reset, checkout, coupons, contact, newsletter, reviews, uploads and guest order lookup.
* Never trusted from the browser: prices, discounts, shipping fees, stock, totals, payment status, permissions.
* Customer-facing queries `omit` cost prices; order views strip unit costs and staff-only data. Admin APIs never select `passwordHash`.
* Audit log of admin mutations (`AdminActivityLog`) and order status history with the acting user.
* Security headers (HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`); `poweredByHeader` disabled.

## Roles & permissions

| Role | Can |
|---|---|
| Super Admin | Everything, including staff accounts and critical settings (maintenance, currency/tax/commerce). Its permissions can't be reduced. |
| Admin | Run the store day to day; cannot manage staff or critical settings |
| Manager | Catalog, inventory, orders, customers (view), coupons, reviews, content, messages, shipping |
| Product Manager | Products & catalog; inventory view — no payments or settings |
| Inventory Manager | Products (view), inventory |
| Order Manager | Orders, returns, payments (view), customers (view) — cannot modify settings |
| Content Manager | Banners, homepage, blog, testimonials, reviews, messages |

Permissions per role are editable in **Admin → Staff & roles**, and custom roles can be created.

## What is live vs. awaiting credentials

| Capability | State |
|---|---|
| Catalog, search, filters, cart, wishlist, checkout (COD), orders, tracking, accounts, reviews, coupons, shipping, inventory, admin, RBAC, audit log, analytics | ✅ Fully implemented against PostgreSQL |
| Card payments (Stripe) | ✅ Implemented — needs `STRIPE_*` keys + webhook to be offered at checkout |
| Image uploads | ✅ Implemented — needs `CLOUDINARY_*`; URL entry works without it |
| Transactional email | ✅ Implemented — needs `SMTP_*`; logs to console without it |
| bKash / Nagad / SSLCommerz | 🔌 Adapter architecture only — requires merchant credentials and provider-specific implementation |

## Troubleshooting

* **`Invalid environment configuration`** — a required variable is missing; the message lists which. Compare with `.env.example`.
* **`P1001: Can't reach database server`** — check `DATABASE_URL`, that PostgreSQL is running, and the port.
* **`password authentication failed`** — wrong user/password in `DATABASE_URL`. URL-encode special characters in the password (`@` → `%40`, `#` → `%23`).
* **Prisma client errors after pulling changes** — run `npm run db:generate` and `npm run db:deploy`.
* **Images not loading from a new host** — add it to `images.remotePatterns` in `next.config.ts`, or rely on the unoptimized fallback.
* **Stripe option missing at checkout** — `STRIPE_SECRET_KEY` not set. Payments stay `PENDING` → the webhook isn't reaching `/api/webhooks/stripe` or `STRIPE_WEBHOOK_SECRET` is wrong.
* **Locked out of admin** — `npm run admin:create -- --email you@… --password '…'` resets the account.
* **`429 Too many requests`** while testing — rate-limit windows are stored in the `RateLimit` table; `DELETE FROM "RateLimit";` clears them in development.
* **Integration tests refuse to run** — set `TEST_DATABASE_URL` to a separate, empty database (it is wiped).
