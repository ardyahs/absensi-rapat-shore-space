# Panduan Proyek: Absensi Karyawan

Aplikasi web absensi foto + GPS dengan reward/pinalti. Node.js murni (tanpa dependensi), frontend HTML/JS biasa. Bahasa antarmuka: Indonesia.

## Aturan bisnis (jangan diubah tanpa persetujuan)
- Jam masuk 16:00 WITA. Aturan disimpan di `store.js` (`DEFAULT_RULES` di `rules.js`) dan bisa diubah admin.
- `<=15:45` reward +5.000 | `15:46-16:05` tepat waktu 0 | `16:06-16:15` -5.000 | `16:16-16:30` -10.000 | `>=16:31` -15.000.
- Waktu absen SELALU dari jam server, tidak pernah dari klien. Detik diabaikan.
- Foto hanya dari kamera langsung (bukan unggah galeri). Satu absen valid per hari per karyawan.
- Absen di luar radius -> status `perlu_ditinjau`, tidak dihitung sampai admin menyetujui.

## Konvensi
- Setiap perubahan pada `server/rules.js` WAJIB disertai pembaruan `server/rules.test.js`; jalankan `npm test`.
- Jangan menambah dependensi tanpa alasan kuat; jelaskan dulu alasannya.
- Semua teks pengguna di-escape (`esc()`) sebelum masuk ke innerHTML.
- Jangan menampilkan kata sandi/hash/token di respons API atau log.
- Kerjakan per fitur kecil, jalankan tes, dan jelaskan apa yang diubah.
