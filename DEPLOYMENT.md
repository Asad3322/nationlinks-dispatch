# NationLinks Dispatch — Deployment & Handover

Deploy once, then share the resulting URL. Whoever opens that link uses the
app in their browser — nothing to install.

---

## What the other person needs

Just the URL, e.g. `https://nationlinks-dispatch.vercel.app`.

They open it in any browser on any device. There is **no login**: anyone with
the link has full access to view, add, edit and delete payment records. Treat
the link itself as the password and only share it with people you trust.

---

## One-time deployment (about 10 minutes)

### 1. Push the code to GitHub

The remote is already set to `github.com/Asad3322/nationlinks-dispatch`.

```bash
git add -A
git commit -m "Supabase-backed dispatch app ready for deployment"
git push origin main
```

`.env.local` is gitignored and will NOT be pushed. Secrets go in step 3.

### 2. Create the Vercel project

1. Go to https://vercel.com/new and sign in with GitHub.
2. Import the `nationlinks-dispatch` repository.
3. Leave the build settings as detected (Next.js). Do not deploy yet —
   add the environment variables first.

### 3. Add environment variables

In the import screen (or Project → Settings → Environment Variables), add
these four for **Production, Preview and Development**.

| Name | Value |
| --- | --- |
| `DATABASE_URL` | `postgresql://postgres.jozzgfkxssqgnauxafky:PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | `postgresql://postgres.jozzgfkxssqgnauxafky:PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jozzgfkxssqgnauxafky.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key from your `.env.local` |

Replace `PASSWORD` with your database password, **URL-encoded**. The current
password contains `@`, `#` and `$`, which must be written as `%40`, `%23` and
`%24` — copy the encoded value straight out of your local `.env.local`.

> **Why port 6543 here but 5432 locally?**
> Vercel runs many short-lived server instances, and each opens its own
> database connection. Port 6543 is the transaction pooler, which shares a
> small set of connections and stops the database running out. Locally there
> is only one long-lived server, so port 5432 (session mode) is used instead
> because it is measurably faster from a distant machine.

### 4. Deploy

Click **Deploy**. The build runs `prisma generate` automatically via the
`postinstall` script. When it finishes, Vercel gives you the URL — that is
what you send.

### 5. Confirm the region

`vercel.json` pins the app to `icn1` (Seoul), the same region as the Supabase
database, so queries are fast. If Vercel warns the region is unavailable on
your plan, set the closest available one in Project → Settings → Functions.

---

## Everyday use

Recording a payment is the whole workflow: type a driver number and an amount,
press SUBMIT. If the driver number is new it is registered automatically —
there is no separate "add driver" step.

- **Dashboard** — record payments, see each driver's total, export to Excel.
- **Drivers** — all drivers, with View / Edit / Deactivate / Delete.
- **Payment Ledger** — every transaction, editable and voidable, with an audit note.

**Deactivate vs Delete.** Deactivate keeps the payment history and blocks new
payments — use this normally. Delete permanently removes the driver *and every
payment they have*. There is no undo and no backup: once deleted, the money
history is gone.

**Excel export** exports exactly what the current filters show. With no filters
set, it exports every record.

---

## Making changes later

Push to `main` and Vercel redeploys automatically:

```bash
git add -A && git commit -m "your change" && git push
```

Locally:

```bash
npm install
npm run dev          # http://localhost:3000
npm run db:verify    # check the Supabase connection
```

---

## Things worth knowing

- **No login.** Anyone with the URL has full control. If that stops being
  acceptable, a shared-password gate is a small change.
- **Row Level Security is enabled** on both tables, so the public Supabase API
  cannot read or write them. The app connects as the `postgres` role, which
  bypasses RLS. Do not disable this.
- **No backups are configured.** Supabase's free tier keeps limited backups;
  check your project's settings if the payment history matters.
- **The database password is a secret.** It lives only in `.env.local` (never
  committed) and in Vercel's environment variables.
