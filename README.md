# LENDA — Microfinance Loan Manager (Next.js + Supabase)

A loan management system for microfinance businesses: client onboarding, configurable
qualification rules, a loan approval → disbursement → repayment pipeline, a company
setup section (profile, staff, M-Pesa/bank payment details, landing page content),
a public landing page, and a client-facing loan portal.

Runs on **Next.js 16** and stores its data in **Supabase** (Postgres).

## Project structure

- `app/page.js` — staff admin app (Dashboard, Clients, Loan Rules, Loans, Company Setup)
- `app/landing/page.js` — public marketing landing page (server-rendered)
- `app/portal/page.js` — public client portal (profile picker, apply, track status)
- `app/api/*` — REST API routes backing all of the above
- `lib/store.js` — all data reads/writes go through this one file, backed by Supabase
- `lib/supabaseServer.js` — the Supabase client (server-side only, uses the service role key)
- `supabase-schema.sql` — the one table this app needs, ready to paste into Supabase
- `app/globals.css` — the dark/light theme and shared styles

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In your project, go to **SQL Editor → New query**, paste the contents of
   `supabase-schema.sql`, and click **Run**. This creates one table (`store_kv`)
   that holds all of the app's data as JSON — clients, loans, rules, company
   profile, staff, activity log, everything.
3. Go to **Settings → API** and copy two values:
   - **Project URL** → this is `SUPABASE_URL`
   - **service_role key** (not the `anon` key — this one bypasses Row Level
     Security, which is what lets the server read/write freely) → this is
     `SUPABASE_SERVICE_ROLE_KEY`

   Keep the service role key secret — never put it in client-side code or commit
   it to git. This app only ever uses it inside server files (API routes and the
   landing page's server component), never in a `"use client"` file.

## 2. Local development

```bash
cp .env.example .env.local
# then edit .env.local and paste in your two Supabase values
npm install
npm run dev
```

Visit `http://localhost:3000` for the admin dashboard, `/landing` for the public
page, and `/portal` for the client portal.

## 3. Deploying to Render

1. Push this project to a GitHub repo (the `.env.local` file is gitignored —
   your Supabase keys should never end up in the repo).
2. On [render.com](https://render.com), click **New → Web Service** and connect
   your repo.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. In the service's **Environment** tab, add two environment variables:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key
6. Click **Create Web Service**. Render builds and deploys — you'll get a live
   `.onrender.com` URL. No persistent disk needed this time, since all data now
   lives in Supabase rather than on Render's filesystem.

That's it — the admin dashboard is at the root URL, the public landing page at
`/landing`, and the client portal at `/portal`.

## Deploying to Vercel instead

Works the same way as Render, since storage is now in Supabase rather than on
the local filesystem: import the repo on vercel.com, add the same two
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` environment variables in the
project's Settings, and deploy.

## Security notes (prototype → production)

- **Client portal login** is a plain profile picker, not authentication. Add real
  login (password, OTP, magic link — [Supabase Auth](https://supabase.com/docs/guides/auth)
  is a natural fit since you're already on Supabase) before handling real clients.
- **Staff tab access** is stored per staff record but not enforced — there's no
  login system yet tying a signed-in user to a staff record and restricting routes
  accordingly. Add an auth layer and check the signed-in user against the staff
  record's `tabs` in each admin page/route before shipping.
- **Sensitive data** (national ID numbers, income) should be encrypted at rest —
  consider Postgres column-level encryption or `pgsodium` in Supabase — and
  access-logged before this handles real client financial data.
- **Row Level Security** is enabled on `store_kv` with no policies, which is
  intentional: the app talks to Supabase only through the service role key from
  server-side code, which bypasses RLS. If you ever call Supabase from the
  browser with the `anon` key, you'll need to write explicit RLS policies first.
