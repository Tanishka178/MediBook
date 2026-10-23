// Real-time hub using Server-Sent Events (SSE). No extra packages needed.
// Every logged-in browser keeps one open GET /api/stream connection; the server pushes events down it.
const clients = new Map(); // userId -> { role, conns:Set<res> }
let nextEventId = 1;

function send(res, event, data) {
  res.write(`id: ${nextEventId++}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function addClient(user, req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop nginx/Render proxies from buffering the stream
  });
  res.write('retry: 3000\n\n');
  let entry = clients.get(user.id);
  if (!entry) clients.set(user.id, (entry = { role: user.role, conns: new Set() }));
  entry.conns.add(res);
  send(res, 'hello', { online: onlineCount() });
  broadcastPresence();
  req.on('close', () => {
    entry.conns.delete(res);
    if (!entry.conns.size) clients.delete(user.id);
    broadcastPresence();
  });
}

const onlineCount = () => clients.size;

// push to specific users (array of ids) ...
function toUsers(ids, event, data) {
  for (const id of new Set(ids)) {
    const e = clients.get(id);
    if (e) e.conns.forEach((r) => send(r, event, data));
  }
}
// ... or to everyone with a role ('admin') ...
function toRole(role, event, data) {
  clients.forEach((e) => { if (e.role === role) e.conns.forEach((r) => send(r, event, data)); });
}
// ... or to everyone
function toAll(event, data) {
  clients.forEach((e) => e.conns.forEach((r) => send(r, event, data)));
}

let presenceTimer;
function broadcastPresence() {
  clearTimeout(presenceTimer); // debounce bursts of connects/disconnects
  presenceTimer = setTimeout(() => toRole('admin', 'presence', { online: onlineCount() }), 400);
}

// heartbeat keeps connections alive through proxies
const beat = setInterval(() => clients.forEach((e) => e.conns.forEach((r) => r.write(': ping\n\n'))), 25000);
beat.unref();

function closeAll() { clients.forEach((e) => e.conns.forEach((r) => r.end())); clients.clear(); }

module.exports = { addClient, toUsers, toRole, toAll, onlineCount, closeAll };
