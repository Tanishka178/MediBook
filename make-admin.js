// Create a new admin account (or promote an existing user to admin).
// Usage:  node make-admin.js "Full Name" email@example.com StrongPassword
const bcrypt = require('bcryptjs');
const { db } = require('./db');

const [name, emailRaw, password] = process.argv.slice(2);
const email = (emailRaw || '').trim().toLowerCase();

if (!name || !email || !password) {
  console.log('Usage: node make-admin.js "Full Name" email@example.com StrongPassword');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { console.log('Enter a valid email.'); process.exit(1); }
if (password.length < 6) { console.log('Password must be at least 6 characters.'); process.exit(1); }

const existing = db.prepare('SELECT id, role FROM users WHERE email=?').get(email);
const hash = bcrypt.hashSync(password, 10);
if (existing) {
  if (existing.role === 'doctor') { console.log('That email belongs to a doctor account. Use a different email.'); process.exit(1); }
  db.prepare(`UPDATE users SET role='admin', password_hash=?, is_active=1 WHERE id=?`).run(hash, existing.id);
  console.log(`Existing user ${email} is now an admin (password updated).`);
} else {
  db.prepare(`INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,'admin')`).run(name.trim(), email, hash);
  console.log(`New admin created: ${email}`);
}
