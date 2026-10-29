'use strict';
const KEY = 'absen_token';
const token = () => localStorage.getItem(KEY);
function logout() { localStorage.removeItem(KEY); location.href = '/'; }
async function api(path, o = {}) {
  const r = await fetch('/api' + path, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: o.body ? JSON.stringify(o.body) : undefined });
  if (r.status === 401) { logout(); throw new Error('Sesi berakhir'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Terjadi kesalahan');
  return j;
}
const rp = (n) => (n < 0 ? '−' : n > 0 ? '+' : '') + 'Rp' + Math.abs(n).toLocaleString('id-ID');
const rpPlain = (n) => 'Rp' + Math.abs(n).toLocaleString('id-ID');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function statusChip(a) {
  if (a.status === 'perlu_ditinjau') return '<span class="chip b">Menunggu tinjauan</span>';
  if (a.status === 'ditolak') return '<span class="chip r">Ditolak</span>';
  if (a.kategori === 'reward') return `<span class="chip g">Reward ${rp(a.nominal)}</span>`;
  if (a.kategori === 'terlambat') return `<span class="chip a">Pinalti ${rp(a.nominal)}</span>`;
  return '<span class="chip g">Tepat waktu</span>';
}
const tglPendek = (t) => new Date(t + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
function jarakMeter(a, b, c, d) { const R = 6371000, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t, h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
function rekapKartu(s) {
  return `<div class="tiles"><div class="tile"><b style="color:var(--gd)">${s.reward + s.tepat}</b><span>Tepat waktu</span></div><div class="tile"><b style="color:var(--a)">${s.terlambat}</b><span>Terlambat</span></div><div class="tile"><b>${s.hadir}</b><span>Total hadir</span></div></div>
  <div class="card"><div class="row between"><b>Rekap Ketepatan Waktu</b><b style="color:var(--gd);font-size:20px">${s.persen_tepat}%</b></div><div class="bar"><i style="width:${s.persen_tepat}%"></i></div>
  <div class="kv"><span>Reward (lebih awal)</span><b style="color:var(--gd)">${s.reward} hari · ${rp(s.total_reward)}</b></div>
  <div class="kv"><span>Tepat waktu</span><b>${s.tepat} hari</b></div>
  <div class="kv"><span>Terlambat</span><b style="color:var(--a)">${s.terlambat} hari · ${s.total_pinalti ? '−' : ''}${rpPlain(s.total_pinalti)}</b></div>
  <div class="kv" style="border-top:1px solid var(--line);padding-top:10px;margin-top:10px;font-size:15px"><b>Saldo bersih</b><b style="color:${s.saldo < 0 ? 'var(--a)' : 'var(--gd)'}">${s.saldo < 0 ? '−' : '+'}${rpPlain(s.saldo)}</b></div></div>`;
}
