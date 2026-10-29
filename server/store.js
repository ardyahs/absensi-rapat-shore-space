'use strict';
// Penyimpanan JSON sederhana (cukup untuk MVP / puluhan karyawan).
// Untuk skala lebih besar, ganti dengan SQLite/PostgreSQL tanpa mengubah rute di index.js.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DEFAULT_RULES } = require('./rules');
const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'db.json');
fs.mkdirSync(path.join(DIR, 'uploads'), { recursive: true });

const hash = (pw) => { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(pw, s, 32).toString('hex'); };
const verify = (pw, h) => { const [s, k] = h.split(':'); return crypto.timingSafeEqual(crypto.scryptSync(pw, s, 32), Buffer.from(k, 'hex')); };

let d;
function save() { const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(d, null, 2)); fs.renameSync(t, FILE); }
if (fs.existsSync(FILE)) d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
else {
  d = {
    secret: crypto.randomBytes(32).toString('hex'),
    seq: { user: 2, att: 0 },
    users: [
      { id: 1, nama: 'Admin', nik: 'admin', role: 'admin', aktif: true, hash: hash('admin123') },
      { id: 2, nama: 'Karyawan Contoh', nik: 'karyawan1', role: 'karyawan', aktif: true, hash: hash('karyawan123') },
    ],
    settings: { jam_masuk: '16:00', radius: 100, lokasi_nama: 'Kantor Pusat', lat: -5.1477, lng: 119.4327, izinkan_luar_radius: true },
    rules: DEFAULT_RULES,
    attendances: [],
  };
  save();
}
module.exports = { DIR, get: () => d, save, hash, verify };
