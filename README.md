# Tempo Attendance Tracker

A minimal, multi-user attendance self-record tool built with Next.js and Django REST Framework.

## Features

- **Multiple people, one deployment** — everyone enters their name once and gets their own records
- Two-step onboarding: create an account (username + password), then set your shift before the time clock unlocks
- **Time In** button — records the exact current server time as today's time in
- **Time Out** button — records the exact current server time as today's time out and computes hours worked
- Pick **RTO** (return to office) or **WFH** (work from home) for each day you time in
- Time-in labels based on your shift start:
  - **Early bird** — 1 hour or more before shift start
  - **Ahead of the bell** — more than 10 minutes early
  - **Almost late** — within 10 minutes before shift start
  - **Right on time** — exactly at shift start
  - **Late arrival** — after shift start
- A running table of every logged day (date, work location, shift, time in, label, time out, hours worked, night diff)
- Night differential tracking for work between 10 PM and 5 AM
- **Export to Excel** — downloads an `.xlsx` file of the current month's attendance records
- No static or demo data — every row comes from your own recorded time in/out

## Project structure

```text
.
├── backend/                 Django REST API
│   ├── attendance/          AttendanceRecord model, API, Excel export, tests
│   ├── config/               Django configuration
│   └── .env.example          Backend env template
├── frontend/                Next.js application
│   ├── src/
│   │   ├── app/              App Router and global styles
│   │   ├── components/       Dashboard UI
│   │   └── lib/               Types
│   └── .env.example          Frontend env template
└── package.json              Root convenience scripts
```

## Local setup

### Configuration

Each app owns its own gitignored env file, created from the template that sits next to it:

```bash
# Backend
cp backend/.env.example backend/.env
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
# paste the output as DJANGO_SECRET_KEY in backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local
```

Django loads `backend/.env`, then falls back to a repo-root `.env` if one exists; real environment
variables always take precedence, so hosts that inject config directly work unchanged. Next.js reads
`frontend/.env.local` in development and `frontend/.env.production` (or the host's build
environment) for production builds. Every variable is documented in
[`backend/.env.example`](backend/.env.example) and
[`frontend/.env.example`](frontend/.env.example).

### Backend

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python backend/manage.py migrate
npm run dev:backend
```

The API runs at `http://localhost:8000/api/`. There is no seed/demo data — the attendance table
starts empty and only fills in as you use the Time In / Time Out buttons.

#### Database

With `DATABASE_URL` unset the backend uses a local SQLite file, which keeps `npm test` offline and
needs no setup. Point it at a managed Postgres to share one database across machines and deploys.

For Supabase, copy the URI from **Project Settings > Database > Connection string** and prefer the
**Connection pooling** (Session mode, port 5432) option:

```bash
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

The direct `db.<project-ref>.supabase.co` host resolves to **IPv6 only**, so it fails on IPv4-only
networks and on hosts without IPv6 egress. The pooler is reachable over IPv4. Either way, Postgres
traffic on port 5432 is blocked by many corporate networks — if `migrate` hangs, run it from a
different network or from your deployment host, and keep `DATABASE_URL` unset locally to fall back
to SQLite.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:3000` (or the next available port) and always reflects live
data from the Django API.

## API endpoints

Every endpoint is scoped to the signed-in user. Identity comes from the Django session cookie —
there is no `employee` parameter, so one account can never read or change another's records.

### Authentication

Accounts are username + password only. No email, no verification, no third-party sign-in.

- `GET /api/auth/session/` — seeds the CSRF cookie and reports `{"authenticated": bool, "profile": …}`
- `POST /api/auth/register/` — creates an account and signs in; body `{"username": "...", "password": "...", "name": "Display Name"}`
- `POST /api/auth/login/` — body `{"username": "...", "password": "..."}`
- `POST /api/auth/logout/`
- `POST /api/auth/password/` — body `{"current_password": "...", "new_password": "..."}`

### Attendance

- `GET /api/profile/` — returns your profile and whether a shift has been set
- `PUT /api/profile/` — saves the display name and/or shift; body `{"name": "...", "start": "09:00", "end": "18:00"}`
- `GET /api/records/?month=2026-09` — your attendance records and total work/night-diff minutes for a month
- `POST /api/clock-in/` — records the current server time as today's time in; body needs `work_location` (`RTO` or `WFH`), and optionally `shift_start`/`shift_end` in `HH:MM` format
- `POST /api/clock-out/` — records the current server time as today's time out and computes hours worked
- `GET /api/export/?month=2026-09` — downloads an Excel (`.xlsx`) file of your matching records

Unauthenticated requests to the attendance endpoints return `403`. Browser clients must send
`credentials: "include"` and echo the `csrftoken` cookie back as an `X-CSRFToken` header on every
unsafe method; `frontend/src/lib/api.ts` does both automatically.

### Upgrading an existing install

Migration `0007` gives every pre-auth profile a login account named after the old profile key, with
the password disabled. Claim yours before signing in:

```bash
cd backend
python manage.py changepassword <username>
```

## Deployment

The two apps are deployed independently and each gets its own environment.

### Backend

Set these in your host's environment (or in `backend/.env`) — see
[`backend/.env.example`](backend/.env.example):

```bash
DJANGO_SECRET_KEY=<unique 50-char key, never reused from dev>
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=api.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
CSRF_TRUSTED_ORIGINS=https://app.example.com
CROSS_SITE_COOKIES=true        # only if the frontend is on a different domain
TRUST_PROXY_SSL_HEADER=true    # behind an HTTPS-terminating proxy
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
```

`DATABASE_URL` is **required** when `DJANGO_DEBUG=false` — the app refuses to start on SQLite in
production. Run migrations against it once before first boot:

```bash
DATABASE_URL=... .venv/bin/python backend/manage.py migrate
```

### Frontend

Set this in your host's build environment (or in `frontend/.env.production`) — see
[`frontend/.env.example`](frontend/.env.example). It is inlined at **build** time, so changing it
requires a rebuild:

```bash
NEXT_PUBLIC_API_URL=https://api.example.com/api
```

With `DJANGO_DEBUG=false` the app refuses to start on the insecure fallback key and turns on SSL
redirect, HSTS, `X-Frame-Options: DENY`, and secure cookies. Verify with:

```bash
cd backend && python manage.py check --deploy   # should report no issues
```

Two things this setup does **not** solve: static files for the Django admin are unserved (add
WhiteNoise or a CDN if you need the admin in production), and there is no automated backup of the
database — configure that on your database host.

## Validation

```bash
npm test
npm run build
```
