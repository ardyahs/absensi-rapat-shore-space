'use strict';
let ME, DAYS = 15, timer;
const view = document.getElementById('view');
const TABS = { beranda, riwayat, profil };
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => show(b.dataset.tab)));
function show(t) { clearInterval(timer); document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); TABS[t](); }
(async () => { ME = await api('/me'); show('beranda'); })().catch((e) => { view.innerHTML = `<p class="err">${esc(e.message)}</p>`; });

const jamKeMenit = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
const menitKeJam = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const sekarang = () => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).replace('.', ':');
const tanggalPanjang = () => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'full' }).format(new Date());
const posisi = () => new Promise((ok, no) => {
  if (!navigator.geolocation) return no(new Error('Browser tidak mendukung GPS'));
  navigator.geolocation.getCurrentPosition(ok, () => no(new Error('Izin lokasi diperlukan. Aktifkan GPS dan izinkan lokasi di browser.')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
});

function hasil(a) {
  const ket = a.status === 'perlu_ditinjau' ? 'Anda di luar radius kantor, absen menunggu tinjauan admin.' : a.status === 'valid' ? (a.kategori === 'reward' ? `Absen ${Math.abs(a.selisih_menit)} menit lebih awal.` : a.kategori === 'terlambat' ? `Terlambat ${a.selisih_menit} menit.` : 'Absen sesuai waktu.') : '';
  return `<div class="card center"><div style="font-size:40px;color:var(--g)">✓</div><h2>Absen Masuk Tercatat</h2><p class="lg" style="margin:4px 0"><b>${a.jam} WITA</b></p>
  <p>${statusChip(a)}</p><p class="sm muted">${ket}<br>Jarak dari kantor ${a.jarak} m</p></div>`;
}
function beranda() {
  const s = ME.settings, a = ME.today, rw = ME.rules.find((r) => r.kategori === 'reward');
  const batas = rw ? menitKeJam(jamKeMenit(s.jam_masuk) + rw.sampai) : null, perlu = !a || a.status === 'ditolak';
  view.innerHTML = `<p class="muted" style="margin:0">${tanggalPanjang()}</p><h1>Halo, ${esc(ME.user.nama)}</h1>
  <div class="card row between"><div><div class="muted sm">Jam masuk</div><b class="lg">${esc(s.jam_masuk)}</b></div><span class="chip g">${esc(s.lokasi_nama)}</span></div>
  <div class="clock"><div id="clk">${sekarang()}</div><div class="muted">WITA</div></div>
  ${perlu ? `<p id="loc" class="center sm muted">Memeriksa lokasi…</p>${batas ? `<div class="banner"><b>Absen sampai ${batas}</b> untuk dapat reward ${rpPlain(rw.nominal)}</div>` : ''}
  <button id="go" class="btn big">Absen Masuk</button>${a && a.status === 'ditolak' ? '<p class="center sm warn">Absen sebelumnya ditolak admin. Silakan absen ulang.</p>' : ''}` : hasil(a)}`;
  timer = setInterval(() => { const c = document.getElementById('clk'); if (c) c.textContent = sekarang(); }, 15000);
  if (perlu) { cekLokasi(); document.getElementById('go').onclick = absen; }
}
async function cekLokasi() {
  const el = document.getElementById('loc');
  try {
    const p = await posisi(), j = Math.round(jarakMeter(p.coords.latitude, p.coords.longitude, ME.settings.lat, ME.settings.lng)), ok = j <= ME.settings.radius;
    if (el) el.innerHTML = ok ? `<span style="color:var(--gd)">● Anda berada dalam radius kantor (${j} m)</span>` : `<span class="warn">● Di luar radius kantor (${j} m dari ${ME.settings.radius} m)</span>`;
  } catch (e) { if (el) el.textContent = e.message; }
}
async function absen() {
  const dlg = document.getElementById('dlg'), vid = document.getElementById('vid'), msg = document.getElementById('dmsg'), snap = document.getElementById('snap');
  msg.textContent = ''; snap.disabled = false; let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false }); }
  catch { alert('Izin kamera diperlukan. Aktifkan izin kamera di browser lalu coba lagi.'); return; }
  vid.srcObject = stream; dlg.showModal();
  const stop = () => stream.getTracks().forEach((t) => t.stop());
  dlg.onclose = stop; document.getElementById('cancel').onclick = () => dlg.close();
  snap.onclick = async () => {
    snap.disabled = true; msg.textContent = 'Mengambil lokasi…';
    try {
      const pos = await posisi(), w = vid.videoWidth || 640, h = vid.videoHeight || 480, c = document.createElement('canvas');
      c.width = Math.min(w, 640); c.height = Math.round((c.width * h) / w); c.getContext('2d').drawImage(vid, 0, 0, c.width, c.height);
      msg.textContent = 'Mengirim…';
      await api('/checkin', { method: 'POST', body: { foto: c.toDataURL('image/jpeg', 0.7), lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy } });
      dlg.close(); ME = await api('/me'); show('beranda');
    } catch (e) { msg.textContent = e.message; snap.disabled = false; }
  };
}
async function riwayat() {
  view.innerHTML = '<h1>Riwayat Absensi</h1><p class="muted">Memuat…</p>';
  const h = await api('/history?days=' + DAYS);
  view.innerHTML = `<h1>Riwayat Absensi</h1><div class="seg"><button data-d="15" class="${DAYS === 15 ? 'on' : ''}">15 Hari</button><button data-d="30" class="${DAYS === 30 ? 'on' : ''}">30 Hari</button></div>
  <p class="muted sm">${tglPendek(h.from)} – hari ini</p>${rekapKartu(h.summary)}
  ${h.rows.map((a) => `<div class="item"><div><b>${tglPendek(a.tanggal)}</b><div class="sm muted">Masuk ${a.jam}</div></div>${statusChip(a)}</div>`).join('') || '<p class="muted center">Belum ada data absen.</p>'}`;
  view.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => { DAYS = Number(b.dataset.d); riwayat(); }));
}
function profil() {
  view.innerHTML = `<h1>Profil</h1><div class="card"><b class="lg">${esc(ME.user.nama)}</b><div class="muted sm">Username ${esc(ME.user.nik)} · ${esc(ME.settings.lokasi_nama)}</div></div>
  <form id="pf" class="card"><h2>Ubah kata sandi</h2><label for="lama">Kata sandi lama</label><input id="lama" type="password" required autocomplete="current-password"><label for="baru">Kata sandi baru (min. 6 karakter)</label><input id="baru" type="password" required minlength="6" autocomplete="new-password"><p id="pm" class="err" role="status"></p><button class="btn">Simpan</button></form>
  <button id="out" class="btn ghost" style="width:100%;color:var(--r)">Keluar</button>`;
  document.getElementById('out').onclick = logout;
  document.getElementById('pf').onsubmit = async (e) => { e.preventDefault(); const pm = document.getElementById('pm'); try { await api('/password', { method: 'POST', body: { lama: lama.value, baru: baru.value } }); pm.style.color = 'var(--gd)'; pm.textContent = 'Kata sandi diperbarui.'; e.target.reset(); } catch (x) { pm.style.color = 'var(--r)'; pm.textContent = x.message; } };
}
