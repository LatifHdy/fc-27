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

## Cara Pakai & Update Data (di GitHub Pages)

Aplikasi ini dapat dibuka via GitHub Pages atau local server (`python3 -m http.server 8080`).

### 1. 🔥 Fitur Utama: Firebase Realtime Database (Live Score Instan)
Dengan Firebase, setiap kali skor disimpan atau musim baru dimulai:
- Data langsung tersimpan di cloud dalam hitungan milidetik.
- **Semua pengunjung yang sedang membuka web di HP/laptop akan langsung melihat skor & klasemen berubah secara otomatis (real-time tanpa reload)!**
- Dilengkapi dengan **PIN Admin (Default: `2727`)** agar pengunjung umum hanya bisa membaca (read-only) dan tidak bisa merusak data.

**Cara setup Firebase (3 Menit, Gratis dari Google):**
1. Buka [console.firebase.google.com](https://console.firebase.google.com/) dan buat project baru.
2. Pilih menu **Build > Realtime Database** > klik **Create Database** (pilih lokasi Singapura/US).
3. Pada tab **Rules**, ganti kodenya menjadi:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
   Lalu klik **Publish**.
4. Buka Project Settings (ikon roda gigi ⚙️) > di bagian *Your apps*, klik ikon Web (`</>`) untuk mendapatkan konfigurasi.
5. Buka file `firebase-config.js` di project ini, lalu salin nilai `apiKey`, `authDomain`, `databaseURL`, dll.
6. Buka web Anda, klik tombol **`🔥 Firebase`**, lalu klik tombol **`Upload Sekarang`** untuk mengirim seluruh 45 jadwal pertandingan & hasil saat ini ke cloud Firebase. Selesai!

---

### 2. Alternatif: GitHub Sync (Auto-Commit ke Repo)
Jika tidak ingin menggunakan Firebase, Anda bisa menggunakan GitHub REST API:
1. Klik tombol **`GitHub`** di pojok kanan atas.
2. Masukkan **GitHub Personal Access Token (PAT)** dengan izin `repo`.
3. Centang *“Otomatis commit ke GitHub setiap kali klik 'SIMPAN HASIL'”*.
4. Setiap kali skor disimpan, sistem akan meng-commit file `liga.json` langsung ke branch `main`.

---

### 3. Alternatif Manual: Download JSON
Jika tidak menggunakan Firebase maupun token GitHub:
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

