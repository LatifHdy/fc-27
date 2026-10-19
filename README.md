# FC 27 Liga

## File
- `index.html` — halaman aplikasi
- `style.css` — UI
- `app.js` — logika liga
- `liga.json` — data pertandingan + hasil

## Format
9 pemain, single round robin = 36 pertandingan.

## Cara pakai
Buka `index.html` lewat local server agar `liga.json` bisa dibaca browser.
Contoh:
`python -m http.server 8080`
lalu buka `http://localhost:8080`.

## Cara pakai & Update Data (di GitHub Pages)

Aplikasi ini dapat dibuka via GitHub Pages atau local server (`python3 -m http.server 8080`).

### 1. Fitur Auto-Update ke GitHub (Tanpa Edit Manual & Tanpa Terminal!)
Karena aplikasi dihosting di GitHub Pages, Anda bisa mengaktifkan update otomatis langsung ke repository:
1. Klik tombol **`GitHub Sync`** di pojok kanan atas hero.
2. Masukkan **GitHub Personal Access Token (PAT)** Anda (cukup dibuat sekali dengan hak akses `repo`).
   - Token ini **hanya tersimpan di browser Anda sendiri (`localStorage`)**, aman dan tidak bisa dilihat pengunjung publik.
3. Centang *“Otomatis commit ke GitHub setiap kali klik 'SIMPAN HASIL'”*.
4. Setiap kali Anda input skor dan klik **`SIMPAN HASIL`**, JavaScript langsung meng-commit perubahan ke repository GitHub secara otomatis! Dalam ~1 menit, GitHub Pages publik langsung ter-update dengan data terbaru.

### 2. Cara Alternatif (Download JSON)
Jika tidak menggunakan token GitHub:
1. Input skor di web, lalu klik **`SIMPAN HASIL`**.
2. Klik tombol **`↓ Simpan JSON`** untuk mengunduh `liga.json` yang sudah rapi.
3. Anda tidak perlu mengedit file JSON manual sama sekali! Cukup timpa file `liga.json` di repo GitHub (bisa via upload web github.com atau git push).

---

## Fitur Next Season (Musim Baru)
Ketika seluruh pertandingan telah dimainkan (`played: true` semua):
1. **Banner Selebrasi Juara** otomatis muncul di atas dengan mahkota 🏆 dan ucapan selamat kepada sang Kampiun!
2. Muncul tombol **`⚡ Mulai Next Season`**.
3. Di dalam jendela Next Season:
   - Terdapat ringkasan Juara 1, Runner-up, dan Peringkat 3.
   - Tersedia tombol **`📥 Download Backup Season Ini (JSON)`** agar arsip musim lama tetap tersimpan aman.
   - Masukkan nama musim baru (misal: *Season 2*).
   - Anda bisa menambah pemain baru atau menghapus pemain jika ada perubahan peserta.
   - Klik **`🚀 Buat Jadwal & Mulai Season Baru`**.
4. Sistem akan otomatis:
   - Membuat jadwal pertandingan round-robin yang adil (semua saling bertemu).
   - Mengatur skor 0-0 dengan status belum dimainkan.
   - Mengunduh file `liga.json` baru dan meng-commit ke GitHub (jika GitHub Sync aktif).
   - Tampilan web langsung siap untuk musim baru!

---

## Fitur Tambahan
- `Acak Pertandingan` mengacak urutan tampilan pertandingan yang belum main tanpa mengubah pasangan/home-away maupun hasil (pertandingan Swas otomatis ditaruh di akhir).
- `THRONE KING` muncul untuk pemimpin klasemen.
- `AREA ZONKOU` menandai 5 besar klasemen.
- `ZONA DEGRADASI` menandai posisi terakhir.
- Jika Teguh berada di posisi 1, muncul alert khusus: `SUDAH BIASA`.
- Klik nama pemain di klasemen atau podium untuk melihat kartu profil, riwayat skor, dan sisa lawan yang belum dihadapi.

