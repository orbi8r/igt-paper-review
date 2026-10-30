// Presenter server. Serves ./web read only, the laptop page and the phone page, and relays commands.
// Run: node server.js   (env PORT, default 8787)
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');

const PORT = +process.env.PORT || 8787;
const HERE = __dirname, WEB = path.join(HERE, 'web');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

const clients = new Set();
let lastState = null;
const send = (res, o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
const lapCount = () => [...clients].filter(c => c.role === 'laptop').length;
const broadcast = (o, role) => clients.forEach(c => { if (!role || c.role === role) send(c.res, o); });

function serveFile(res, root, rel) {
  const p = path.normalize(path.join(root, decodeURIComponent(rel)));
  if (!p.startsWith(root + path.sep) && p !== root) { res.writeHead(403); return res.end(); }
  fs.stat(p, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(p).pipe(res);
  });
}

const body = req => new Promise(r => { let b = ''; req.on('data', d => b += d); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); });

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  if (p === '/' || p === '/laptop') return serveFile(res, HERE, 'laptop.html');
  if (p === '/phone') return serveFile(res, HERE, 'phone.html');
  if (p === '/deck.json') return serveFile(res, HERE, 'deck_config.json');
  if (p === '/slides.json') return serveFile(res, HERE, 'slides.json');
  if (p.startsWith('/web/')) return serveFile(res, WEB, p.slice(5));
  if (p === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const c = { res, role: u.searchParams.get('role') || 'phone' };
    clients.add(c);
    send(res, { type: 'hello', laptop: lapCount() > 0, state: lastState });
    if (c.role === 'laptop') broadcast({ type: 'laptop', laptop: true }, 'phone');
    const ka = setInterval(() => res.write(': ka\n\n'), 15000);
    req.on('close', () => { clearInterval(ka); clients.delete(c); if (c.role === 'laptop') broadcast({ type: 'laptop', laptop: lapCount() > 0 }, 'phone'); });
    return;
  }
  if (p === '/cmd' && req.method === 'POST') { const b = await body(req); broadcast({ type: 'cmd', cmd: b.cmd }, 'laptop'); res.writeHead(200); return res.end(lapCount() ? 'ok' : 'no laptop'); }
  if (p === '/state' && req.method === 'POST') { lastState = await body(req); broadcast({ type: 'state', state: lastState }, 'phone'); res.writeHead(200); return res.end('ok'); }
  res.writeHead(404); res.end('not found');
});

function addresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    for (const a of list) if (a.family === 'IPv4' && !a.internal) {
      let rank = 5;
      if (/^(wl|wlan)/.test(name)) rank = 0; else if (/^(en|eth)/.test(name)) rank = 1; else if (/^(ap|hotspot)/.test(name)) rank = 0; else if (/^(zt|docker|br|veth|tailscale)/.test(name)) rank = 9;
      out.push({ name, ip: a.address, rank });
    }
  return out.sort((a, b) => a.rank - b.rank);
}

// One line self check: fetch each phone URL from this machine. It cannot see a firewall or AP client isolation from the outside, so it also says what to do if the phone still fails.
function selfCheck(ad) {
  Promise.all(ad.map(a => new Promise(r => http.get(`http://${a.ip}:${PORT}/phone`, { timeout: 2000 }, x => { x.resume(); r(`${a.name} ${x.statusCode}`); }).on('error', e => r(`${a.name} FAIL ${e.code}`)).on('timeout', function () { this.destroy(); })))).then(rs => {
    console.log('\nSelf check: ' + rs.join(', ') + '.');
    console.log(`If the phone still cannot open it: the firewall must allow tcp ${PORT} (sudo ufw allow from 10.0.0.0/8 to any port ${PORT} proto tcp, same for 172.16.0.0/12 and 192.168.0.0/16), or the hotspot has client isolation on.`);
  });
}

server.on('error', e => { if (e.code === 'EADDRINUSE') { console.error(`Port ${PORT} is already taken, probably an older presenter server. Stop it (pkill -f "node server.js") or use PORT=9000 node server.js, and note a new port needs its own firewall rule.`); process.exit(1); } throw e; });

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    const ad = addresses();
    console.log(`\nLaptop (open on the projector, press F for fullscreen): http://localhost:${PORT}/  (add ?speed=1 for real time, default is 2x)`);
    if (ad.length) {
      console.log('\nPhone URLs, one per network interface (type the first one if the QR fails):');
      ad.forEach((a, i) => console.log(`  ${i === 0 ? '*' : ' '} ${a.name.padEnd(12)} http://${a.ip}:${PORT}/phone`));
      console.log('\nQR for the first one:');
      try { require('qrcode-terminal').generate(`http://${ad[0].ip}:${PORT}/phone`, { small: true }); } catch (e) { console.log('  (no QR, run npm install for it, or type the URL)'); }
      selfCheck(ad);
    } else console.log('No network address found, connect to the hotspot first.');
  });
}
