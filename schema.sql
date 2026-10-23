-- MediBook database schema (SQLite, 3NF)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('patient','doctor','admin')),
  phone         TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patient_profiles (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age         INTEGER,
  gender      TEXT,
  blood_group TEXT,
  address     TEXT,
  allergies   TEXT
);

CREATE TABLE IF NOT EXISTS specializations (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS doctors (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialization_id INTEGER NOT NULL REFERENCES specializations(id),
  qualification     TEXT,
  experience_years  INTEGER NOT NULL DEFAULT 0,
  fee               INTEGER NOT NULL DEFAULT 500,
  bio               TEXT,
  available_days    TEXT NOT NULL DEFAULT '1,2,3,4,5',  -- 0=Sun ... 6=Sat
  start_time        TEXT NOT NULL DEFAULT '09:00',
  end_time          TEXT NOT NULL DEFAULT '17:00',
  slot_minutes      INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS appointments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id    INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,            -- YYYY-MM-DD
  time         TEXT NOT NULL,            -- HH:MM
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','completed','cancelled')),
  notes        TEXT,
  prescription TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Double booking prevention: one ACTIVE appointment per doctor/date/time.
-- A cancelled slot becomes free again.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_slot
  ON appointments(doctor_id, date, time) WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id, date);
CREATE INDEX IF NOT EXISTS idx_appt_doctor  ON appointments(doctor_id, date);

CREATE TABLE IF NOT EXISTS reviews (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id      INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- Live activity feed shown to admins (written by the server on key events)
CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appt_date_status ON appointments(date, status);
CREATE INDEX IF NOT EXISTS idx_reviews_doctor ON reviews(doctor_id);

-- Password reset tokens (only a SHA-256 hash is stored, never the token itself)
CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
