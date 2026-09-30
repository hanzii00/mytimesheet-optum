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
│   └── config/               Django configuration
├── frontend/                Next.js application
│   └── src/
│       ├── app/              App Router and global styles
│       ├── components/       Dashboard UI
│       └── lib/               Types
├── .env.example
└── package.json              Root convenience scripts
```

## Local setup

### Configuration

Both apps read their settings from gitignored env files. Create them from the template:

```bash
cp .env.example .env
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
# paste the output as DJANGO_SECRET_KEY in .env

printf 'NEXT_PUBLIC_API_URL=http://localhost:8000/api\n' > frontend/.env.local
```

Django loads `backend/.env` then the repo-root `.env`; real environment variables always take
precedence, so hosts that inject config directly work unchanged. Every variable is documented in
[`.env.example`](.env.example).

### Backend

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python backend/manage.py migrate
npm run dev:backend
```

The API runs at `http://localhost:8000/api/`. There is no seed/demo data — the attendance table
starts empty and only fills in as you use the Time In / Time Out buttons.

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

Set these in your host's environment (or a production `.env`) — see [`.env.example`](.env.example):

```bash
DJANGO_SECRET_KEY=<unique 50-char key, never reused from dev>
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=api.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
CSRF_TRUSTED_ORIGINS=https://app.example.com
CROSS_SITE_COOKIES=true        # only if the frontend is on a different domain
TRUST_PROXY_SSL_HEADER=true    # behind an HTTPS-terminating proxy
```

And for the frontend build: `NEXT_PUBLIC_API_URL=https://api.example.com/api`.

With `DJANGO_DEBUG=false` the app refuses to start on the insecure fallback key and turns on SSL
redirect, HSTS, `X-Frame-Options: DENY`, and secure cookies. Verify with:

```bash
cd backend && python manage.py check --deploy   # should report no issues
```

Two things this setup does **not** solve: it still uses SQLite, which is weak under concurrent
writes (move to PostgreSQL for more than a handful of users), and static files for the Django admin
are unserved (add WhiteNoise or a CDN if you need the admin in production).

## Validation

```bash
npm test
npm run build
```
