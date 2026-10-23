const { DatabaseSync } = require('node:sqlite'); // built into Node 22.13+ / 24 - nothing to compile
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'medibook.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const raw = new DatabaseSync(DB_PATH);
raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// small wrapper so db.transaction(fn)() works like in other SQLite libraries
const db = {
  prepare: (sql) => raw.prepare(sql),
  exec: (sql) => raw.exec(sql),
  transaction: (fn) => (...args) => {
    raw.exec('BEGIN IMMEDIATE');
    try { const r = fn(...args); raw.exec('COMMIT'); return r; }
    catch (e) { try { raw.exec('ROLLBACK'); } catch {} throw e; }
  },
};
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

// ---------- seed (only on first run) ----------
function seed() {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return;
  const hash = (p) => bcrypt.hashSync(p, 10);

  const specs = [
    ['Cardiologist', '❤️'], ['Dermatologist', '🧴'], ['Pediatrician', '🧸'],
    ['Orthopedic', '🦴'], ['Neurologist', '🧠'], ['Dentist', '🦷'],
    ['General Physician', '🩺'], ['Gynecologist', '🌸'],
  ];
  const insSpec = db.prepare('INSERT INTO specializations(name,icon) VALUES (?,?)');
  specs.forEach((s) => insSpec.run(...s));

  const insUser = db.prepare('INSERT INTO users(name,email,password_hash,role,phone) VALUES (?,?,?,?,?)');
  const insDoc = db.prepare(`INSERT INTO doctors(user_id,specialization_id,qualification,experience_years,fee,bio,available_days,start_time,end_time,slot_minutes)
                             VALUES (?,?,?,?,?,?,?,?,?,?)`);

  db.transaction(() => {
    insUser.run('Admin', 'admin@medibook.com', hash('Admin@123'), 'admin', '9000000000');

    const docs = [
      ['Dr. Aarav Mehta', 'aarav@medibook.com', 1, 'MBBS, MD (Cardiology)', 14, 900, 'Senior cardiologist focused on preventive heart care and non-invasive diagnostics.', '1,2,3,4,5', '09:00', '15:00', 30],
      ['Dr. Priya Sharma', 'priya@medibook.com', 2, 'MBBS, MD (Dermatology)', 9, 700, 'Skin, hair and cosmetic dermatology with a patient-first approach.', '1,2,3,4,5,6', '10:00', '18:00', 30],
      ['Dr. Rohan Verma', 'rohan@medibook.com', 3, 'MBBS, DCH', 11, 600, 'Caring for newborns, toddlers and teens, including vaccination programs.', '1,2,3,4,5,6', '09:00', '14:00', 20],
      ['Dr. Sneha Iyer', 'sneha@medibook.com', 4, 'MBBS, MS (Orthopedics)', 12, 850, 'Joint replacement, sports injuries and spine care.', '2,3,4,5,6', '11:00', '17:00', 30],
      ['Dr. Kabir Nair', 'kabir@medibook.com', 5, 'MBBS, DM (Neurology)', 16, 1200, 'Migraine, epilepsy and stroke rehabilitation specialist.', '1,3,5', '10:00', '16:00', 30],
      ['Dr. Ananya Reddy', 'ananya@medibook.com', 6, 'BDS, MDS', 7, 500, 'Painless dentistry, root canals, aligners and smile design.', '1,2,3,4,5,6', '10:00', '19:00', 30],
      ['Dr. Vikram Singh', 'vikram@medibook.com', 7, 'MBBS, MD (Medicine)', 20, 400, 'Family physician for fevers, diabetes, BP and everyday health concerns.', '0,1,2,3,4,5,6', '08:00', '20:00', 15],
      ['Dr. Meera Kapoor', 'meera@medibook.com', 8, 'MBBS, MS (OBG)', 13, 800, 'Pregnancy care, PCOS, fertility counselling and women\'s wellness.', '1,2,3,4,5', '10:00', '16:00', 30],
    ];
    docs.forEach(([name, email, spec, qual, exp, fee, bio, days, st, en, sl]) => {
      const uid = insUser.run(name, email, hash('Doctor@123'), 'doctor', '98' + Math.floor(10000000 + Math.random() * 89999999)).lastInsertRowid;
      insDoc.run(uid, spec, qual, exp, fee, bio, days, st, en, sl);
    });

    const pid = insUser.run('Rahul Kumar', 'patient@demo.com', hash('Patient@123'), 'patient', '9876543210').lastInsertRowid;
    db.prepare('INSERT INTO patient_profiles(user_id,age,gender,blood_group,address,allergies) VALUES (?,?,?,?,?,?)')
      .run(pid, 24, 'Male', 'B+', 'Patna, Bihar', 'None');

    // sample appointments so dashboards are not empty
    const ins = db.prepare('INSERT INTO appointments(patient_id,doctor_id,date,time,reason,status,notes,prescription) VALUES (?,?,?,?,?,?,?,?)');
    ins.run(pid, 7, addDays(-10), '10:00', 'Fever and cold', 'completed', 'Viral fever. Rest and fluids advised.', 'Paracetamol 500mg - twice daily for 3 days');
    ins.run(pid, 2, addDays(-4), '11:00', 'Skin allergy', 'completed', 'Mild contact dermatitis.', 'Cetirizine 10mg at night, moisturizer');
    ins.run(pid, 1, addDays(2), '10:00', 'Routine heart checkup', 'booked', null, null);
    db.prepare('INSERT INTO notifications(user_id,message) VALUES (?,?)').run(pid, 'Welcome to MediBook! Book your first appointment today.');
  })();
}
seed();

module.exports = { db, iso, addDays };
