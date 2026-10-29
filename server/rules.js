'use strict';
// Logika inti: waktu WITA, klasifikasi reward/pinalti, dan jarak GPS.
const TZ = 'Asia/Makassar';
const F = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const parts = (d = new Date()) => Object.fromEntries(F.formatToParts(d).map((p) => [p.type, p.value]));
const tanggalWita = (d) => { const p = parts(d); return `${p.year}-${p.month}-${p.day}`; };
const jamWita = (d) => { const p = parts(d); return `${p.hour}:${p.minute}:${p.second}`; };
const jamKeMenit = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// selisih = menit absen - menit jam masuk (negatif = lebih awal). Detik dibuang.
// Jam masuk 16:00: <=15:45 reward | 15:46-16:05 tepat | 16:06-16:15 | 16:16-16:30 | >=16:31
const DEFAULT_RULES = [
  { dari: -1440, sampai: -15, kategori: 'reward', nominal: 5000 },
  { dari: -14, sampai: 5, kategori: 'tepat', nominal: 0 },
  { dari: 6, sampai: 15, kategori: 'terlambat', nominal: -5000 },
  { dari: 16, sampai: 30, kategori: 'terlambat', nominal: -10000 },
  { dari: 31, sampai: 1440, kategori: 'terlambat', nominal: -15000 },
];

function klasifikasi(selisih, rules = DEFAULT_RULES) {
  const r = rules.find((x) => selisih >= x.dari && selisih <= x.sampai);
  return r ? { kategori: r.kategori, nominal: r.nominal } : { kategori: 'tepat', nominal: 0 };
}

function jarakMeter(lat1, lon1, lat2, lon2) { // Haversine
  const R = 6371000, t = Math.PI / 180;
  const dLat = (lat2 - lat1) * t, dLon = (lon2 - lon1) * t;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = { TZ, tanggalWita, jamWita, jamKeMenit, DEFAULT_RULES, klasifikasi, jarakMeter };
