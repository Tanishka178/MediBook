const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, iso } = require('./db');
const rt = require('./realtime');

// ---------- config ----------
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
const SECRET_FILE = path.join(__dirname, 'data', '.jwt_secret');
function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString('hex'));
  return fs.readFileSync(SECRET_FILE, 'utf8');
}
const JWT_SECRET = getSecret();

const app = express();
if (PROD) app.set('trust proxy', 1); // behind Render/Railway/nginx
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
// tiny request logger (API only) + never cache API responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.path === '/stream' || req.path === '/health') return next();
  const t = Date.now();
  res.on('finish', () => console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - t}ms`));
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: PROD ? '1h' : 0 }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts, please try again in a few minutes.' } });

// ---------- helpers ----------
const wrap = (fn) => (req, res, next) => { try { fn(req, res, next); } catch (e) { next(e); } };
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const clean = (s, max = 500) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + 'T00:00:00'));
const timeOk = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
// notify = save in DB + push instantly to the user's open browser tabs
const notify = (userId, message) => {
  const id = db.prepare('INSERT INTO notifications(user_id,message) VALUES (?,?)').run(userId, message).lastInsertRowid;
  rt.toUsers([userId], 'notification', { id, message, created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
};
// activity feed for admins (saved + pushed live)
const logActivity = (kind, message) => {
  db.prepare('INSERT INTO activity(kind,message) VALUES (?,?)').run(kind, message);
  db.prepare('DELETE FROM activity WHERE id <= (SELECT MAX(id) - 200 FROM activity)').run(); // keep the table small
  rt.toRole('admin', 'activity', { kind, message, created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
};
// tell the right people "your data changed, refresh" + tell everyone a doctor's slots changed
function emitAppointmentChange(a, extra = {}) {
  rt.toUsers([a.patient_id, a.doctor_user_id], 'appointments', { id: a.id, ...extra });
  rt.toRole('admin', 'appointments', { id: a.id, ...extra });
  rt.toAll('slots', { doctor_id: a.doctor_id, date: a.date });
}

function setToken(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role, pv: user.password_hash.slice(-12) }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 7 * 24 * 3600 * 1000 });
}
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone });

function auth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return bad(res, 'Please log in first.', 401);
  try {
    const p = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(p.id);
    if (!user) return bad(res, 'Account not found or disabled.', 401);
    if (p.pv !== user.password_hash.slice(-12)) return bad(res, 'Password changed. Please log in again.', 401);
    req.user = user;
    next();
  } catch { return bad(res, 'Session expired. Please log in again.', 401); }
}
const only = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : bad(res, 'Not allowed.', 403);

const doctorOf = (userId) => db.prepare('SELECT * FROM doctors WHERE user_id=?').get(userId);

// ---------- HEALTH + REAL-TIME ----------
app.get('/api/health', (req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()), online: rt.onlineCount() }));
app.get('/api/stream', auth, (req, res) => rt.addClient(req.user, req, res));

// ---------- AUTH ----------
app.post('/api/auth/register', authLimiter, wrap((req, res) => {
  const name = clean(req.body.name, 80), email = clean(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || ''), phone = clean(req.body.phone, 20);
  if (name.length < 2) return bad(res, 'Please enter your full name.');
  if (!emailOk(email)) return bad(res, 'Please enter a valid email.');
  if (password.length < 6) return bad(res, 'Password must be at least 6 characters.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'This email is already registered.', 409);
  const id = db.transaction(() => {
    const uid = db.prepare('INSERT INTO users(name,email,password_hash,role,phone) VALUES (?,?,?,?,?)')
      .run(name, email, bcrypt.hashSync(password, 10), 'patient', phone).lastInsertRowid;
    db.prepare('INSERT INTO patient_profiles(user_id) VALUES (?)').run(uid);
    notify(uid, 'Welcome to MediBook! Book your first appointment today.');
    logActivity('signup', `${name} joined as a patient`);
    return uid;
  })();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  setToken(res, user);
  res.json({ user: publicUser(user) });
}));

app.post('/api/auth/login', authLimiter, wrap((req, res) => {
  const email = clean(req.body.email, 120).toLowerCase(), password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return bad(res, 'Incorrect email or password.', 401);
  if (!user.is_active) return bad(res, 'This account has been disabled. Contact admin.', 403);
  setToken(res, user);
  res.json({ user: publicUser(user) });
}));

// ---------- FORGOT / RESET PASSWORD ----------
const RESET_MINUTES = 15;
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
async function sendResetMail(to, link) {
  // Optional: set SMTP_URL (e.g. smtps://user:pass@smtp.gmail.com) and run `npm i nodemailer` to send real emails.
  if (!process.env.SMTP_URL) return false;
  try {
    const nodemailer = require('nodemailer');
    await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
      from: process.env.MAIL_FROM || 'MediBook <no-reply@medibook.local>', to,
      subject: 'Reset your MediBook password',
      text: `Use this link to set a new password (valid for ${RESET_MINUTES} minutes):\n${link}\n\nIf you did not ask for this, ignore this email.`,
    });
    return true;
  } catch (e) { console.error('Mail failed:', e.message); return false; }
}
app.post('/api/auth/forgot', authLimiter, wrap(async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  if (!emailOk(email)) return bad(res, 'Please enter a valid email.');
  const out = { ok: true, message: 'If that email is registered, a reset link has been sent.' };
  const user = db.prepare('SELECT * FROM users WHERE email=? AND is_active=1').get(email);
  if (user) {
    db.prepare(`DELETE FROM password_resets WHERE expires_at < datetime('now','-1 day')`).run();
    db.prepare(`UPDATE password_resets SET used_at=datetime('now') WHERE user_id=? AND used_at IS NULL`).run(user.id); // old links die
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare(`INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES (?,?,datetime('now','+${RESET_MINUTES} minutes'))`).run(user.id, sha(token));
    const link = `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/#/reset/${token}`;
    console.log(`[password reset] ${email} -> ${link}`);
    const mailed = await sendResetMail(email, link);
    if (!PROD && !mailed) out.dev_link = link; // local testing only, never exposed in production
  }
  res.json(out);
}));

app.post('/api/auth/reset', authLimiter, wrap((req, res) => {
  const token = String(req.body.token || ''), password = String(req.body.password || '');
  if (password.length < 6) return bad(res, 'Password must be at least 6 characters.');
  const row = db.prepare(`SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > datetime('now')`).get(sha(token));
  if (!row) return bad(res, 'This reset link is invalid or has expired. Please request a new one.');
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(password, 10), row.user_id);
    db.prepare(`UPDATE password_resets SET used_at=datetime('now') WHERE user_id=? AND used_at IS NULL`).run(row.user_id);
    notify(row.user_id, 'Your password was changed. If this was not you, contact the admin.');
  })();
  res.json({ ok: true });
}));

app.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/auth/change-password', auth, wrap((req, res) => {
  const current = req.body.current, next = String(req.body.next || '');
  if (!bcrypt.compareSync(String(current || ''), req.user.password_hash)) return bad(res, 'Current password is wrong.');
  if (next.length < 6) return bad(res, 'New password must be at least 6 characters.');
  if (next === current) return bad(res, 'New password must be different from the current one.');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(next, 10), req.user.id);
  setToken(res, db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)); // keep this device logged in
  res.json({ ok: true });
}));

// ---------- PROFILE ----------
app.get('/api/profile', auth, wrap((req, res) => {
  const profile = db.prepare('SELECT age,gender,blood_group,address,allergies FROM patient_profiles WHERE user_id=?').get(req.user.id) || {};
  res.json({ user: publicUser(req.user), profile, doctor: req.user.role === 'doctor' ? doctorOf(req.user.id) : null });
}));

app.put('/api/profile', auth, wrap((req, res) => {
  const name = clean(req.body.name, 80), phone = clean(req.body.phone, 20);
  if (name.length < 2) return bad(res, 'Name is required.');
  db.prepare('UPDATE users SET name=?, phone=? WHERE id=?').run(name, phone, req.user.id);
  if (req.user.role === 'patient') {
    const age = req.body.age === '' || req.body.age == null ? null : Number(req.body.age);
    if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) return bad(res, 'Enter a valid age.');
    db.prepare(`INSERT INTO patient_profiles(user_id,age,gender,blood_group,address,allergies) VALUES (?,?,?,?,?,?)
                ON CONFLICT(user_id) DO UPDATE SET age=excluded.age, gender=excluded.gender, blood_group=excluded.blood_group,
                address=excluded.address, allergies=excluded.allergies`)
      .run(req.user.id, age, clean(req.body.gender, 20), clean(req.body.blood_group, 5), clean(req.body.address, 200), clean(req.body.allergies, 200));
  }
  res.json({ ok: true });
}));

// ---------- NOTIFICATIONS ----------
app.get('/api/notifications', auth, wrap((req, res) => {
  const items = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 30').all(req.user.id);
  res.json({ items, unread: items.filter((n) => !n.is_read).length });
}));
app.post('/api/notifications/read', auth, wrap((req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
}));

// ---------- DOCTORS (public to logged-in users) ----------
const DOC_SELECT = `
  SELECT d.id, u.name, s.name AS specialization, s.icon, d.specialization_id, d.qualification, d.experience_years,
         d.fee, d.bio, d.available_days, d.start_time, d.end_time, d.slot_minutes,
         ROUND((SELECT AVG(rating) FROM reviews r WHERE r.doctor_id=d.id),1) AS rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.doctor_id=d.id) AS reviews
  FROM doctors d JOIN users u ON u.id=d.user_id JOIN specializations s ON s.id=d.specialization_id
  WHERE u.is_active=1`;

app.get('/api/specializations', auth, (req, res) => res.json(db.prepare('SELECT * FROM specializations ORDER BY name').all()));

app.get('/api/doctors', auth, wrap((req, res) => {
  const q = `%${clean(req.query.search, 50)}%`;
  const spec = Number(req.query.spec) || null;
  const sort = req.query.sort;
  let sql = DOC_SELECT + ` AND (u.name LIKE @q OR s.name LIKE @q)` + (spec ? ' AND d.specialization_id=@spec' : '');
  sql += sort === 'fee' ? ' ORDER BY d.fee ASC' : sort === 'exp' ? ' ORDER BY d.experience_years DESC' : ' ORDER BY rating DESC NULLS LAST, d.experience_years DESC';
  res.json(db.prepare(sql).all(spec ? { q, spec } : { q }));
}));

app.get('/api/doctors/:id', auth, wrap((req, res) => {
  const doc = db.prepare(DOC_SELECT + ' AND d.id=?').get(req.params.id);
  if (!doc) return bad(res, 'Doctor not found.', 404);
  doc.recent_reviews = db.prepare(`SELECT r.rating, r.comment, r.created_at, u.name AS patient FROM reviews r
    JOIN users u ON u.id=r.patient_id WHERE r.doctor_id=? ORDER BY r.id DESC LIMIT 5`).all(doc.id);
  res.json(doc);
}));

function slotsFor(doc, date) {
  const dow = new Date(date + 'T00:00:00').getDay();
  if (!doc.available_days.split(',').map(Number).includes(dow)) return [];
  const [sh, sm] = doc.start_time.split(':').map(Number), [eh, em] = doc.end_time.split(':').map(Number);
  const taken = new Set(db.prepare(`SELECT time FROM appointments WHERE doctor_id=? AND date=? AND status<>'cancelled'`).all(doc.id, date).map((r) => r.time));
  const now = new Date(), isToday = date === iso(now), nowMin = now.getHours() * 60 + now.getMinutes();
  const out = [];
  for (let m = sh * 60 + sm; m + doc.slot_minutes <= eh * 60 + em; m += doc.slot_minutes) {
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    out.push({ time: t, available: !taken.has(t) && !(isToday && m <= nowMin) });
  }
  return out;
}
const dateInRange = (date) => {
  const today = iso(new Date()), max = new Date(); max.setDate(max.getDate() + 30);
  return date >= today && date <= iso(max);
};

app.get('/api/doctors/:id/slots', auth, wrap((req, res) => {
  const doc = db.prepare('SELECT * FROM doctors WHERE id=?').get(req.params.id);
  const date = String(req.query.date || '');
  if (!doc) return bad(res, 'Doctor not found.', 404);
  if (!dateOk(date)) return bad(res, 'Invalid date.');
  res.json({ date, slots: dateInRange(date) ? slotsFor(doc, date) : [] });
}));

// ---------- APPOINTMENTS ----------
const APPT_SELECT = `
  SELECT a.*, pu.name AS patient_name, pu.phone AS patient_phone, du.name AS doctor_name, s.name AS specialization, s.icon,
         d.fee, d.user_id AS doctor_user_id,
         (SELECT rating FROM reviews r WHERE r.appointment_id=a.id) AS rating
  FROM appointments a
  JOIN users pu ON pu.id=a.patient_id
  JOIN doctors d ON d.id=a.doctor_id
  JOIN users du ON du.id=d.user_id
  JOIN specializations s ON s.id=d.specialization_id`;

app.post('/api/appointments', auth, only('patient'), wrap((req, res) => {
  const doctorId = Number(req.body.doctor_id), date = String(req.body.date || ''), time = String(req.body.time || '');
  const reason = clean(req.body.reason, 300);
  if (!dateOk(date) || !timeOk(time)) return bad(res, 'Invalid date or time.');
  const doc = db.prepare('SELECT d.*, u.name, u.id AS uid FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.id=? AND u.is_active=1').get(doctorId);
  if (!doc) return bad(res, 'Doctor not found.', 404);
  if (!dateInRange(date)) return bad(res, 'You can book from today up to 30 days ahead.');
  const slot = slotsFor(doc, date).find((s) => s.time === time);
  if (!slot) return bad(res, 'This doctor is not available at that time.');
  if (!slot.available) return bad(res, 'Sorry, this slot was just taken. Please pick another.', 409);
  if (db.prepare(`SELECT 1 FROM appointments WHERE patient_id=? AND date=? AND time=? AND status='booked'`).get(req.user.id, date, time))
    return bad(res, 'You already have another appointment at this time.', 409);
  try {
    const id = db.transaction(() => {
      const aid = db.prepare('INSERT INTO appointments(patient_id,doctor_id,date,time,reason) VALUES (?,?,?,?,?)')
        .run(req.user.id, doctorId, date, time, reason).lastInsertRowid;
      notify(req.user.id, `Appointment confirmed with ${doc.name} on ${date} at ${time}.`);
      notify(doc.uid, `New appointment: ${req.user.name} on ${date} at ${time}.`);
      logActivity('booked', `${req.user.name} booked ${doc.name} · ${date} ${time}`);
      return aid;
    })();
    const created = db.prepare(APPT_SELECT + ' WHERE a.id=?').get(id);
    emitAppointmentChange(created, { action: 'booked' });
    res.status(201).json(created);
  } catch (e) {
    if (/constraint/i.test(String(e.message))) return bad(res, 'Sorry, this slot was just taken. Please pick another.', 409);
    throw e;
  }
}));

app.get('/api/appointments', auth, wrap((req, res) => {
  let where = '', params = [];
  if (req.user.role === 'patient') { where = 'WHERE a.patient_id=?'; params = [req.user.id]; }
  else if (req.user.role === 'doctor') { where = 'WHERE d.user_id=?'; params = [req.user.id]; }
  if (req.query.status) { where += (where ? ' AND' : 'WHERE') + ' a.status=?'; params.push(String(req.query.status)); }
  res.json(db.prepare(APPT_SELECT + ` ${where} ORDER BY a.date DESC, a.time DESC LIMIT 500`).all(...params));
}));

app.patch('/api/appointments/:id/cancel', auth, wrap((req, res) => {
  const a = db.prepare(APPT_SELECT + ' WHERE a.id=?').get(req.params.id);
  if (!a) return bad(res, 'Appointment not found.', 404);
  const allowed = req.user.role === 'admin' || a.patient_id === req.user.id || a.doctor_user_id === req.user.id;
  if (!allowed) return bad(res, 'Not allowed.', 403);
  if (a.status !== 'booked') return bad(res, 'Only upcoming appointments can be cancelled.');
  db.transaction(() => {
    db.prepare(`UPDATE appointments SET status='cancelled' WHERE id=?`).run(a.id);
    const by = req.user.role === 'patient' ? req.user.name : req.user.role === 'doctor' ? a.doctor_name : 'Admin';
    notify(a.patient_id, `Your appointment with ${a.doctor_name} on ${a.date} at ${a.time} was cancelled.`);
    if (req.user.id !== a.doctor_user_id) notify(a.doctor_user_id, `${a.patient_name}'s appointment on ${a.date} at ${a.time} was cancelled by ${by}.`);
    logActivity('cancelled', `${by} cancelled an appointment (${a.patient_name} → ${a.doctor_name}) · ${a.date} ${a.time}`);
  })();
  emitAppointmentChange(a, { action: 'cancelled' });
  res.json({ ok: true });
}));

app.patch('/api/appointments/:id/complete', auth, only('doctor'), wrap((req, res) => {
  const a = db.prepare(APPT_SELECT + ' WHERE a.id=?').get(req.params.id);
  if (!a || a.doctor_user_id !== req.user.id) return bad(res, 'Appointment not found.', 404);
  if (a.status !== 'booked') return bad(res, 'Appointment is not active.');
  db.transaction(() => {
    db.prepare(`UPDATE appointments SET status='completed', notes=?, prescription=? WHERE id=?`)
      .run(clean(req.body.notes, 1000), clean(req.body.prescription, 1000), a.id);
    notify(a.patient_id, `${a.doctor_name} added notes & prescription for your visit on ${a.date}. Please rate your experience.`);
    logActivity('completed', `${a.doctor_name} completed a visit with ${a.patient_name}`);
  })();
  emitAppointmentChange(a, { action: 'completed' });
  res.json({ ok: true });
}));

app.post('/api/appointments/:id/review', auth, only('patient'), wrap((req, res) => {
  const a = db.prepare('SELECT * FROM appointments WHERE id=? AND patient_id=?').get(req.params.id, req.user.id);
  if (!a) return bad(res, 'Appointment not found.', 404);
  if (a.status !== 'completed') return bad(res, 'You can review only completed visits.');
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad(res, 'Rating must be 1 to 5.');
  if (db.prepare('SELECT 1 FROM reviews WHERE appointment_id=?').get(a.id)) return bad(res, 'Already reviewed.', 409);
  db.prepare('INSERT INTO reviews(appointment_id,patient_id,doctor_id,rating,comment) VALUES (?,?,?,?,?)')
    .run(a.id, req.user.id, a.doctor_id, rating, clean(req.body.comment, 300));
  const du = db.prepare('SELECT user_id FROM doctors WHERE id=?').get(a.doctor_id);
  notify(du.user_id, `${req.user.name} rated you ${rating}/5.`);
  rt.toUsers([du.user_id], 'appointments', { id: a.id, action: 'reviewed' });
  res.status(201).json({ ok: true });
}));

// ---------- PATIENT DASHBOARD ----------
app.get('/api/patient/summary', auth, only('patient'), wrap((req, res) => {
  const today = iso(new Date());
  const count = (st) => db.prepare('SELECT COUNT(*) c FROM appointments WHERE patient_id=? AND status=?').get(req.user.id, st).c;
  const next = db.prepare(APPT_SELECT + ` WHERE a.patient_id=? AND a.status='booked' AND a.date>=? ORDER BY a.date, a.time LIMIT 1`).get(req.user.id, today);
  const doctorsSeen = db.prepare('SELECT COUNT(DISTINCT doctor_id) c FROM appointments WHERE patient_id=?').get(req.user.id).c;
  res.json({ upcoming: count('booked'), completed: count('completed'), cancelled: count('cancelled'), doctorsSeen, next });
}));

// ---------- DOCTOR ----------
app.get('/api/doctor/summary', auth, only('doctor'), wrap((req, res) => {
  const d = doctorOf(req.user.id), today = iso(new Date());
  const q = (sql, ...p) => db.prepare(sql).get(d.id, ...p).c;
  res.json({
    today: q(`SELECT COUNT(*) c FROM appointments WHERE doctor_id=? AND date=? AND status='booked'`, today),
    upcoming: q(`SELECT COUNT(*) c FROM appointments WHERE doctor_id=? AND date>=? AND status='booked'`, today),
    completed: q(`SELECT COUNT(*) c FROM appointments WHERE doctor_id=? AND status='completed'`),
    patients: q('SELECT COUNT(DISTINCT patient_id) c FROM appointments WHERE doctor_id=?'),
    earnings: q(`SELECT COUNT(*) c FROM appointments WHERE doctor_id=? AND status='completed'`) * d.fee,
    rating: db.prepare('SELECT ROUND(AVG(rating),1) r, COUNT(*) n FROM reviews WHERE doctor_id=?').get(d.id),
    schedule: db.prepare(APPT_SELECT + ` WHERE a.doctor_id=? AND a.date=? AND a.status='booked' ORDER BY a.time`).all(d.id, today),
  });
}));

app.get('/api/doctor/patients', auth, only('doctor'), wrap((req, res) => {
  const d = doctorOf(req.user.id);
  res.json(db.prepare(`SELECT u.id, u.name, u.phone, p.age, p.gender, p.blood_group, p.allergies,
      COUNT(a.id) AS visits, MAX(a.date) AS last_visit
    FROM appointments a JOIN users u ON u.id=a.patient_id LEFT JOIN patient_profiles p ON p.user_id=u.id
    WHERE a.doctor_id=? AND a.status<>'cancelled' GROUP BY u.id ORDER BY last_visit DESC`).all(d.id));
}));

app.put('/api/doctor/availability', auth, only('doctor'), wrap((req, res) => {
  const days = (Array.isArray(req.body.days) ? req.body.days : []).map(Number).filter((n) => n >= 0 && n <= 6);
  const { start_time, end_time } = req.body, slot = Number(req.body.slot_minutes), fee = Number(req.body.fee);
  if (!days.length) return bad(res, 'Select at least one working day.');
  if (!timeOk(start_time) || !timeOk(end_time) || start_time >= end_time) return bad(res, 'Enter a valid time range.');
  if (![10, 15, 20, 30, 45, 60].includes(slot)) return bad(res, 'Invalid slot length.');
  if (!Number.isInteger(fee) || fee < 0 || fee > 100000) return bad(res, 'Enter a valid fee.');
  db.prepare('UPDATE doctors SET available_days=?, start_time=?, end_time=?, slot_minutes=?, fee=?, bio=? WHERE user_id=?')
    .run([...new Set(days)].sort().join(','), start_time, end_time, slot, fee, clean(req.body.bio, 400), req.user.id);
  rt.toAll('slots', { doctor_id: doctorOf(req.user.id).id, date: null }); // date null = every date
  res.json({ ok: true });
}));

// ---------- ADMIN ----------
app.get('/api/admin/summary', auth, only('admin'), wrap((req, res) => {
  const c = (sql, ...p) => db.prepare(sql).get(...p).c;
  const today = iso(new Date());
  res.json({
    patients: c(`SELECT COUNT(*) c FROM users WHERE role='patient'`),
    doctors: c(`SELECT COUNT(*) c FROM users WHERE role='doctor'`),
    appointments: c('SELECT COUNT(*) c FROM appointments'),
    today: c(`SELECT COUNT(*) c FROM appointments WHERE date=? AND status='booked'`, today),
    revenue: db.prepare(`SELECT COALESCE(SUM(d.fee),0) s FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.status='completed'`).get().s,
    byStatus: db.prepare('SELECT status, COUNT(*) n FROM appointments GROUP BY status').all(),
    bySpec: db.prepare(`SELECT s.name, COUNT(a.id) n FROM specializations s LEFT JOIN doctors d ON d.specialization_id=s.id
      LEFT JOIN appointments a ON a.doctor_id=d.id AND a.status<>'cancelled' GROUP BY s.id ORDER BY n DESC`).all(),
    online: rt.onlineCount(),
    activity: db.prepare('SELECT kind,message,created_at FROM activity ORDER BY id DESC LIMIT 12').all(),
    last7: db.prepare(`SELECT date, COUNT(*) n FROM appointments WHERE status<>'cancelled' AND date BETWEEN date(?, '-6 day') AND ? GROUP BY date`).all(today, today),
  });
}));

app.get('/api/admin/users', auth, only('admin'), wrap((req, res) => {
  res.json(db.prepare(`SELECT id,name,email,role,phone,is_active,created_at FROM users ORDER BY role, id DESC`).all());
}));

app.patch('/api/admin/users/:id/toggle', auth, only('admin'), wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return bad(res, 'User not found.', 404);
  if (u.role === 'admin') return bad(res, 'Admin accounts cannot be disabled.');
  db.prepare('UPDATE users SET is_active=? WHERE id=?').run(u.is_active ? 0 : 1, u.id);
  if (u.is_active) rt.toUsers([u.id], 'kicked', {}); // disabled user is logged out instantly
  res.json({ is_active: u.is_active ? 0 : 1 });
}));

app.post('/api/admin/users/:id/reset-password', auth, only('admin'), wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return bad(res, 'User not found.', 404);
  if (u.role === 'admin') return bad(res, 'Admin passwords cannot be reset here.');
  const temp = crypto.randomBytes(9).toString('base64url'); // 12 chars, shown once
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(temp, 10), u.id);
  notify(u.id, 'An admin reset your password. Log in with the temporary password and change it.');
  logActivity('security', `Admin reset the password of ${u.name}`);
  res.json({ temp_password: temp });
}));

app.post('/api/admin/doctors', auth, only('admin'), wrap((req, res) => {
  const name = clean(req.body.name, 80), email = clean(req.body.email, 120).toLowerCase(), password = String(req.body.password || '');
  const spec = Number(req.body.specialization_id), exp = Number(req.body.experience_years) || 0, fee = Number(req.body.fee) || 500;
  if (name.length < 2 || !emailOk(email)) return bad(res, 'Enter a valid name and email.');
  if (password.length < 6) return bad(res, 'Password must be at least 6 characters.');
  if (!db.prepare('SELECT 1 FROM specializations WHERE id=?').get(spec)) return bad(res, 'Choose a specialization.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'Email already registered.', 409);
  db.transaction(() => {
    const uid = db.prepare('INSERT INTO users(name,email,password_hash,role,phone) VALUES (?,?,?,?,?)')
      .run(name, email, bcrypt.hashSync(password, 10), 'doctor', clean(req.body.phone, 20)).lastInsertRowid;
    db.prepare('INSERT INTO doctors(user_id,specialization_id,qualification,experience_years,fee,bio) VALUES (?,?,?,?,?,?)')
      .run(uid, spec, clean(req.body.qualification, 100), exp, fee, clean(req.body.bio, 400));
    logActivity('doctor', `Admin added ${name}`);
  })();
  rt.toAll('doctors', {});
  res.status(201).json({ ok: true });
}));

// ---------- fallbacks ----------
app.use('/api', (req, res) => bad(res, 'Not found.', 404));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return bad(res, 'Invalid JSON.');
  if (err.type === 'entity.too.large') return bad(res, 'Request too large.', 413);
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

if (require.main === module) {
  const server = app.listen(PORT, () => console.log(`MediBook running at http://localhost:${PORT}`));
  const stop = () => { rt.closeAll(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
module.exports = app;
