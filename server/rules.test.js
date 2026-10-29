'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { klasifikasi, jamKeMenit, jarakMeter } = require('./rules');
const sel = (jam) => jamKeMenit(jam) - jamKeMenit('16:00');
const cek = (jam, kategori, nominal) => test(`absen ${jam} -> ${kategori} ${nominal}`, () => {
  assert.deepStrictEqual(klasifikasi(sel(jam)), { kategori, nominal });
});
cek('14:30', 'reward', 5000);
cek('15:45', 'reward', 5000);   // tepat 15 menit sebelum
cek('15:46', 'tepat', 0);
cek('16:00', 'tepat', 0);
cek('16:05', 'tepat', 0);
cek('16:06', 'terlambat', -5000);
cek('16:15', 'terlambat', -5000);
cek('16:16', 'terlambat', -10000);
cek('16:30', 'terlambat', -10000);
cek('16:31', 'terlambat', -15000);
cek('18:00', 'terlambat', -15000);
test('jarak GPS', () => {
  assert.strictEqual(Math.round(jarakMeter(-5.1, 119.4, -5.1, 119.4)), 0);
  const d = jarakMeter(-5.1, 119.4, -5.101, 119.4);
  assert.ok(d > 105 && d < 117, String(d)); // ~111 m per 0.001 derajat lintang
});
