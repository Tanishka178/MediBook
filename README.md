# MediBook – Doctor Appointment Booking System

Full-stack project: **HTML + CSS + JavaScript** frontend, **Node.js + Express** backend, **SQL (SQLite)** database.
All data (users, appointments, reviews, notifications) is saved in the database, so it stays after a restart.

## Run it
Needs **Node.js 22.13 or newer** (uses Node's built-in SQLite, so nothing needs compiling).
Run the commands from the project root folder (the one with `package.json`), not from `public/`.
```bash
npm install
npm start          # http://localhost:3000
```
The database file is created automatically in `data/medibook.db`, with sample doctors, on first run.

## Demo logins
| Role    | Email                  | Password     |
|---------|------------------------|--------------|
| Patient | patient@demo.com       | Patient@123  |
| Doctor  | aarav@medibook.com     | Doctor@123   |
| Admin   | admin@medibook.com     | Admin@123    |

Other doctors: priya, rohan, sneha, kabir, ananya, vikram, meera `@medibook.com` (same password).
New patients can sign up from the login page.

## What's new in v2
- **Real-time (Server-Sent Events)**: one open `GET /api/stream` connection per logged-in browser, no extra packages.
  - Slots update live: when someone books or cancels, the slot turns grey/free on every other open booking page and flashes.
  - Notifications arrive instantly as a toast + bell badge (patient, doctor, admin).
  - Appointment lists, dashboards and patient lists refresh by themselves; admin sees a **live activity feed** and an online-users counter.
  - Disabling a user from the admin panel logs them out instantly. A "Live / Reconnecting" pill shows the connection state, and the app auto re-syncs after a drop.
- **Backend**: `realtime.js` hub, activity log table, request logger, `/api/health`, secure cookies in production (`NODE_ENV=production`), `no-store` API caching, clean 400 for bad JSON, graceful shutdown, stronger change-password checks, extra indexes, doctors get a live notification when rated.
- **UI**: new gradient theme, motion, dark mode toggle (remembers your choice), live indicators.

## Forgot password (new)
- **Login page → "Forgot password?"** → enter email → a one-time reset link is created (valid 15 minutes, works once, old links die when a new one is requested).
- The link opens a "Set a new password" screen with show/hide and a strength meter. Only a SHA-256 hash of the token is stored in the DB.
- The response never reveals whether an email is registered. Resetting (or changing) a password logs out every other device.
- **Local testing:** with no email server, the link is printed in the terminal and shown on screen ("Local test mode"). In production (`NODE_ENV=production`) it is never shown on screen.
- **Real emails:** run `npm i nodemailer` and set `SMTP_URL` (for example `smtps://user:pass@smtp.gmail.com`), optionally `MAIL_FROM` and `APP_URL` (your site address).
- **Admin fallback:** Admin → Users → "Reset password" creates a 12-character temporary password, shown once.

## Adding another admin
The default admin is `admin@medibook.com` / `Admin@123`. To add one more, stop the server and run:
```bash
node make-admin.js "Your Name" you@example.com YourPassword
```
If the email already belongs to a patient, that user is promoted to admin. Then start the server and log in with it.

## Features
- **Patient**: sign up, log in, log out, dashboard, search and filter doctors, pick a day and time slot, book, cancel, rate visits, health records (notes and prescriptions), notifications, profile with health info, change password.
- **Doctor**: dashboard with today's schedule, complete visits with notes and prescription, patient list, set working days, hours, slot length and fee.
- **Admin**: analytics overview, all appointments, enable or disable users, add doctors.

## Tech and concepts (useful for interviews)
- **Auth**: bcrypt password hashing, JWT in an httpOnly cookie, role-based access control.
- **Database**: 3NF schema in `schema.sql` (`users`, `patient_profiles`, `doctors`, `specializations`, `appointments`, `reviews`, `notifications`) with foreign keys, CHECK constraints and indexes.
- **Double booking prevention**: a partial unique index `UNIQUE(doctor_id, date, time) WHERE status <> 'cancelled'` plus a transaction. If two people take the same slot, the database rejects the second one and the API returns HTTP 409. A cancelled slot becomes free again.
- **SQL used**: JOINs, GROUP BY and aggregates (admin stats), subqueries, UPSERT (`ON CONFLICT`), transactions.
- **Security**: parameterized queries (no SQL injection), input validation, escaped output (no XSS), helmet headers, login rate limiting.
- **Frontend**: no framework; hash routing, fetch with async/await, responsive layout, accessible forms and focus states.

## Structure
```
server.js    Express API (auth, doctors, appointments, admin, SSE stream)
realtime.js  SSE hub: push events to users / roles / everyone
db.js        DB connection and seed data
schema.sql   Tables, constraints, indexes
public/      index.html, css/style.css, js/app.js
```

## Real-time events (server to browser)
`notification`, `appointments` (data changed, refresh), `slots` (doctor + date changed), `activity` and `presence` (admin only), `doctors`, `kicked`.

## Deploy note
Behind a proxy (Render, Railway, nginx) set `NODE_ENV=production`; the stream already sends `X-Accel-Buffering: no` so events are not buffered.

## Ideas to extend
Email reminders (nodemailer), payments (Razorpay test mode), video consult link, PostgreSQL, deployment on Render or Railway.
