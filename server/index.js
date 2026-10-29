'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = require('./rules');
const store = require('./store');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, '..', 'public');
const UP = path.join(store.DIR, 'uploads');
const D = () => store.get();
const fail = (status, msg) => { const e = new Error(msg); e.status = status; throw e; };

// Untuk uji coba di luar jam kerja: SIMULASI_JAM=15:42 npm start
const jamSekarang = () => (process.env.SIMULASI_JAM ? process.env.SIMULASI_JAM + ':00' : R.jamWita(new Date()));
const tglSekarang = () => R.tanggalWita(new Date());

// ---------- token & keamanan ----------
const sign = (p) => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', D().secret).update(b).digest('base64url'); };
function unsign(t) {
  if (!t || !t.includes('.')) return null;
  const [b, s] = t.split('.'); const ok = crypto.createHmac('sha256', D().secret).update(b).digest('base64url');
  if (s.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(ok))) return null;
  const p = JSON.parse(Buffer.from(b, 'base64url')); return p.exp > Date.now() ? p : null;
}
// Di belakang proxy (Caddy/Nginx/PaaS) set TRUST_PROXY=1 agar batas login dihitung per pengguna, bukan per proxy.
const clientIp = (req) => (process.env.TRUST_PROXY === '1' ? ((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress) : req.socket.remoteAddress);
const tries = new Map();
function limitLogin(ip) {
  const now = Date.now(), arr = (tries.get(ip) || []).filter((t) => now - t < 5 * 60e3);
  if (arr.length >= 10) fail(429, 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.');
  arr.push(now); tries.set(ip, arr);
}

// ---------- helper data ----------
const mulai = (days) => { const t = new Date(tglSekarang() + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - (days - 1)); return t.toISOString().slice(0, 10); };
const namaDari = (id) => (D().users.find((u) => u.id === id) || {}).nama || '-';
const outAtt = (a) => ({ id: a.id, user_id: a.user_id, tanggal: a.tanggal, jam: a.jam, kategori: a.kategori, nominal: a.nominal, status: a.status, jarak: a.jarak, akurasi: a.akurasi, selisih_menit: a.selisih_menit, foto: a.foto, catatan: a.catatan });
function ringkas(rows) {
  const v = rows.filter((a) => a.status === 'valid'), c = (k) => v.filter((a) => a.kategori === k).length;
  const rw = v.filter((a) => a.nominal > 0).reduce((s, a) => s + a.nominal, 0);
  const pn = -v.filter((a) => a.nominal < 0).reduce((s, a) => s + a.nominal, 0);
  return { hadir: v.length, reward: c('reward'), tepat: c('tepat'), terlambat: c('terlambat'), total_reward: rw, total_pinalti: pn, saldo: rw - pn,
    persen_tepat: v.length ? Math.round(((c('reward') + c('tepat')) * 100) / v.length) : 0, ditinjau: rows.filter((a) => a.status === 'perlu_ditinjau').length };
}
const rekap = (days, q) => D().users.filter((u) => u.role === 'karyawan' && u.aktif && (!q || u.nama.toLowerCase().includes(q.toLowerCase())))
  .map((u) => ({ id: u.id, nama: u.nama, nik: u.nik, ...ringkas(D().attendances.filter((a) => a.user_id === u.id && a.tanggal >= mulai(days))) }));

// ---------- router mini ----------
const routes = [];
const route = (method, pattern, access, fn) => {
  const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, access, fn });
};
const send = (res, status, data, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }); res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)); };
const readBody = (req) => new Promise((ok, no) => {
  let n = 0; const ch = [];
  req.on('data', (c) => { n += c.length; if (n > 4e6) { no(Object.assign(new Error('Data terlalu besar'), { status: 413 })); req.destroy(); } else ch.push(c); });
  req.on('end', () => { try { ok(ch.length ? JSON.parse(Buffer.concat(ch)) : {}); } catch { no(Object.assign(new Error('JSON tidak valid'), { status: 400 })); } });
});

// ---------- API: umum ----------
route('POST', '/api/login', 'public', ({ req, body }) => {
  limitLogin(clientIp(req));
  const u = D().users.find((x) => x.aktif && x.nik === String(body.nik || '').trim());
  if (!u || !store.verify(String(body.password || ''), u.hash)) fail(401, 'Username atau kata sandi salah');
  return { token: sign({ id: u.id, role: u.role, exp: Date.now() + 12 * 3600e3 }), role: u.role, nama: u.nama };
});
route('GET', '/api/me', 'auth', ({ user }) => {
  const hari = D().attendances.filter((a) => a.user_id === user.id && a.tanggal === tglSekarang());
  const t = hari[hari.length - 1];
  return { user: { id: user.id, nama: user.nama, nik: user.nik, role: user.role }, settings: D().settings, rules: D().rules, today: t ? outAtt(t) : null };
});
route('POST', '/api/password', 'auth', ({ user, body }) => {
  if (!store.verify(String(body.lama || ''), user.hash)) fail(400, 'Kata sandi lama salah');
  if (String(body.baru || '').length < 6) fail(400, 'Kata sandi baru minimal 6 karakter');
  user.hash = store.hash(body.baru); store.save(); return { ok: true };
});

// ---------- API: karyawan ----------
route('POST', '/api/checkin', 'auth', ({ user, body }) => {
  const d = D(), s = d.settings, tgl = tglSekarang();
  if (d.attendances.some((a) => a.user_id === user.id && a.tanggal === tgl && a.status !== 'ditolak')) fail(409, 'Anda sudah absen hari ini');
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) fail(400, 'Lokasi GPS tidak valid');
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.foto || '');
  if (!m) fail(400, 'Foto selfie wajib diambil dari kamera');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 500 || buf.length > 3e6) fail(400, 'Ukuran foto tidak valid');
  const jarak = Math.round(R.jarakMeter(lat, lng, s.lat, s.lng)), luar = jarak > s.radius;
  if (luar && !s.izinkan_luar_radius) fail(400, `Anda di luar radius kantor (${jarak} m dari ${s.radius} m)`);
  const jam = jamSekarang(), selisih = R.jamKeMenit(jam) - R.jamKeMenit(s.jam_masuk), k = R.klasifikasi(selisih, d.rules);
  const id = ++d.seq.att, file = `${user.id}-${tgl}-${id}-${crypto.randomBytes(4).toString('hex')}.jpg`;
  fs.writeFileSync(path.join(UP, file), buf);
  const a = { id, user_id: user.id, tanggal: tgl, jam: jam.slice(0, 5), selisih_menit: selisih, kategori: k.kategori, nominal: k.nominal,
    lat, lng, akurasi: Math.round(Number(body.akurasi) || 0), jarak, foto: file, status: luar ? 'perlu_ditinjau' : 'valid' };
  d.attendances.push(a); store.save();
  return outAtt(a);
});
route('GET', '/api/history', 'auth', ({ user, query }) => {
  const days = query.get('days') === '30' ? 30 : 15, from = mulai(days);
  const rows = D().attendances.filter((a) => a.user_id === user.id && a.tanggal >= from).sort((a, b) => b.id - a.id);
  return { days, from, summary: ringkas(rows), rows: rows.map(outAtt) };
});
route('GET', '/photo/:file', 'auth', ({ user, params, res }) => {
  const f = path.basename(params.file);
  if (user.role !== 'admin' && !f.startsWith(user.id + '-')) fail(403, 'Dilarang');
  const p = path.join(UP, f); if (!fs.existsSync(p)) fail(404, 'Foto tidak ditemukan');
  send(res, 200, fs.readFileSync(p), 'image/jpeg'); return { raw: true };
});

// ---------- API: admin ----------
route('GET', '/api/admin/dashboard', 'admin', () => {
  const d = D(), tgl = tglSekarang(), akt = d.users.filter((u) => u.role === 'karyawan' && u.aktif);
  const hari = d.attendances.filter((a) => a.tanggal === tgl && a.status !== 'ditolak').sort((a, b) => b.id - a.id);
  const r = ringkas(hari), conv = (a) => ({ ...outAtt(a), nama: namaDari(a.user_id) });
  return { tanggal: tgl, total: akt.length, ...r, belum: akt.length - new Set(hari.map((a) => a.user_id)).size,
    rows: hari.map(conv), antrean: d.attendances.filter((a) => a.status === 'perlu_ditinjau').sort((a, b) => b.id - a.id).map(conv) };
});
route('POST', '/api/admin/reviews/:id', 'admin', ({ user, params, body }) => {
  const a = D().attendances.find((x) => x.id === Number(params.id));
  if (!a || a.status !== 'perlu_ditinjau') fail(404, 'Absen tidak ada dalam antrean tinjau');
  if (!['setuju', 'tolak'].includes(body.keputusan)) fail(400, 'Keputusan tidak valid');
  a.status = body.keputusan === 'setuju' ? 'valid' : 'ditolak'; a.catatan = String(body.catatan || '').slice(0, 200); a.ditinjau_oleh = user.id;
  store.save(); return { ok: true };
});
route('GET', '/api/admin/recap', 'admin', ({ query }) => { const days = query.get('days') === '30' ? 30 : 15; return { days, from: mulai(days), rows: rekap(days, query.get('q')) }; });
route('GET', '/api/admin/recap.csv', 'admin', ({ query, res }) => {
  const days = query.get('days') === '30' ? 30 : 15, q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ['Nama', 'Username', 'Hadir', 'Reward', 'Tepat waktu', 'Terlambat', 'Total reward', 'Total pinalti', 'Saldo', '% Tepat'];
  const lines = rekap(days, '').map((r) => [r.nama, r.nik, r.hadir, r.reward, r.tepat, r.terlambat, r.total_reward, r.total_pinalti, r.saldo, r.persen_tepat].map(q).join(','));
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="rekap-${days}-hari.csv"` });
  res.end('\ufeff' + [head.map(q).join(','), ...lines].join('\r\n')); return { raw: true };
});
route('GET', '/api/admin/settings', 'admin', () => ({ settings: D().settings, rules: D().rules }));
route('PUT', '/api/admin/settings', 'admin', ({ body }) => {
  const s = body.settings || {}, rl = body.rules || [];
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.jam_masuk)) fail(400, 'Format jam masuk harus HH:MM');
  if (!(Number(s.radius) > 0) || !Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lng))) fail(400, 'Radius dan koordinat harus angka');
  if (!rl.length || rl.some((r) => ![r.dari, r.sampai, r.nominal].every((n) => Number.isFinite(Number(n))))) fail(400, 'Aturan reward/pinalti tidak valid');
  const rules = rl.map((r) => ({ dari: Number(r.dari), sampai: Number(r.sampai), nominal: Number(r.nominal) })).sort((a, b) => a.dari - b.dari);
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].dari > rules[i].sampai) fail(400, 'Pada aturan, "dari" tidak boleh lebih besar dari "sampai"');
    if (i && rules[i].dari !== rules[i - 1].sampai + 1) fail(400, 'Rentang menit aturan harus berurutan tanpa celah atau tumpang tindih');
  }
  D().rules = rules.map((r) => ({ ...r, kategori: r.nominal > 0 ? 'reward' : r.nominal < 0 ? 'terlambat' : 'tepat' }));
  D().settings = { jam_masuk: s.jam_masuk, radius: Number(s.radius), lokasi_nama: String(s.lokasi_nama || 'Kantor').slice(0, 60), lat: Number(s.lat), lng: Number(s.lng), izinkan_luar_radius: !!s.izinkan_luar_radius };
  store.save(); return { ok: true };
});
route('GET', '/api/admin/users', 'admin', () => D().users.filter((u) => u.role === 'karyawan').map((u) => ({ id: u.id, nama: u.nama, nik: u.nik, aktif: u.aktif })));
route('POST', '/api/admin/users', 'admin', ({ body }) => {
  const nama = String(body.nama || '').trim(), nik = String(body.nik || '').trim();
  if (!nama || !nik || String(body.password || '').length < 6) fail(400, 'Nama, Username, dan kata sandi (min. 6 karakter) wajib diisi');
  if (D().users.some((u) => u.nik === nik)) fail(409, 'Username sudah terdaftar');
  D().users.push({ id: ++D().seq.user, nama, nik, role: 'karyawan', aktif: true, hash: store.hash(body.password) }); store.save(); return { ok: true };
});
route('POST', '/api/admin/users/:id/toggle', 'admin', ({ params }) => {
  const u = D().users.find((x) => x.id === Number(params.id) && x.role === 'karyawan'); if (!u) fail(404, 'Karyawan tidak ditemukan');
  u.aktif = !u.aktif; store.save(); return { aktif: u.aktif };
});

// ---------- server ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'), pn = url.pathname;
    let hit = null, params = {};
    for (const r of routes) { const m = r.method === req.method && r.re.exec(pn); if (m) { hit = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; } }
    if (hit) {
      let user = null;
      if (hit.access !== 'public') {
        const t = (req.headers.authorization || '').replace(/^Bearer /, '') || url.searchParams.get('t');
        const p = unsign(t); user = p && D().users.find((u) => u.id === p.id && u.aktif);
        if (!user) fail(401, 'Sesi berakhir, silakan login kembali');
        if (hit.access === 'admin' && user.role !== 'admin') fail(403, 'Khusus admin');
      }
      const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const out = await hit.fn({ req, res, user, body, params, query: url.searchParams });
      if (!(out && out.raw)) send(res, 200, out === undefined ? { ok: true } : out);
      return;
    }
    if (pn.startsWith('/api/')) fail(404, 'Endpoint tidak ditemukan');
    const file = path.normalize(path.join(PUB, pn === '/' ? 'index.html' : pn));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Tidak ditemukan', 'text/plain; charset=utf-8');
    send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    if (e.status) send(res, e.status, { error: e.message });
    else { console.error(e); send(res, 500, { error: 'Terjadi kesalahan pada server' }); }
  }
});
if (require.main === module) server.listen(...[PORT, process.env.HOST].filter(Boolean), () => {
  console.log(`Absensi berjalan di http://localhost:${PORT}`);
  console.log('Login contoh -> admin / admin123  |  karyawan1 / karyawan123  (segera ganti kata sandi!)');
});
module.exports = server;
