# Absensi Karyawan (Web)

Absensi via **foto selfie + lokasi GPS** dengan **reward dan pinalti** otomatis.
Sisi karyawan (HP) dan sisi admin (desktop) dalam satu aplikasi. **Tanpa dependensi**: cukup Node.js 18+ (disarankan 20+), tidak perlu `npm install`.

## Menjalankan di VS Code

1. Install Node.js dari https://nodejs.org (versi LTS), lalu buka folder ini di VS Code (File > Open Folder).
2. Buka terminal VS Code (`Ctrl+\``) dan jalankan:
   ```
   npm start
   ```
3. Buka http://localhost:3000

Akun contoh (**segera ganti kata sandinya**):

| Peran | Username | Kata sandi |
|---|---|---|
| Admin | `admin` | `admin123` |
| Karyawan | `karyawan1` | `karyawan123` |

Karyawan membuka `/karyawan.html` (otomatis setelah login), admin membuka `/admin.html`.

## Aturan reward & pinalti (jam masuk 16:00)

| Waktu absen | Hasil |
|---|---|
| ≤ 15:45 | Reward Rp5.000 |
| 15:46 – 16:05 | Tepat waktu (Rp0) |
| 16:06 – 16:15 | Pinalti Rp5.000 |
| 16:16 – 16:30 | Pinalti Rp10.000 |
| ≥ 16:31 | Pinalti Rp15.000 |

Semua angka bisa diubah admin di menu **Pengaturan**. Waktu absen **selalu dari jam server (WITA)**, bukan jam HP. Detik diabaikan (16:05:59 masih dihitung 16:05).

## Mencoba di luar jam kerja

Jam server bisa disimulasikan supaya semua skenario bisa dicoba kapan saja:

```
SIMULASI_JAM=15:42 npm start     # Mac/Linux
$env:SIMULASI_JAM="15:42"; npm start    # Windows PowerShell
```
(Hanya jam yang dihitung server yang disimulasikan; jam besar di layar tetap jam asli.) **Jangan dipakai di production.**

## Menguji dari HP

Kamera dan GPS di browser hanya berfungsi di **HTTPS** atau `localhost`. Untuk uji dari HP, gunakan tunnel HTTPS (misalnya Cloudflare Tunnel atau ngrok) atau deploy ke server ber-HTTPS.

## Pengujian otomatis

```
npm test
```
Menguji semua batas waktu reward/pinalti (15:45, 15:46, 16:05, 16:06, 16:15, 16:16, 16:30, 16:31) dan penghitung jarak GPS.

## Struktur

```
server/index.js        API + server (router mini, tanpa framework)
server/rules.js        Logika waktu WITA, reward/pinalti, jarak GPS
server/store.js        Penyimpanan data (file JSON) + hash kata sandi
server/rules.test.js   Uji unit aturan
public/                Halaman: login, karyawan, admin (HTML/CSS/JS biasa)
data/                  Dibuat otomatis: db.json + foto absen (jangan di-commit)
```

## Yang sudah ada (sesuai sprint plan)

Login dua peran · absen foto kamera + GPS · validasi radius (di luar radius masuk antrean tinjau) · hitung reward/pinalti · satu kali absen per hari · riwayat 15/30 hari dengan saldo · dashboard admin dengan foto · rekap + ekspor CSV (dibuka di Excel) · kelola karyawan · pengaturan jam, radius, lokasi, dan aturan.

## Belum ada / langkah berikutnya

- **Ekspor PDF/Excel (.xlsx) asli**: saat ini CSV; PDF bisa lewat cetak browser.
- **Absen pulang, izin/cuti, lembur, hari libur.**
- **Database sungguhan** (SQLite/PostgreSQL): penyimpanan JSON cukup untuk puluhan karyawan, bukan ratusan.
- **Anti kecurangan lebih kuat**: web tidak bisa mendeteksi GPS palsu dengan andal; antrean tinjau admin dan catatan akurasi GPS adalah pengamannya. Pertimbangkan deteksi wajah atau aplikasi native.
- **Keamanan production**: wajib HTTPS, ganti kata sandi bawaan, simpan token di cookie `HttpOnly`, backup `data/` secara berkala.

## Hosting (produksi)

Syarat wajib: **HTTPS** (kamera dan GPS tidak jalan tanpa HTTPS), **penyimpanan permanen** untuk folder `data/` (db.json + foto), dan proses yang selalu menyala. Hindari layanan serverless atau paket gratis yang tidur/menghapus disk.

Variabel lingkungan:

| Variabel | Fungsi |
|---|---|
| `PORT` | Port aplikasi (default 3000) |
| `HOST` | Alamat bind, mis. `127.0.0.1` jika di belakang Caddy/Nginx |
| `DATA_DIR` | Lokasi folder data (arahkan ke disk/volume permanen) |
| `TRUST_PROXY=1` | Aktifkan jika di belakang proxy (agar batas login per pengguna) |
| `SIMULASI_JAM` | **Jangan diisi di produksi** |

Contoh VPS Ubuntu: pasang Node.js LTS, salin folder ke `/opt/absensi-web`, jalankan dengan systemd (`Restart=always`, `Environment=PORT=3000 HOST=127.0.0.1 TRUST_PROXY=1`), lalu pasang Caddy dengan:

```
absensi.domainanda.com {
    reverse_proxy 127.0.0.1:3000
}
```
Caddy mengurus sertifikat HTTPS otomatis (DNS A record domain harus mengarah ke IP VPS, port 80 dan 443 terbuka).

Checklist sebelum dipakai karyawan: ganti kata sandi admin dan karyawan contoh, atur lokasi kantor + radius di Pengaturan, backup `data/` berkala (mis. cron harian), dan uji absen dari HP nyata.
