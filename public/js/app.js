/* MediBook front-end: vanilla JS single page app with hash routing. */
'use strict';

// ---------- utilities ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>', file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 010 7M18 14.5c2.5.6 4 2.3 4 5.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', bell: '<path d="M6 17V11a6 6 0 1112 0v6l2 2H4z"/><path d="M10 21h4"/>',
  logout: '<path d="M10 4H5a2 2 0 00-2 2v12a2 2 0 002 2h5M16 8l4 4-4 4M20 12H9"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12l5 5 9-10"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>', rupee: '<path d="M6 4h12M6 9h12M6 4c6 0 8 2 8 5s-2 5-8 5l7 7"/>', heart: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14 3h-4l-.6 2.7a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2L10 21h4l.6-2.7a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
};
ICONS.moon = '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>';
ICONS.sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
ICONS.eye = '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
ICONS.eyeoff = '<path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.5 6.6A17 17 0 002 12s3.6 7 10 7a9.6 9.6 0 004-.9M9.9 9.9a3 3 0 004.2 4.2"/>';
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const applyTheme = (t) => { document.documentElement.dataset.theme = t; store.set('mb-theme', t); };
applyTheme(store.get('mb-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
const icon = (n, extra = '') => `<svg class="i ${extra}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const starSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';

const COLORS = ['#0b7f74', '#2c6bd6', '#c2410c', '#7c3aed', '#be185d', '#0f766e', '#b45309', '#4338ca'];
const initials = (n) => n.replace(/^Dr\.\s*/i, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const avatar = (name, cls = '') => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `<div class="avatar ${cls}" style="background:${COLORS[h % COLORS.length]}">${esc(initials(name))}</div>`; };
const D = (s) => new Date(s + 'T00:00:00');
const fmtDate = (s) => D(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => isoDate(new Date());
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ago = (s) => { const d = new Date(s.replace(' ', 'T') + 'Z'), m = Math.floor((Date.now() - d) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} hr ago` : `${Math.floor(m / 1440)} d ago`; };
const stars = (r) => r ? `<span class="star-mini">${starSvg}</span> ${r}` : 'New';

function toast(msg, bad = false, live = false) {
  const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : '') + (live ? ' live' : ''); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3800);
}
async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.user && path !== '/auth/login') { state.user = null; renderAuth(); toast('Session expired. Please log in again.', true); }
    throw new Error(data.error || 'Something went wrong.');
  }
  return data;
}
function modal(html, { onMount } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="overlay" role="dialog" aria-modal="true"><div class="modal">${html}</div></div>`;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', esc_); };
  const esc_ = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', esc_);
  $('.overlay', root).addEventListener('mousedown', (e) => e.target.classList.contains('overlay') && close());
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  const f = root.querySelector('input,textarea,select,button.btn'); f && f.focus();
  onMount && onMount(root, close);
  return close;
}
const confirmBox = (title, text, okLabel, danger = true) => new Promise((resolve) => {
  const close = modal(`<h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>
    <div class="actions"><button class="btn ghost" data-close>Keep it</button><button class="btn ${danger ? 'danger' : ''}" id="ok">${esc(okLabel)}</button></div>`, {
    onMount: (r) => { r.querySelector('[data-close]').addEventListener('click', () => resolve(false)); $('#ok', r).addEventListener('click', () => { close(); resolve(true); }); },
  });
});
const loading = () => `<div class="loading"><div class="spinner"></div>Loading…</div>`;

const state = { user: null, unread: 0, es: null, tab: null, onSlots: null };

// ---------- password helpers: show/hide + strength meter ----------
function pwStrength(p) {
  const n = (p.length >= 6) + (p.length >= 10) + (/[a-z]/.test(p) && /[A-Z]/.test(p)) + /\d/.test(p) + /[^A-Za-z0-9]/.test(p);
  const score = p.length < 6 ? 1 : Math.min(4, Math.max(1, n - 1));
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] };
}
function enhancePw(root) {
  root.querySelectorAll('input[type=password]').forEach((inp) => {
    const wrap = document.createElement('div'); wrap.className = 'pw';
    inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pw-eye'; b.setAttribute('aria-label', 'Show password'); b.innerHTML = icon('eye');
    b.addEventListener('click', () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.innerHTML = icon(show ? 'eyeoff' : 'eye'); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); });
    wrap.appendChild(b);
    if (inp.hasAttribute('data-meter')) {
      const m = document.createElement('div'); m.className = 'meter'; m.dataset.s = 0; m.innerHTML = '<div><i></i></div><span></span>'; wrap.after(m);
      inp.addEventListener('input', () => { const r = pwStrength(inp.value); m.dataset.s = inp.value ? r.score : 0; m.querySelector('span').textContent = inp.value ? r.label : ''; });
    }
  });
}
const resetToken = () => (location.hash.match(/^#\/reset\/([a-f0-9]{20,})/i) || [])[1];

// ---------- auth screen ----------
function renderAuth(mode = 'login') {
  document.title = 'MediBook – Log in';
  $('#app').innerHTML = `
  <div class="auth">
    <section class="auth-art">
      <div>
        <div class="logo"><span class="logo-mark"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>MediBook</div>
        <h1>See a doctor without the waiting room.</h1>
        <p class="lede">Choose a specialist, pick a time that works for you, and get a confirmed slot in under a minute.</p>
        <div class="slotdemo" aria-hidden="true">
          <div class="who">${avatar('Dr. Aarav Mehta')}<div><b>Dr. Aarav Mehta</b><span>Cardiologist · Tomorrow</span></div></div>
          <div class="slotgrid-demo"><i>9:00</i><i class="off">9:30</i><i>10:00</i><i class="pick">10:30</i><i class="off">11:00</i><i>11:30</i><i>12:00</i><i class="off">12:30</i></div>
        </div>
      </div>
      <div class="trust"><div><b>8+</b>Specialities</div><div><b>30 days</b>Booking window</div><div><b>Free</b>Cancellation</div></div>
    </section>
    <section class="auth-form-wrap">
      <div class="auth-card">
        <h2 id="auth-title">${mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p class="muted">${mode === 'login' ? 'Log in to manage your appointments.' : 'Sign up as a patient to start booking.'}</p>
        <div class="tabs" role="tablist">
          <button role="tab" aria-selected="${mode === 'login'}" data-mode="login">Log in</button>
          <button role="tab" aria-selected="${mode === 'signup'}" data-mode="signup">Sign up</button>
        </div>
        <form id="auth-form" novalidate>
          <div class="err hidden" id="auth-err" role="alert"></div>
          ${mode === 'signup' ? `<div class="field"><label for="a-name">Full name</label><input class="input" id="a-name" autocomplete="name" required></div>
          <div class="field"><label for="a-phone">Phone (optional)</label><input class="input" id="a-phone" type="tel" autocomplete="tel"></div>` : ''}
          <div class="field"><label for="a-email">Email</label><input class="input" id="a-email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="a-pass">Password</label><input class="input" id="a-pass" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="6" ${mode === 'signup' ? 'data-meter' : ''}></div>
          ${mode === 'login' ? '<div class="forgot-row"><button type="button" class="link-btn" data-forgot>Forgot password?</button></div>' : ''}
          <button class="btn block" id="auth-go">${mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        ${mode === 'login' ? `<div class="demo-box"><p>Want to look around? Fill in a demo account:</p>
          <div><button class="btn ghost sm" data-demo="patient@demo.com|Patient@123">Patient</button>
          <button class="btn ghost sm" data-demo="aarav@medibook.com|Doctor@123">Doctor</button>
          <button class="btn ghost sm" data-demo="admin@medibook.com|Admin@123">Admin</button></div></div>` : ''}
      </div>
    </section>
  </div>`;
  enhancePw($('.auth-card'));
  const fg = $('[data-forgot]'); fg && fg.addEventListener('click', () => renderForgot($('#a-email').value.trim()));
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => renderAuth(b.dataset.mode)));
  document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
    const [e, p] = b.dataset.demo.split('|'); $('#a-email').value = e; $('#a-pass').value = p; $('#auth-go').focus();
  }));
  $('#auth-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = $('#auth-err'), btn = $('#auth-go'); err.classList.add('hidden');
    const email = $('#a-email').value.trim(), password = $('#a-pass').value;
    if (!email || !password) { err.textContent = 'Enter your email and password.'; err.classList.remove('hidden'); return; }
    btn.disabled = true; btn.textContent = 'Please wait…';
    try {
      const body = mode === 'login' ? { email, password } : { name: $('#a-name').value, phone: $('#a-phone').value, email, password };
      const { user } = await api(mode === 'login' ? '/auth/login' : '/auth/register', 'POST', body);
      state.user = user; location.hash = '#/'; startApp(); toast(`Welcome, ${user.name.split(' ')[0]}!`);
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = mode === 'login' ? 'Log in' : 'Create account'; }
  });
}

function renderForgot(prefill = '') {
  renderAuth('login'); document.title = 'MediBook – Forgot password';
  $('.auth-card').innerHTML = `<button class="link-btn back" id="back">← Back to login</button>
    <h2>Forgot password?</h2><p class="muted">Enter your account email and we will send you a link to set a new password.</p>
    <form id="ff" novalidate style="margin-top:18px"><div class="err hidden" id="ff-err" role="alert"></div>
      <div class="field"><label for="f-email">Email</label><input class="input" id="f-email" type="email" autocomplete="email" required value="${esc(prefill)}"></div>
      <button class="btn block" id="ff-go">Send reset link</button></form><div id="ff-done"></div>`;
  $('#back').addEventListener('click', () => renderAuth('login')); $('#f-email').focus();
  $('#ff').addEventListener('submit', async (ev) => {
    ev.preventDefault(); const err = $('#ff-err'), btn = $('#ff-go'); err.classList.add('hidden'); btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const r = await api('/auth/forgot', 'POST', { email: $('#f-email').value });
      $('#ff').classList.add('hidden');
      $('#ff-done').innerHTML = `<div class="notice ok"><b>Check your email</b><p>${esc(r.message)} The link works for 15 minutes and only once.</p></div>`
        + (r.dev_link ? `<div class="notice dev"><b>Local test mode</b><p>No email server is set up, so here is your reset link:</p><a class="btn sm" href="${esc(r.dev_link)}">Open reset link</a></div>` : '');
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Send reset link'; }
  });
}
function renderReset(token) {
  renderAuth('login'); document.title = 'MediBook – Reset password';
  const card = $('.auth-card');
  card.innerHTML = `<h2>Set a new password</h2><p class="muted">Choose a strong password you have not used before.</p>
    <form id="rf" novalidate style="margin-top:18px"><div class="err hidden" id="rf-err" role="alert"></div>
      <div class="field"><label for="r-p1">New password</label><input class="input" id="r-p1" type="password" autocomplete="new-password" minlength="6" required data-meter></div>
      <div class="field"><label for="r-p2">Confirm password</label><input class="input" id="r-p2" type="password" autocomplete="new-password" required></div>
      <button class="btn block" id="rf-go">Update password</button></form>`;
  enhancePw(card); $('#r-p1').focus();
  $('#rf').addEventListener('submit', async (ev) => {
    ev.preventDefault(); const err = $('#rf-err'), btn = $('#rf-go'); err.classList.add('hidden');
    const p1 = $('#r-p1').value, p2 = $('#r-p2').value;
    if (p1.length < 6) { err.textContent = 'Password must be at least 6 characters.'; err.classList.remove('hidden'); return; }
    if (p1 !== p2) { err.textContent = 'The two passwords do not match.'; err.classList.remove('hidden'); return; }
    btn.disabled = true; btn.textContent = 'Updating…';
    try {
      await api('/auth/reset', 'POST', { token, password: p1 });
      state.es && state.es.close(); state.user = null; history.replaceState(null, '', location.pathname); renderAuth('login'); toast('Password updated. Please log in.');
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Update password'; }
  });
}

// ---------- shell ----------
const NAV = {
  patient: [['', 'Dashboard', 'home'], ['doctors', 'Find doctors', 'search'], ['appointments', 'My appointments', 'calendar'], ['records', 'Health records', 'file'], ['notifications', 'Notifications', 'bell'], ['profile', 'My profile', 'user']],
  doctor: [['', 'Dashboard', 'home'], ['appointments', 'Appointments', 'calendar'], ['patients', 'My patients', 'users'], ['availability', 'Availability', 'clock'], ['notifications', 'Notifications', 'bell'], ['profile', 'My profile', 'user']],
  admin: [['', 'Overview', 'chart'], ['appointments', 'All appointments', 'calendar'], ['users', 'Users', 'users'], ['add-doctor', 'Add doctor', 'plus']],
};
const TITLES = { '': 'Dashboard', doctors: 'Find doctors', appointments: 'Appointments', records: 'Health records', notifications: 'Notifications', profile: 'My profile', patients: 'My patients', availability: 'Availability', users: 'Users', 'add-doctor': 'Add doctor', book: 'Book appointment' };

function startApp() {
  const u = state.user, role = u.role;
  $('#app').innerHTML = `
  <div class="shell">
    <aside class="side" id="side">
      <div class="logo"><span class="logo-mark"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>MediBook</div>
      <nav class="nav" aria-label="Main">${NAV[role].map(([r, l, ic]) => `<a href="#/${r}" data-route="${r}">${icon(ic)}<span>${l}</span>${r === 'notifications' ? '<em class="badge hidden" id="nav-badge"></em>' : ''}</a>`).join('')}</nav>
      <div class="side-foot">${avatar(u.name, 'sm')}<div><b>${esc(u.name)}</b><span>${role}</span></div></div>
    </aside>
    <div class="scrim" id="scrim"></div>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" id="menu" aria-label="Open menu">${icon('menu')}</button>
        <h1 id="page-title"></h1>
        <span class="live-pill" id="live" title="Real-time connection"><i></i><b>Connecting</b></span>
        <button class="icon-btn" id="theme" aria-label="Toggle dark mode">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
        ${role !== 'admin' ? `<a class="icon-btn" href="#/notifications" aria-label="Notifications">${icon('bell')}<span class="dot hidden" id="bell-dot"></span></a>` : ''}
        <button class="btn ghost" id="logout">${icon('logout')}<span>Log out</span></button>
      </header>
      <main class="page" id="view" tabindex="-1"></main>
    </div>
  </div>`;
  $('#menu').addEventListener('click', () => $('#side').classList.toggle('open'));
  $('#scrim').addEventListener('click', () => $('#side').classList.remove('open'));
  $('#logout').addEventListener('click', async () => {
    await api('/auth/logout', 'POST').catch(() => {}); state.es && state.es.close(); state.user = null; location.hash = ''; renderAuth(); toast('You have been logged out.');
  });
  $('#theme').addEventListener('click', () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); $('#theme').innerHTML = icon(t === 'dark' ? 'sun' : 'moon'); });
  route(); refreshBadge(); connectLive();
}

// ---------- real-time (Server-Sent Events) ----------
const REFRESH_VIEWS = new Set(['', 'appointments', 'patients', 'records', 'users']);
const currentView = () => location.hash.replace(/^#\/?/, '').split('/')[0] || '';
let softTimer;
const softRefresh = () => { clearTimeout(softTimer); softTimer = setTimeout(() => route(true), 250); };
function setLive(on, text) {
  const el = $('#live'); if (!el) return;
  el.classList.toggle('on', on); el.querySelector('b').textContent = text;
}
function connectLive() {
  if (state.es) state.es.close();
  const es = (state.es = new EventSource('/api/stream'));
  let wasDown = false;
  es.addEventListener('hello', () => { setLive(true, 'Live'); if (wasDown) { wasDown = false; softRefresh(); refreshBadge(); } });
  es.addEventListener('notification', (e) => {
    const n = JSON.parse(e.data); toast(n.message, false, true); refreshBadge();
    if (currentView() === 'notifications') softRefresh();
  });
  es.addEventListener('appointments', () => { if (REFRESH_VIEWS.has(currentView())) softRefresh(); });
  es.addEventListener('slots', (e) => { state.onSlots && state.onSlots(JSON.parse(e.data)); });
  es.addEventListener('presence', (e) => { const el = $('#online-n'); if (el) el.textContent = JSON.parse(e.data).online; });
  es.addEventListener('activity', (e) => { const f = $('#feed'); if (f) { f.insertAdjacentHTML('afterbegin', feedItem(JSON.parse(e.data), true)); while (f.children.length > 12) f.lastElementChild.remove(); } });
  es.addEventListener('kicked', () => { es.close(); state.user = null; renderAuth(); toast('Your account was disabled by an admin.', true); });
  es.onerror = () => {
    wasDown = true; setLive(false, 'Reconnecting');
    if (es.readyState === 2) setTimeout(() => state.user && connectLive(), 4000); // browser gave up, retry ourselves
  };
}
const feedItem = (a, fresh) => `<div class="feed-i k-${esc(a.kind)} ${fresh ? 'fresh' : ''}"><i></i><div>${esc(a.message)}<small>${ago(a.created_at)}</small></div></div>`;
async function refreshBadge() {
  if (!state.user || state.user.role === 'admin') return;
  try {
    const { unread } = await api('/notifications'); state.unread = unread;
    const nb = $('#nav-badge'), bd = $('#bell-dot');
    if (nb) { nb.textContent = unread; nb.classList.toggle('hidden', !unread); }
    if (bd) { bd.textContent = unread; bd.classList.toggle('hidden', !unread); }
  } catch {}
}

// ---------- router ----------
const views = { patient: {}, doctor: {}, admin: {} };
async function route(silent = false) {
  if (!state.user) return;
  if (silent !== true) { silent = false; state.tab = null; state.onSlots = null; }
  const parts = location.hash.replace(/^#\/?/, '').split('/'), name = parts[0] || '', arg = parts[1];
  const role = state.user.role, view = $('#view');
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === (name === 'book' ? 'doctors' : name)));
  $('#side').classList.remove('open');
  const fn = views[role][name] || views.shared[name];
  if (silent && !REFRESH_VIEWS.has(name) && name !== 'notifications') return;
  $('#page-title').textContent = TITLES[name] || 'MediBook'; document.title = `MediBook – ${TITLES[name] || ''}`;
  if (!fn) { view.innerHTML = `<div class="empty"><h3>Page not found</h3><p>That page doesn't exist for your account.</p><a class="btn" href="#/">Go to dashboard</a></div>`; return; }
  view.classList.toggle('no-anim', silent);
  if (!silent) view.innerHTML = loading();
  try { await fn(view, arg); } catch (e) { if (state.user) view.innerHTML = `<div class="empty"><h3>Couldn't load this page</h3><p>${esc(e.message)}</p><button class="btn" onclick="route()">Try again</button></div>`; }
  if (!silent) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => { const t = resetToken(); if (t) return renderReset(t); route(); });

// ---------- shared pieces ----------
function apptCard(a, role, opts = {}) {
  const d = D(a.date), who = role === 'patient' ? a.doctor_name : a.patient_name;
  const sub = role === 'patient' ? `${a.icon || ''} ${esc(a.specialization)}` : esc(a.patient_phone || '');
  const upcoming = a.status === 'booked';
  const acts = [];
  if (upcoming) acts.push(`<button class="btn danger sm" data-cancel="${a.id}">Cancel</button>`);
  if (upcoming && role === 'doctor') acts.unshift(`<button class="btn sm" data-complete="${a.id}">${icon('check')}Complete visit</button>`);
  if (a.status === 'completed' && role === 'patient' && !a.rating) acts.push(`<button class="btn sm" data-rate="${a.id}">Rate visit</button>`);
  const extra = role === 'admin' ? `<div class="small muted">${esc(a.patient_name)} → ${esc(a.doctor_name)}</div>` : '';
  return `<article class="appt">
    <div class="datebox"><b>${d.getDate()}</b><span>${d.toLocaleDateString('en-IN', { month: 'short' })}</span></div>
    <div><h4>${esc(role === 'admin' ? a.specialization : who)}</h4>${extra}<div class="small muted">${sub} · ${fmtTime(a.time)}${a.reason ? ' · ' + esc(a.reason) : ''}</div>
      <div style="margin-top:6px"><span class="badge-s s-${a.status}">${a.status}</span>${a.rating ? ` <span class="small muted">· You rated ${a.rating}/5</span>` : ''}</div></div>
    <div class="acts">${acts.join('')}</div>
    ${a.status === 'completed' && (a.notes || a.prescription) && !opts.hideNotes ? `<div class="note-box">${a.notes ? `<b>Doctor's notes</b>${esc(a.notes)}` : ''}${a.prescription ? `<b style="margin-top:8px">Prescription</b>${esc(a.prescription)}` : ''}</div>` : ''}
  </article>`;
}
function bindApptActions(root, role, reload) {
  root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('Cancel this appointment?', 'The slot will be released for other patients.', 'Yes, cancel'))) return;
    try { await api(`/appointments/${b.dataset.cancel}/cancel`, 'PATCH'); toast('Appointment cancelled.'); reload(); refreshBadge(); } catch (e) { toast(e.message, true); }
  }));
  root.querySelectorAll('[data-complete]').forEach((b) => b.addEventListener('click', () => {
    modal(`<h3>Complete visit</h3><p class="muted">Add notes and a prescription. The patient will see them in their health records.</p><br>
      <div class="field"><label for="m-notes">Diagnosis / notes</label><textarea class="input" id="m-notes"></textarea></div>
      <div class="field"><label for="m-rx">Prescription</label><textarea class="input" id="m-rx"></textarea></div>
      <div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="m-save">Save and complete</button></div>`, {
      onMount: (r, close) => $('#m-save', r).addEventListener('click', async () => {
        try { await api(`/appointments/${b.dataset.complete}/complete`, 'PATCH', { notes: $('#m-notes').value, prescription: $('#m-rx').value }); close(); toast('Visit completed.'); reload(); } catch (e) { toast(e.message, true); }
      }),
    });
  }));
  root.querySelectorAll('[data-rate]').forEach((b) => b.addEventListener('click', () => {
    let rating = 0;
    modal(`<h3>How was your visit?</h3><p class="muted">Your rating helps other patients choose.</p><br>
      <div class="stars" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">${starSvg}</button>`).join('')}</div>
      <div class="field" style="margin-top:14px"><label for="m-c">Comment (optional)</label><textarea class="input" id="m-c"></textarea></div>
      <div class="actions"><button class="btn ghost" data-close>Not now</button><button class="btn" id="m-save">Submit rating</button></div>`, {
      onMount: (r, close) => {
        r.querySelectorAll('[data-star]').forEach((s) => s.addEventListener('click', () => { rating = +s.dataset.star; r.querySelectorAll('[data-star]').forEach((x) => x.classList.toggle('on', +x.dataset.star <= rating)); }));
        $('#m-save', r).addEventListener('click', async () => {
          if (!rating) return toast('Pick a star rating first.', true);
          try { await api(`/appointments/${b.dataset.rate}/review`, 'POST', { rating, comment: $('#m-c').value }); close(); toast('Thanks for your feedback!'); reload(); } catch (e) { toast(e.message, true); }
        });
      },
    });
  }));
}
const statCard = (label, value, ic, tone) => `<div class="stat"><div class="ic t-${tone}">${icon(ic)}</div><div><b>${value}</b><span>${label}</span></div></div>`;
const emptyBox = (title, text, cta) => `<div class="empty"><h3>${title}</h3><p>${text}</p>${cta || ''}</div>`;

// ---------- patient views ----------
views.patient[''] = async (v) => {
  const [s, specs, appts] = await Promise.all([api('/patient/summary'), api('/specializations'), api('/appointments')]);
  const first = state.user.name.split(' ')[0], n = s.next;
  v.innerHTML = `
  <section class="hero-card"><div><h2>Hi ${esc(first)}, how are you feeling today?</h2><p>Find the right specialist and book a slot in a few taps.</p>
    <a class="btn" style="margin-top:16px;background:#fff;color:var(--teal-d)" href="#/doctors">${icon('search')}Find a doctor</a></div>
    <div class="next-box">${n ? `<small>Your next appointment</small><b>${esc(n.doctor_name)}</b><span>${fmtDate(n.date)} at ${fmtTime(n.time)}</span>` : `<small>Your next appointment</small><b>Nothing booked</b><span>Book a visit to see it here.</span>`}</div></section>
  <div class="grid stats">${statCard('Upcoming', s.upcoming, 'calendar', 'blue')}${statCard('Completed visits', s.completed, 'check', 'teal')}${statCard('Doctors visited', s.doctorsSeen, 'heart', 'coral')}${statCard('Cancelled', s.cancelled, 'clock', 'sun')}</div>
  <div class="grid two">
    <div class="card"><h3>Browse by speciality</h3><div class="chips">${specs.map((x) => `<a class="chip" style="text-decoration:none" href="#/doctors" data-spec="${x.id}">${x.icon} ${esc(x.name)}</a>`).join('')}</div></div>
    <div class="card"><h3>Recent activity</h3><div class="list">${appts.slice(0, 3).map((a) => `<div class="cell-user">${avatar(a.doctor_name, 'sm')}<div><b>${esc(a.doctor_name)}</b><span>${fmtDate(a.date)} · <span class="badge-s s-${a.status}">${a.status}</span></span></div></div>`).join('') || '<p class="muted">No activity yet.</p>'}</div></div>
  </div>`;
  v.querySelectorAll('a.chip').forEach((a) => a.addEventListener('click', () => { sessionStorage.setItem('spec', a.dataset.spec); }));
};

views.patient.doctors = async (v) => {
  const specs = await api('/specializations');
  let spec = Number(sessionStorage.getItem('spec')) || 0; sessionStorage.removeItem('spec');
  v.innerHTML = `<div class="toolbar"><input class="input" id="q" type="search" placeholder="Search by doctor name or speciality" aria-label="Search doctors">
    <select class="input" id="sort" aria-label="Sort"><option value="">Top rated</option><option value="exp">Most experienced</option><option value="fee">Lowest fee</option></select></div>
    <div class="chips" id="chips"></div><div class="grid docs" id="docs"></div>`;
  const drawChips = () => { $('#chips').innerHTML = `<button class="chip ${!spec ? 'on' : ''}" data-s="0">All</button>` + specs.map((s) => `<button class="chip ${spec === s.id ? 'on' : ''}" data-s="${s.id}">${s.icon} ${esc(s.name)}</button>`).join(''); };
  let timer;
  const load = async () => {
    drawChips();
    const list = await api(`/doctors?search=${encodeURIComponent($('#q').value)}&spec=${spec}&sort=${$('#sort').value}`);
    $('#docs').innerHTML = list.map((d) => `<article class="card doc">
      <div class="doc-top">${avatar(d.name, 'lg')}<div><h3>${esc(d.name)}</h3><div class="muted small">${d.icon} ${esc(d.specialization)}</div><div class="muted small">${esc(d.qualification || '')}</div></div></div>
      <div class="meta"><span class="pill star">${stars(d.rating)}${d.reviews ? ` (${d.reviews})` : ''}</span><span class="pill">${d.experience_years} yrs exp</span><span class="pill">${d.available_days.split(',').map((x) => DAYS[x]).join(', ')}</span></div>
      <p class="small muted">${esc(d.bio || '')}</p>
      <div class="foot"><span class="pill fee">${money(d.fee)} / visit</span><a class="btn sm" href="#/book/${d.id}">Book now</a></div></article>`).join('')
      || `<div style="grid-column:1/-1">${emptyBox('No doctors found', 'Try a different name or clear the speciality filter.')}</div>`;
  };
  $('#chips').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { spec = +b.dataset.s; load(); } });
  $('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  $('#sort').addEventListener('change', load);
  await load();
};

views.patient.book = async (v, id) => {
  const doc = await api(`/doctors/${id}`);
  const workDays = doc.available_days.split(',').map(Number);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  let date = isoDate(days.find((d) => workDays.includes(d.getDay())) || days[0]), time = null;
  v.innerHTML = `<a href="#/doctors" class="small">← Back to doctors</a><br><br>
  <div class="grid book">
    <aside class="card docside">${avatar(doc.name, 'lg')}<h3>${esc(doc.name)}</h3><p class="muted">${doc.icon} ${esc(doc.specialization)}</p><p class="small muted" style="margin-top:8px">${esc(doc.bio || '')}</p>
      <div class="kv"><div><span>Qualification</span><b>${esc(doc.qualification || '-')}</b></div><div><span>Experience</span><b>${doc.experience_years} years</b></div>
      <div><span>Rating</span><b>${stars(doc.rating)}${doc.reviews ? ` (${doc.reviews})` : ''}</b></div><div><span>Consultation fee</span><b>${money(doc.fee)}</b></div>
      <div><span>Hours</span><b>${fmtTime(doc.start_time)} – ${fmtTime(doc.end_time)}</b></div></div>
      ${doc.recent_reviews.length ? `<div class="kv">${doc.recent_reviews.slice(0, 2).map((r) => `<div style="display:block"><b>${esc(r.patient)}</b> <span class="star-mini">${starSvg}</span> ${r.rating}<p class="small muted">${esc(r.comment || '')}</p></div>`).join('')}</div>` : ''}</aside>
    <section class="card"><h3>1. Choose a day</h3><div class="days" id="days"></div>
      <h3 style="margin-top:8px">2. Choose a time <span class="live-tag"><i></i>updates live</span></h3>
      <div class="legend"><span><i></i>Available</span><span><i class="t"></i>Booked</span><span><i class="s"></i>Selected</span></div>
      <div class="slots" id="slots"></div>
      <div class="confirm-bar"><div class="field"><label for="reason">3. Reason for visit (optional)</label><textarea class="input" id="reason" maxlength="300" placeholder="e.g. Chest pain while climbing stairs"></textarea></div>
        <button class="btn block" id="confirm" disabled>Select a time slot</button></div></section>
  </div>`;
  const drawDays = () => {
    $('#days').innerHTML = days.map((d) => { const s = isoDate(d), off = !workDays.includes(d.getDay());
      return `<button class="day ${s === date ? 'on' : ''}" data-d="${s}" ${off ? 'disabled title="Doctor is off this day"' : ''}><small>${DAYS[d.getDay()]}</small><b>${d.getDate()}</b><small>${d.toLocaleDateString('en-IN', { month: 'short' })}</small></button>`; }).join('');
  };
  let lastFree = new Set();
  const drawSlots = async (live = false) => {
    const prev = live ? time : null;
    if (!live) { time = null; updateBtn(); lastFree = new Set(); $('#slots').innerHTML = '<span class="muted">Loading slots…</span>'; }
    const { slots } = await api(`/doctors/${id}/slots?date=${date}`);
    const ok = prev && slots.some((s) => s.time === prev && s.available);
    if (prev && !ok) toast('Someone just booked the slot you picked. Please choose another.', true);
    time = ok ? prev : null; updateBtn();
    $('#slots').innerHTML = slots.length ? slots.map((s) => `<button class="slot ${s.time === time ? 'on' : ''} ${live && !s.available && lastFree.has(s.time) ? 'flash' : ''}" data-t="${s.time}" ${s.available ? '' : 'disabled'}>${fmtTime(s.time)}</button>`).join('') : '<p class="muted">No slots on this day.</p>';
    lastFree = new Set(slots.filter((s) => s.available).map((s) => s.time));
  };
  state.onSlots = (p) => { if (p.doctor_id === doc.id && (!p.date || p.date === date)) drawSlots(true).catch(() => {}); };
  const updateBtn = () => { const b = $('#confirm'); b.disabled = !time; b.textContent = time ? `Confirm ${fmtDate(date)} at ${fmtTime(time)}` : 'Select a time slot'; };
  $('#days').addEventListener('click', (e) => { const b = e.target.closest('.day'); if (b && !b.disabled) { date = b.dataset.d; drawDays(); drawSlots(); } });
  $('#slots').addEventListener('click', (e) => { const b = e.target.closest('.slot'); if (!b || b.disabled) return; time = b.dataset.t; document.querySelectorAll('.slot').forEach((x) => x.classList.toggle('on', x === b)); updateBtn(); });
  $('#confirm').addEventListener('click', async () => {
    const b = $('#confirm'); b.disabled = true; b.textContent = 'Booking…';
    try {
      const a = await api('/appointments', 'POST', { doctor_id: doc.id, date, time, reason: $('#reason').value });
      modal(`<div class="center"><div class="success-ic">${icon('check')}</div><h3>Appointment confirmed</h3>
        <p class="muted">${esc(doc.name)}<br>${fmtDate(a.date)} at ${fmtTime(a.time)}</p></div>
        <div class="actions" style="justify-content:center"><button class="btn ghost" id="again">Book another</button><button class="btn" id="mine">View my appointments</button></div>`, {
        onMount: (r, close) => { $('#mine', r).addEventListener('click', () => { close(); location.hash = '#/appointments'; }); $('#again', r).addEventListener('click', () => { close(); location.hash = '#/doctors'; }); },
      });
      refreshBadge();
    } catch (e) { toast(e.message, true); drawSlots(); }
  });
  drawDays(); await drawSlots();
};

views.patient.appointments = async (v) => {
  let tab = state.tab || 'booked';
  const draw = async () => {
    const all = await api('/appointments');
    const groups = { booked: all.filter((a) => a.status === 'booked').reverse(), completed: all.filter((a) => a.status === 'completed'), cancelled: all.filter((a) => a.status === 'cancelled') };
    v.innerHTML = `<div class="chips">${[['booked', 'Upcoming'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-tab="${k}">${l} (${groups[k].length})</button>`).join('')}</div>
      <div class="list">${groups[tab].map((a) => apptCard(a, 'patient')).join('') || emptyBox(tab === 'booked' ? 'No upcoming appointments' : `No ${tab} appointments`, tab === 'booked' ? 'Book a visit with a specialist near you.' : 'They will appear here.', tab === 'booked' ? '<a class="btn" href="#/doctors">Find a doctor</a>' : '')}</div>`;
    v.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = state.tab = b.dataset.tab; draw(); }));
    bindApptActions(v, 'patient', draw);
  };
  await draw();
};

views.patient.records = async (v) => {
  const list = (await api('/appointments?status=completed'));
  v.innerHTML = `<div class="page-head"><p>Notes and prescriptions from your past visits.</p></div><div class="list">${list.map((a) => `<article class="card"><div class="cell-user">${avatar(a.doctor_name)}<div><b>${esc(a.doctor_name)}</b><span>${esc(a.specialization)} · ${fmtDate(a.date)}</span></div></div>
    <div class="note-box" style="margin-top:14px"><b>Reason for visit</b>${esc(a.reason || 'Not specified')}<b style="margin-top:8px">Diagnosis / notes</b>${esc(a.notes || 'No notes added')}<b style="margin-top:8px">Prescription</b>${esc(a.prescription || 'No prescription')}</div></article>`).join('')
    || emptyBox('No records yet', 'After a doctor completes your visit, notes and prescriptions show up here.', '<a class="btn" href="#/doctors">Book a visit</a>')}</div>`;
};

// ---------- doctor views ----------
views.doctor[''] = async (v) => {
  const s = await api('/doctor/summary');
  v.innerHTML = `<div class="page-head"><h2>Good day, ${esc(state.user.name)}</h2><p>${s.today ? `You have ${s.today} appointment${s.today > 1 ? 's' : ''} today.` : 'No appointments today.'}</p></div>
  <div class="grid stats">${statCard('Today', s.today, 'calendar', 'blue')}${statCard('Upcoming', s.upcoming, 'clock', 'sun')}${statCard('Patients', s.patients, 'users', 'teal')}${statCard('Earnings', money(s.earnings), 'rupee', 'coral')}${statCard(s.rating.n ? `Rating (${s.rating.n})` : 'Rating', s.rating.r || '–', 'star', 'sun')}</div>
  <h3 style="margin-bottom:12px">Today's schedule</h3><div class="list" id="sched">${s.schedule.map((a) => apptCard(a, 'doctor')).join('') || emptyBox('Nothing scheduled today', 'New bookings will appear here.')}</div>`;
  bindApptActions(v, 'doctor', () => views.doctor[''](v));
};
views.doctor.appointments = async (v) => {
  let tab = state.tab || 'booked';
  const draw = async () => {
    const all = await api('/appointments');
    const g = { booked: all.filter((a) => a.status === 'booked').reverse(), completed: all.filter((a) => a.status === 'completed'), cancelled: all.filter((a) => a.status === 'cancelled') };
    v.innerHTML = `<div class="chips">${[['booked', 'Upcoming'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-tab="${k}">${l} (${g[k].length})</button>`).join('')}</div>
      <div class="list">${g[tab].map((a) => apptCard(a, 'doctor')).join('') || emptyBox('Nothing here', 'Appointments will show up as patients book.')}</div>`;
    v.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = state.tab = b.dataset.tab; draw(); }));
    bindApptActions(v, 'doctor', draw);
  };
  await draw();
};
views.doctor.patients = async (v) => {
  const list = await api('/doctor/patients');
  v.innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>Patient</th><th>Age / gender</th><th>Blood group</th><th>Allergies</th><th>Visits</th><th>Last visit</th></tr></thead><tbody>
    ${list.map((p) => `<tr><td><div class="cell-user">${avatar(p.name, 'sm')}<div><b>${esc(p.name)}</b><span>${esc(p.phone || '')}</span></div></div></td><td>${p.age ?? '–'} ${esc(p.gender || '')}</td><td>${esc(p.blood_group || '–')}</td><td>${esc(p.allergies || '–')}</td><td>${p.visits}</td><td>${fmtDate(p.last_visit)}</td></tr>`).join('')}</tbody></table></div>`
    : emptyBox('No patients yet', 'Patients who book with you will be listed here.');
};
views.doctor.availability = async (v) => {
  const { doctor: d } = await api('/profile'), days = d.available_days.split(',').map(Number);
  v.innerHTML = `<div class="card" style="max-width:640px"><h3>Working hours and fee</h3><p class="muted small" style="margin-bottom:16px">Patients can book only inside these hours.</p>
    <form id="f"><div class="field"><label>Working days</label><div class="days-pick">${DAYS.map((n, i) => `<label><input type="checkbox" name="day" value="${i}" ${days.includes(i) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
    <div class="row3"><div class="field"><label for="st">Start time</label><input class="input" type="time" id="st" value="${d.start_time}" required></div>
    <div class="field"><label for="en">End time</label><input class="input" type="time" id="en" value="${d.end_time}" required></div>
    <div class="field"><label for="sl">Slot length</label><select class="input" id="sl">${[10, 15, 20, 30, 45, 60].map((m) => `<option value="${m}" ${m === d.slot_minutes ? 'selected' : ''}>${m} min</option>`).join('')}</select></div></div>
    <div class="field"><label for="fee">Consultation fee (₹)</label><input class="input" type="number" min="0" id="fee" value="${d.fee}" required></div>
    <div class="field"><label for="bio">About you</label><textarea class="input" id="bio" maxlength="400">${esc(d.bio || '')}</textarea></div>
    <button class="btn">Save changes</button></form></div>`;
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/doctor/availability', 'PUT', { days: [...v.querySelectorAll('[name=day]:checked')].map((x) => +x.value), start_time: $('#st').value, end_time: $('#en').value, slot_minutes: +$('#sl').value, fee: +$('#fee').value, bio: $('#bio').value }); toast('Availability saved.'); } catch (err) { toast(err.message, true); }
  });
};

// ---------- admin views ----------
views.admin[''] = async (v) => {
  const s = await api('/admin/summary');
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return isoDate(d); });
  const map = Object.fromEntries(s.last7.map((x) => [x.date, x.n])), max = Math.max(1, ...days.map((d) => map[d] || 0));
  const tot = s.byStatus.reduce((a, b) => a + b.n, 0) || 1, col = { booked: 'var(--blue)', completed: 'var(--teal)', cancelled: 'var(--coral)' };
  const maxSpec = Math.max(1, ...s.bySpec.map((x) => x.n));
  v.innerHTML = `<div class="grid stats">${statCard('Patients', s.patients, 'users', 'blue')}${statCard('Doctors', s.doctors, 'heart', 'teal')}${statCard('Appointments', s.appointments, 'calendar', 'sun')}${statCard('Today', s.today, 'clock', 'coral')}${statCard('Revenue', money(s.revenue), 'rupee', 'teal')}</div>
  <div class="grid two"><div class="card"><h3>Bookings, last 7 days</h3><div class="bars">${days.map((d) => `<div><span>${map[d] || 0}</span><i style="height:${((map[d] || 0) / max) * 100}%"></i><span>${DAYS[D(d).getDay()]}</span></div>`).join('')}</div></div>
  <div class="card"><h3>Appointment status</h3><div class="seg">${s.byStatus.map((x) => `<i style="width:${(x.n / tot) * 100}%;background:${col[x.status]}"></i>`).join('')}</div>
    <div class="seg-leg">${s.byStatus.map((x) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${col[x.status]}"></i> <b>${x.n}</b> ${x.status}</span>`).join('')}</div></div></div>
  <div class="card feed-card" style="margin-top:18px"><h3>Live activity <span class="live-tag"><i></i><span id="online-n">${s.online}</span> online</span></h3><div id="feed">${s.activity.map((a) => feedItem(a)).join('') || '<p class="muted">Activity will appear here in real time.</p>'}</div></div>
  <div class="card" style="margin-top:18px"><h3>Bookings by speciality</h3>${s.bySpec.map((x) => `<div class="hbar"><span>${esc(x.name)}</span><div class="track"><i style="width:${(x.n / maxSpec) * 100}%"></i></div><b>${x.n}</b></div>`).join('')}</div>`;
};
views.admin.appointments = async (v) => {
  const draw = async () => {
    const list = await api('/appointments');
    v.innerHTML = list.length ? `<div class="list">${list.map((a) => apptCard(a, 'admin', { hideNotes: true })).join('')}</div>` : emptyBox('No appointments yet', 'Bookings from patients will show up here.');
    bindApptActions(v, 'admin', draw);
  };
  await draw();
};
views.admin.users = async (v) => {
  const draw = async () => {
    const list = await api('/admin/users'); const q = (v.querySelector('#uq') || {}).value || '';
    v.innerHTML = `<div class="toolbar"><input class="input" id="uq" type="search" placeholder="Search name or email" value="${esc(q)}" aria-label="Search users"></div>
    <div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Phone</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody id="ub"></tbody></table></div>`;
    const rows = () => {
      const t = $('#uq').value.toLowerCase();
      $('#ub').innerHTML = list.filter((u) => (u.name + u.email).toLowerCase().includes(t)).map((u) => `<tr><td><div class="cell-user">${avatar(u.name, 'sm')}<div><b>${esc(u.name)}</b><span>${esc(u.email)}</span></div></div></td>
        <td style="text-transform:capitalize">${u.role}</td><td>${esc(u.phone || '–')}</td><td>${u.created_at.slice(0, 10)}</td>
        <td><span class="badge-s ${u.is_active ? 's-completed' : 's-cancelled'}">${u.is_active ? 'active' : 'disabled'}</span></td>
        <td>${u.role === 'admin' ? '' : `<button class="btn ghost sm" data-toggle="${u.id}">${u.is_active ? 'Disable' : 'Enable'}</button> <button class="btn ghost sm" data-reset="${u.id}">Reset password</button>`}</td></tr>`).join('');
      v.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => { try { await api(`/admin/users/${b.dataset.toggle}/toggle`, 'PATCH'); toast('User updated.'); draw(); } catch (e) { toast(e.message, true); } }));
    };
    $('#ub').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-reset]'); if (!b) return;
      const name = b.closest('tr').querySelector('b').textContent;
      if (!(await confirmBox('Reset password?', `${name} will be logged out everywhere and get a temporary password.`, 'Reset', false))) return;
      try {
        const r = await api(`/admin/users/${b.dataset.reset}/reset-password`, 'POST');
        modal(`<h3>Temporary password</h3><p class="muted">Share this with ${esc(name)} securely. It is shown only once.</p><div class="temp-pw">${esc(r.temp_password)}</div>
          <div class="actions"><button class="btn ghost" id="cp">Copy</button><button class="btn" data-close>Done</button></div>`, {
          onMount: (root) => $('#cp', root).addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(r.temp_password); toast('Copied.'); }),
        });
      } catch (err) { toast(err.message, true); }
    });
    $('#uq').addEventListener('input', rows); rows();
  };
  await draw();
};
views.admin['add-doctor'] = async (v) => {
  const specs = await api('/specializations');
  v.innerHTML = `<div class="card" style="max-width:680px"><h3>Add a new doctor</h3><p class="muted small" style="margin-bottom:16px">The doctor can log in with this email and password, then set their own availability.</p>
    <form id="f"><div class="row2"><div class="field"><label for="n">Full name</label><input class="input" id="n" placeholder="Dr. Full Name" required></div><div class="field"><label for="e">Email</label><input class="input" id="e" type="email" required></div></div>
    <div class="row2"><div class="field"><label for="p">Temporary password</label><input class="input" id="p" type="text" minlength="6" required></div><div class="field"><label for="ph">Phone</label><input class="input" id="ph" type="tel"></div></div>
    <div class="row2"><div class="field"><label for="s">Speciality</label><select class="input" id="s">${specs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label for="q">Qualification</label><input class="input" id="q" placeholder="MBBS, MD"></div></div>
    <div class="row2"><div class="field"><label for="x">Experience (years)</label><input class="input" id="x" type="number" min="0" value="5"></div><div class="field"><label for="fe">Fee (₹)</label><input class="input" id="fe" type="number" min="0" value="500"></div></div>
    <div class="field"><label for="b">About</label><textarea class="input" id="b" maxlength="400"></textarea></div><button class="btn">Add doctor</button></form></div>`;
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/admin/doctors', 'POST', { name: $('#n').value, email: $('#e').value, password: $('#p').value, phone: $('#ph').value, specialization_id: +$('#s').value, qualification: $('#q').value, experience_years: +$('#x').value, fee: +$('#fe').value, bio: $('#b').value }); toast('Doctor added.'); $('#f').reset(); } catch (err) { toast(err.message, true); }
  });
};

// ---------- shared views ----------
views.shared = {};
views.shared.notifications = async (v) => {
  const { items } = await api('/notifications');
  v.innerHTML = `<div class="toolbar" style="justify-content:space-between"><p class="muted">${items.length ? 'Latest updates about your appointments.' : ''}</p>${items.some((n) => !n.is_read) ? '<button class="btn ghost sm" id="mark">Mark all as read</button>' : ''}</div>
    <div class="list">${items.map((n) => `<div class="notif ${n.is_read ? '' : 'unread'}">${icon('bell')}<div>${esc(n.message)}<small>${ago(n.created_at)}</small></div></div>`).join('') || emptyBox('You are all caught up', 'Booking confirmations and updates will appear here.')}</div>`;
  const m = $('#mark'); m && m.addEventListener('click', async () => { await api('/notifications/read', 'POST'); await refreshBadge(); route(); });
};
views.shared.profile = async (v) => {
  const { user, profile: p } = await api('/profile'), isP = user.role === 'patient';
  v.innerHTML = `<div class="grid two"><div class="card"><h3>Personal details</h3><form id="pf">
    <div class="row2"><div class="field"><label for="pn">Full name</label><input class="input" id="pn" value="${esc(user.name)}" required></div><div class="field"><label for="pp">Phone</label><input class="input" id="pp" type="tel" value="${esc(user.phone || '')}"></div></div>
    <div class="field"><label>Email</label><input class="input" value="${esc(user.email)}" disabled></div>
    ${isP ? `<div class="row3"><div class="field"><label for="pa">Age</label><input class="input" id="pa" type="number" min="0" max="120" value="${p.age ?? ''}"></div>
      <div class="field"><label for="pg">Gender</label><select class="input" id="pg">${['', 'Male', 'Female', 'Other'].map((g) => `<option ${p.gender === g ? 'selected' : ''} value="${g}">${g || 'Select'}</option>`).join('')}</select></div>
      <div class="field"><label for="pb">Blood group</label><select class="input" id="pb">${['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => `<option ${p.blood_group === g ? 'selected' : ''} value="${g}">${g || 'Select'}</option>`).join('')}</select></div></div>
      <div class="field"><label for="pad">Address</label><input class="input" id="pad" value="${esc(p.address || '')}"></div>
      <div class="field"><label for="pal">Allergies</label><input class="input" id="pal" placeholder="e.g. Penicillin, peanuts" value="${esc(p.allergies || '')}"></div>` : ''}
    <button class="btn">Save profile</button></form></div>
    <div class="card"><h3>Change password</h3><form id="cp"><div class="field"><label for="c1">Current password</label><input class="input" id="c1" type="password" autocomplete="current-password" required></div>
    <div class="field"><label for="c2">New password</label><input class="input" id="c2" type="password" minlength="6" autocomplete="new-password" required></div><button class="btn ghost">Update password</button></form></div></div>`;
  $('#pf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { name: $('#pn').value, phone: $('#pp').value };
    if (isP) Object.assign(body, { age: $('#pa').value, gender: $('#pg').value, blood_group: $('#pb').value, address: $('#pad').value, allergies: $('#pal').value });
    try { await api('/profile', 'PUT', body); state.user.name = body.name; toast('Profile saved.'); $('.side-foot b').textContent = body.name; } catch (err) { toast(err.message, true); }
  });
  $('#cp').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/auth/change-password', 'POST', { current: $('#c1').value, next: $('#c2').value }); toast('Password updated.'); $('#cp').reset(); } catch (err) { toast(err.message, true); }
  });
};

// ---------- boot ----------
(async function init() {
  const t = resetToken(); if (t) return renderReset(t);
  try { const { user } = await api('/me'); state.user = user; startApp(); } catch { renderAuth(); }
})();
