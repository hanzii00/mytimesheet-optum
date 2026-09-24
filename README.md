# Tempo Attendance Tracker

A minimal, personal attendance self-record tool built with Next.js and Django REST Framework.

## Features

- **Time In** button — records the exact current server time as today's time in
- **Time Out** button — records the exact current server time as today's time out and computes hours worked
- A running table of every logged day (date, time in, time out, hours worked)
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
cp ../.env.example .env.local
npm run dev
```

The app runs at `http://localhost:3000` (or the next available port) and always reflects live
data from the Django API.

## API endpoints

- `GET /api/records/?month=2026-09` — list attendance records and total minutes worked for a month
- `POST /api/clock-in/` — records the current server time as today's time in
- `POST /api/clock-out/` — records the current server time as today's time out and computes hours worked
- `GET /api/export/?month=2026-09` — downloads an Excel (`.xlsx`) file of the matching records

## Validation

```bash
npm test
npm run build
```
