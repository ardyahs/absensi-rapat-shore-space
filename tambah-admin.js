'use strict';
// Menambah pengguna langsung ke data/db.json (tanpa lewat aplikasi).
// PENTING: hentikan server (Ctrl+C) sebelum menjalankan, lalu jalankan lagi setelahnya.
//
// Cara pakai:
//   node tambah-admin.js USERNAME "Nama Lengkap" KATASANDI [admin|karyawan]
// Contoh:
//   node tambah-admin.js admin2 "Admin Dua" rahasia123
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const [, , username, nama, password, role = 'admin'] = process.argv;
const stop = (m) => { console.error('✗ ' + m); process.exit(1); };

if (!username || !nama || !password) stop('Cara pakai: node tambah-admin.js USERNAME "Nama Lengkap" KATASANDI [admin|karyawan]');
if (password.length < 6) stop('Kata sandi minimal 6 karakter.');
if (!['admin', 'karyawan'].includes(role)) stop('Peran harus admin atau karyawan.');

const file = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'db.json');
if (!fs.existsSync(file)) stop('File data/db.json belum ada. Jalankan "npm start" sekali, hentikan dengan Ctrl+C, lalu ulangi.');

const d = JSON.parse(fs.readFileSync(file, 'utf8'));
if (d.users.some((u) => u.nik === username)) stop(`Username "${username}" sudah dipakai.`);

const salt = crypto.randomBytes(16).toString('hex');
const hash = salt + ':' + crypto.scryptSync(password, salt, 32).toString('hex');
const id = Math.max(d.seq.user, ...d.users.map((u) => u.id)) + 1;
d.seq.user = id;
d.users.push({ id, nama, nik: username, role, aktif: true, hash });

fs.writeFileSync(file + '.tmp', JSON.stringify(d, null, 2));
fs.renameSync(file + '.tmp', file);
console.log(`✓ Berhasil menambah ${role}: ${username} (${nama}). Jalankan server lagi dengan "npm start".`);
