'use strict';
let DAYS = 15, Q = '';
const view = document.getElementById('view');
const TABS = { dashboard, rekap, karyawan, pengaturan };
document.getElementById('out').onclick = logout;
document.querySelectorAll('.top nav button').forEach((b) => (b.onclick = () => show(b.dataset.tab)));
function show(t) { document.querySelectorAll('.top nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); TABS[t]().catch((e) => { view.innerHTML = `<p class="err">${esc(e.message)}</p>`; }); }
api('/me').then((m) => { if (m.user.role !== 'admin') location.href = '/karyawan.html'; else show('dashboard'); });
const tile = (l, n, c = '', sub = '') => `<div class="tile"><span>${l}</span><b style="color:${c || 'inherit'}">${n}</b><span>${sub}</span></div>`;
const foto = (a) => `<a href="/photo/${esc(a.foto)}?t=${token()}" target="_blank" rel="noopener"><img class="thumb" alt="Foto absen ${esc(a.nama)}" src="/photo/${esc(a.foto)}?t=${token()}"></a>`;

async function dashboard() {
  const d = await api('/admin/dashboard');
  view.innerHTML = `<h1>Dashboard Absensi</h1><p class="muted">${tglPendek(d.tanggal)} · ${d.total} karyawan aktif</p>
  <div class="grid">${tile('Hadir hari ini', d.hadir, '', `${d.belum} belum absen`)}${tile('Reward', d.reward, 'var(--gd)', rp(d.total_reward))}${tile('Tepat waktu', d.tepat)}${tile('Terlambat', d.terlambat, 'var(--a)', 'pinalti ' + rpPlain(d.total_pinalti))}${tile('Perlu ditinjau', d.antrean.length, 'var(--b)')}</div>
  ${d.antrean.length ? `<div class="card"><h2>Antrean tinjau (di luar radius)</h2><div class="scroll"><table><tr><th>Foto</th><th>Karyawan</th><th>Tanggal</th><th>Jam</th><th>Jarak</th><th>Aksi</th></tr>${d.antrean.map((a) => `<tr><td>${foto(a)}</td><td><b>${esc(a.nama)}</b></td><td>${tglPendek(a.tanggal)}</td><td>${a.jam}</td><td>${a.jarak} m</td><td class="row"><button class="btn sm" data-r="${a.id}" data-k="setuju">Setujui</button><button class="btn sm red" data-r="${a.id}" data-k="tolak">Tolak</button></td></tr>`).join('')}</table></div></div>` : ''}
  <div class="card"><h2>Absen hari ini (foto &amp; lokasi)</h2><div class="scroll"><table><tr><th>Foto</th><th>Karyawan</th><th>Jam masuk</th><th>Jarak kantor</th><th>Status</th></tr>
  ${d.rows.map((a) => `<tr><td>${foto(a)}</td><td><b>${esc(a.nama)}</b></td><td>${a.jam}</td><td>${a.jarak} m · GPS ±${a.akurasi} m</td><td>${statusChip(a)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Belum ada absen hari ini.</td></tr>'}</table></div></div>`;
  view.querySelectorAll('[data-r]').forEach((b) => (b.onclick = async () => { await api('/admin/reviews/' + b.dataset.r, { method: 'POST', body: { keputusan: b.dataset.k } }); dashboard(); }));
}
async function rekap() {
  const r = await api(`/admin/recap?days=${DAYS}&q=${encodeURIComponent(Q)}`), tot = r.rows.reduce((s, x) => ({ rw: s.rw + x.total_reward, pn: s.pn + x.total_pinalti, tl: s.tl + x.terlambat }), { rw: 0, pn: 0, tl: 0 });
  view.innerHTML = `<div class="row between wrapf"><h1>Rekap Absensi</h1><button id="csv" class="btn ghost">Ekspor CSV (Excel)</button></div>
  <div class="row wrapf" style="margin-bottom:12px"><div class="seg" style="width:220px;margin:0"><button data-d="15" class="${DAYS === 15 ? 'on' : ''}">15 Hari</button><button data-d="30" class="${DAYS === 30 ? 'on' : ''}">30 Hari</button></div><span class="muted sm">${tglPendek(r.from)} – hari ini</span>
  <input id="q" placeholder="Cari karyawan" value="${esc(Q)}" aria-label="Cari karyawan" style="margin-left:auto;width:240px"></div>
  <div class="grid">${tile('Total reward', rpPlain(tot.rw), 'var(--gd)')}${tile('Total pinalti', rpPlain(tot.pn), 'var(--a)', tot.tl + ' absen terlambat')}</div>
  <div class="card scroll"><table><tr><th>Karyawan</th><th>Hadir</th><th>Reward</th><th>Tepat</th><th>Terlambat</th><th>Total reward</th><th>Total pinalti</th><th>Saldo</th><th>% Tepat</th></tr>
  ${r.rows.map((x) => `<tr><td><b>${esc(x.nama)}</b></td><td>${x.hadir}</td><td style="color:var(--gd)">${x.reward}</td><td>${x.tepat}</td><td style="color:var(--a)">${x.terlambat}</td><td>${rpPlain(x.total_reward)}</td><td>${rpPlain(x.total_pinalti)}</td><td><b style="color:${x.saldo < 0 ? 'var(--a)' : 'var(--gd)'}">${x.saldo < 0 ? '−' : '+'}${rpPlain(x.saldo)}</b></td><td>${x.persen_tepat}%</td></tr>`).join('') || '<tr><td colspan="9" class="muted">Tidak ada data.</td></tr>'}</table></div>`;
  view.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => { DAYS = Number(b.dataset.d); rekap(); }));
  document.getElementById('q').onkeydown = (e) => { if (e.key === 'Enter') { Q = e.target.value; rekap(); } };
  document.getElementById('csv').onclick = async () => {
    const res = await fetch('/api/admin/recap.csv?days=' + DAYS, { headers: { Authorization: 'Bearer ' + token() } }), a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob()); a.download = `rekap-${DAYS}-hari.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
}
async function karyawan() {
  const us = await api('/admin/users');
  view.innerHTML = `<h1>Karyawan</h1><div class="card"><h2>Tambah karyawan</h2><form id="uf" class="row wrapf"><div style="flex:1;min-width:160px"><label for="n">Nama</label><input id="n" required></div><div style="flex:1;min-width:140px"><label for="k">Username</label><input id="k" required></div><div style="flex:1;min-width:160px"><label for="p">Kata sandi awal</label><input id="p" type="password" minlength="6" required></div><button class="btn" style="align-self:flex-end">Tambah</button></form><p id="um" class="err" role="alert"></p></div>
  <div class="card scroll"><table><tr><th>Nama</th><th>Username</th><th>Status</th><th></th></tr>${us.map((u) => `<tr><td><b>${esc(u.nama)}</b></td><td>${esc(u.nik)}</td><td>${u.aktif ? '<span class="chip g">Aktif</span>' : '<span class="chip r">Nonaktif</span>'}</td><td><button class="btn ghost sm" data-t="${u.id}">${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button></td></tr>`).join('')}</table></div>`;
  document.getElementById('uf').onsubmit = async (e) => { e.preventDefault(); try { await api('/admin/users', { method: 'POST', body: { nama: n.value, nik: k.value, password: p.value } }); karyawan(); } catch (x) { document.getElementById('um').textContent = x.message; } };
  view.querySelectorAll('[data-t]').forEach((b) => (b.onclick = async () => { await api(`/admin/users/${b.dataset.t}/toggle`, { method: 'POST' }); karyawan(); }));
}
async function pengaturan() {
  const { settings: s, rules } = await api('/admin/settings');
  const toMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const hm = (m) => String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');
  let base = toMin(s.jam_masuk);
  const urut = [...rules].sort((a, b) => a.dari - b.dari), rw = urut.find((r) => r.nominal > 0), tp = urut.find((r) => r.nominal === 0), pn = urut.filter((r) => r.nominal < 0);
  // Model sederhana memakai jam biasa; dikonversi ke "menit terhadap jam masuk" saat disimpan.
  const M = { reward: { t: rw ? base + rw.sampai : base - 15, n: rw ? rw.nominal : 0 }, tepat: { t: tp ? base + tp.sampai : base + 5 }, pinalti: pn.map((r) => ({ t: base + r.sampai, n: -r.nominal })) };
  if (!M.pinalti.length) M.pinalti.push({ t: null, n: 15000 });
  M.pinalti[M.pinalti.length - 1].t = null;
  const prevT = (i) => (i === 0 ? M.tepat.t : M.pinalti[i - 1].t);
  const tIn = (f, v, i = '') => `<input type="time" data-f="${f}" data-i="${i}" value="${hm(v)}" aria-label="Batas jam">`;
  const nIn = (f, v, i = '') => `<span class="rp">Rp<input type="number" min="0" step="1000" data-f="${f}" data-i="${i}" value="${v}" aria-label="Nominal rupiah"></span>`;
  const barisHtml = () => `<div class="rule"><span class="chip g">Reward</span><span>Absen sampai jam</span>${tIn('rw-t', M.reward.t)}<span>→ karyawan dapat</span>${nIn('rw-n', M.reward.n)}</div>
    <div class="rule"><span class="chip g">Tepat waktu</span><span>Absen sampai jam</span>${tIn('tp-t', M.tepat.t)}<span class="muted">→ tanpa reward dan tanpa pinalti</span></div>
    ${M.pinalti.map((p, i) => { const last = i === M.pinalti.length - 1; return `<div class="rule"><span class="chip a">Pinalti ${i + 1}</span>${last ? `<span>Absen lebih dari jam <b id="lastref">${hm(prevT(i))}</b></span>` : `<span>Absen sampai jam</span>${tIn('pn-t', p.t, i)}`}<span>→ denda</span>${nIn('pn-n', p.n, i)}${M.pinalti.length > 1 ? `<button type="button" class="btn ghost sm" data-del="${i}">Hapus</button>` : ''}</div>`; }).join('')}`;
  const ringkasan = () => { const L = [[`Absen sampai ${hm(M.reward.t)}`, M.reward.n ? 'Reward ' + rpPlain(M.reward.n) : 'Tepat waktu'], [`${hm(M.reward.t + 1)} – ${hm(M.tepat.t)}`, 'Tepat waktu (Rp0)']]; let prev = M.tepat.t;
    M.pinalti.forEach((p, i) => { const last = i === M.pinalti.length - 1; L.push([last ? `${hm(prev + 1)} dan seterusnya` : `${hm(prev + 1)} – ${hm(p.t)}`, 'Pinalti ' + rpPlain(p.n)]); prev = p.t; });
    return L.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join(''); };
  const cek = () => { const ts = [M.reward.t, M.tepat.t, ...M.pinalti.slice(0, -1).map((p) => p.t)]; for (let i = 1; i < ts.length; i++) if (ts[i] <= ts[i - 1]) return `Jam harus berurutan dari yang paling awal ke yang paling akhir (periksa ${hm(ts[i])}).`; return ''; };
  const bangun = () => { const off = (t) => t - base, out = [{ dari: -1440, sampai: off(M.reward.t), nominal: M.reward.n }]; let prev = off(M.reward.t);
    out.push({ dari: prev + 1, sampai: off(M.tepat.t), nominal: 0 }); prev = off(M.tepat.t);
    M.pinalti.forEach((p, i) => { const sampai = i === M.pinalti.length - 1 ? 1440 : off(p.t); out.push({ dari: prev + 1, sampai, nominal: -p.n }); prev = sampai; }); return out; };
  view.innerHTML = `<div class="row between wrapf"><h1>Pengaturan</h1><button id="save" class="btn">Simpan Perubahan</button></div><p id="sm" class="err" role="status"></p>
  <div class="card"><h2>Jam masuk</h2><label for="jm">Jam masuk karyawan</label><input id="jm" type="time" value="${esc(s.jam_masuk)}" style="width:160px;font-size:20px;font-weight:700"><p class="sm muted">Jika jam masuk diubah, semua jam di aturan di bawah ikut bergeser otomatis.</p></div>
  <div class="card"><h2>Aturan reward &amp; pinalti</h2><p class="sm muted">Atur batas jam dan nominalnya. Jam harus berurutan dari yang paling awal.</p><div id="aturan"></div>
  <button type="button" id="tambah" class="btn ghost sm" style="margin-top:10px">+ Tambah tingkat pinalti</button><p id="aerr" class="err" role="alert"></p>
  <div class="sum"><b>Ringkasan aturan</b><div id="ring" style="display:block;margin-top:6px"></div></div></div>
  <div class="card"><h2>Lokasi kantor</h2><div class="row wrapf"><div><label for="ln">Nama lokasi</label><input id="ln" value="${esc(s.lokasi_nama)}"></div><div><label for="rd">Radius (meter)</label><input id="rd" type="number" value="${s.radius}"></div><div><label for="lt">Latitude</label><input id="lt" type="number" step="any" value="${s.lat}"></div><div><label for="lg">Longitude</label><input id="lg" type="number" step="any" value="${s.lng}"></div></div>
  <label><input id="lr" type="checkbox" ${s.izinkan_luar_radius ? 'checked' : ''}> Izinkan absen di luar radius (masuk antrean tinjau admin)</label></div>`;
  const segar = () => { document.getElementById('ring').innerHTML = ringkasan().replace(/<div>/g, '<div class="ln">'); const lr = document.getElementById('lastref'); if (lr) lr.textContent = hm(prevT(M.pinalti.length - 1)); document.getElementById('aerr').textContent = cek(); };
  const gambar = () => {
    document.getElementById('aturan').innerHTML = barisHtml(); segar();
    document.querySelectorAll('#aturan [data-f]').forEach((el) => (el.oninput = () => {
      const f = el.dataset.f, i = Number(el.dataset.i); if (el.value === '') return;
      if (f === 'rw-t') M.reward.t = toMin(el.value); else if (f === 'tp-t') M.tepat.t = toMin(el.value); else if (f === 'pn-t') M.pinalti[i].t = toMin(el.value);
      else if (f === 'rw-n') M.reward.n = Math.max(0, Number(el.value) || 0); else if (f === 'pn-n') M.pinalti[i].n = Math.max(0, Number(el.value) || 0);
      segar();
    }));
    document.querySelectorAll('#aturan [data-del]').forEach((b) => (b.onclick = () => { M.pinalti.splice(Number(b.dataset.del), 1); M.pinalti[M.pinalti.length - 1].t = null; gambar(); }));
  };
  document.getElementById('tambah').onclick = () => { const n = M.pinalti.length; M.pinalti.splice(n - 1, 0, { t: prevT(n - 1) + 15, n: 5000 }); gambar(); };
  document.getElementById('jm').onchange = (e) => { if (!e.target.value) return; const d = toMin(e.target.value) - base; base += d; M.reward.t += d; M.tepat.t += d; M.pinalti.forEach((p) => { if (p.t != null) p.t += d; }); gambar(); };
  gambar();
  document.getElementById('save').onclick = async () => {
    const m = document.getElementById('sm'); m.style.color = 'var(--r)'; m.textContent = ''; const e = cek(); if (e) { m.textContent = e; return; }
    const g = (id) => document.getElementById(id);
    try { await api('/admin/settings', { method: 'PUT', body: { settings: { jam_masuk: g('jm').value, lokasi_nama: g('ln').value, radius: g('rd').value, lat: g('lt').value, lng: g('lg').value, izinkan_luar_radius: g('lr').checked }, rules: bangun() } }); m.style.color = 'var(--gd)'; m.textContent = 'Pengaturan tersimpan. Berlaku untuk absen berikutnya.'; window.scrollTo(0, 0); }
    catch (x) { m.textContent = x.message; }
  };
}
