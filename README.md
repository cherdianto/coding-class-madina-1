# Madina United Training Session

A simple mobile-first RSVP/registration app for a weekly football training
session. Built as a beginner-friendly demo — plain HTML/CSS/JS on the
frontend, Vercel serverless functions on the backend, and a Google Sheet as
the database.

## 1. What it does

- Public page (`index.html`): anyone can register with Name, WhatsApp, and
  Position (Player / Goal Keeper / Substitution), see who's already
  registered, and copy a WhatsApp-ready player list.
- Admin page (`admin.html`): PIN-protected. The admin sets the training
  schedule, sets capacity per position, opens/closes registration, adds
  players manually, and removes players.
- All data lives in a Google Sheet — no other database.

## 2. Architecture

```
Browser (index.html / admin.html)
        |
        |  fetch() calls to /api/*
        v
Vercel Serverless Functions (api/*.js)
        |
        |  google-spreadsheet package
        v
Google Sheet (Registrations + Settings tabs)
```

- **Frontend**: plain HTML + Tailwind (via CDN) + vanilla JS. No build step,
  no framework.
- **Backend**: each file in `api/` is one Vercel serverless function
  (Node.js). They are the only code that talks to Google Sheets — the
  service account credentials never reach the browser.
- **Database**: a single Google Sheet with two tabs, `Registrations` and
  `Settings` (see below).

## 3. How the frontend talks to the API

`js/app.js` and `js/admin.js` use `fetch()` to call the JSON endpoints under
`/api/`. Nothing is server-rendered — the pages are static HTML that fill
themselves in after loading.

| Endpoint | Method | Purpose | Auth |
|---|---|---|---|
| `/api/settings` | GET | Public schedule, status, capacity, counts | none |
| `/api/registrations` | GET | Public list of registered players | none |
| `/api/registrations` | POST | Submit a registration | none (server enforces capacity + open/closed) |
| `/api/admin/login` | POST | Exchange a 6-digit PIN for a session token | none |
| `/api/admin/settings` | GET/POST | Read/update schedule, capacity, open/closed | admin token |
| `/api/admin/add-player` | POST | Manually add a registration | admin token |
| `/api/admin/remove-player` | POST | Remove a registration by id | admin token |

The admin token is a short-lived signed string returned by `/api/admin/login`
and sent back as `Authorization: Bearer <token>` on every admin request. It
proves the PIN was correct once — it is not the PIN itself, and the frontend
never receives or stores the PIN.

## 4. Google Sheet structure

Create one spreadsheet with two tabs (the app also auto-creates them with
defaults on first run if they're missing):

### `Registrations`

| id | name | whatsapp | position | created_at |
|---|---|---|---|---|
| (uuid) | Ahmad | 08123456789 | player | 2026-08-12T18:30:00.000Z |

`position` is one of `player`, `gk`, `sub`.

### `Settings`

| key | value |
|---|---|
| admin_pin | 000000 |
| registration_open | TRUE |
| training_date | 2026-08-12 |
| training_time | 20:00 |
| training_info | Weekly football training |
| player_capacity | 6 |
| gk_capacity | 3 |
| sub_capacity | 4 |

You can edit any of these values directly in Google Sheets — including the
PIN — and the app will pick them up on the next request.

## 5. Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new blank
   spreadsheet.
2. Rename it something like "Madina United Training".
3. You don't need to create the tabs yourself — the app creates
   `Registrations` and `Settings` with default values the first time it
   runs, if they don't already exist. You can also create them manually
   using the structure above.
4. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

## 6. Create a Google service account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or reuse one).
3. Enable the **Google Sheets API** for that project.
4. Go to **IAM & Admin → Service Accounts → Create Service Account**.
5. Give it any name (e.g. `madina-united-sheets`), no special roles needed.
6. Open the new service account → **Keys → Add Key → Create new key → JSON**.
   A JSON file downloads — keep it safe, never commit it.
7. From that JSON file you need two values:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`

## 7. Share the Sheet with the service account

Open your Google Sheet → **Share** → paste the service account's
`client_email` → give it **Editor** access. Without this step the API calls
will fail with a permissions error.

## 8. Configure environment variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

Fill in:

```
GOOGLE_SHEET_ID=your-sheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Keep the quotes around `GOOGLE_PRIVATE_KEY` and the `\n` escape sequences
exactly as Google gave them in the JSON file.

On **Vercel**: go to your project → **Settings → Environment Variables** and
add the same three variables (for Production, and Preview if you want preview
deployments to work too). Paste the private key value as-is, including the
`\n` sequences and surrounding `-----BEGIN/END-----` lines.

## 9. Run locally

```bash
npm install
npm install -g vercel   # if you don't have it yet
npm run dev
```

This starts `vercel dev`, which serves the static files and runs the `api/`
functions locally, using the `.env` file for credentials.

## 10. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Follow the prompts to link/create a project, then add the environment
variables in the Vercel dashboard (Section 8) before your first real
deployment, or run `vercel env add` for each one. Redeploy after adding them:

```bash
vercel --prod
```

## 11. Custom domain

In the Vercel dashboard: **Project → Settings → Domains → Add**, then follow
Vercel's instructions to point your domain's DNS (usually a CNAME or A
record) at Vercel. HTTPS is provisioned automatically.

## 12. Security limitations of this demo

This is intentionally a simple demo, not a production auth system:

- The admin "session" is a signed token with a 4-hour expiry (HMAC using a
  server-side secret), not a real session store. Anyone who has both the PIN
  and network access to submit it can get a valid token.
- The signing secret defaults to a fixed string if `ADMIN_TOKEN_SECRET` is
  not set in your environment. For a real deployment, set your own
  `ADMIN_TOKEN_SECRET` env var (any long random string) — the code already
  reads it if present.
- There's no rate limiting on `/api/admin/login`, so the PIN could be
  brute-forced (only 1,000,000 combinations) by a determined attacker with
  API access. Fine for a low-stakes team demo; not fine for anything
  sensitive.
- All server-side validation is basic (length limits, simple regex for
  WhatsApp numbers). It stops obviously bad input, not a determined attacker.
- The public API intentionally never returns `admin_pin` — verify this stays
  true if you extend `/api/settings` or `/api/registrations`.

If you need this for anything beyond an internal team demo, replace the PIN
system with real authentication (e.g. a proper session store, OAuth, or a
hosted auth provider).

## 13. Tech stack recap

- Plain HTML + Tailwind CSS (CDN) + vanilla JavaScript
- Vercel Serverless Functions (Node.js)
- `google-spreadsheet` npm package
- Google Sheets as the only data store

No React, no Next.js, no database server, no ORM.
