# FC 27 Liga

Aplikasi manajemen klasemen & jadwal liga sepakbola / mini soccer dengan pembaruan real-time via Firebase Realtime Database dan UI modern bergaya **Pajak.go.id Navigator Tabs**.

## File Utama
- [index.html](file:///Users/pajak/Latif/koding/fc27-liga-v2/index.html) — Halaman dashboard liga & modal interaktif
- [style.css](file:///Users/pajak/Latif/koding/fc27-liga-v2/style.css) — Styling kustom berbasis font **Montserrat** & sistem tab navigator
- [app.js](file:///Users/pajak/Latif/koding/fc27-liga-v2/app.js) — Logika klasemen, navigasi panel, proteksi PIN 1203, & sinkronisasi
- [firebase-config.js](file:///Users/pajak/Latif/koding/fc27-liga-v2/firebase-config.js) — Konfigurasi Firebase Realtime Database
- [liga.json](file:///Users/pajak/Latif/koding/fc27-liga-v2/liga.json) — Basis data awal liga & jadwal pertandingan

---

## Fitur Unggulan

### 1. 📑 Sections Navigator Tabs (Inspirasi: Pajak.go.id Storybook)
Navigasi tab horizontal bergaya modern dengan ikon multi-color dan badge indikator:
- **📊 Klasemen** (Menampilkan tabel poin, selisih gol, dan podium Top 3)
- **⚔️ Jadwal Tanding** (Match center dengan filter jadwal pemain, acak jadwal, dan input skor)
- **📜 Riwayat Hasil** (Arsip semua pertandingan yang telah selesai dengan tombol koreksi skor)
- **🔔 Info & Alerts** (Notifikasi pimpinan klasemen, zona top 5, dan degradasi)
- **🌐 Semua** (Menampilkan semua panel secara berurutan)

### 2. 🔐 Keamanan Input Skor & PIN Admin (PIN: `1203`)
- **Simpan Hasil Pertandingan**: Setiap kali skor pertandingan disimpan di Match Center, sistem akan menampilkan dialog verifikasi PIN Admin (**`1203`**) untuk mencegah kesalahan atau input oleh pihak tidak berwenang.
- **Koreksi / Edit Skor**: Kesalahan input skor pada pertandingan yang sudah selesai dapat langsung diperbaiki melalui tab **Riwayat Hasil** atau modal profil pemain dengan verifikasi PIN **`1203`**.

### 3. ✏️ Fitur Edit Skor Riwayat
- Di tab **Riwayat Hasil**, klik tombol **`✏️ Edit Skor`** pada kartu pertandingan yang ingin diubah.
- Di modal profil pemain (**Klik nama pemain di Klasemen**), daftar riwayat tuntas kini dilengkapi tombol **`✏️ Edit`**.
- Mengubah skor akan langsung menghitung ulang tabel klasemen, selisih gol, poin, dan menyinkronkan data secara instan ke cloud Firebase.

### 4. 🎨 Desain Bersih & Elegan (Bebas "AI Slop")
- Menggunakan tipografi primer Google Fonts **Montserrat** (`wght@400..900`).
- Ikon SVG multi-color yang kontras dan tajam pada logo hero, tab navigator, status badge, dan modal.
- Palet warna kurasi olahraga profesional (Deep Navy `#0b1329`, Royal Blue `#1d4ed8`, Warm Amber `#f59e0b`, Emerald `#10b981`).

### 5. 🔥 Firebase Realtime Database
- Data tersimpan dan tersinkronisasi otomatis secara real-time ke cloud Firebase.
- Perubahan skor langsung terlihat oleh semua perangkat yang sedang membuka tautan tanpa perlu refresh.
- **Secret Admin Upload**: Tombol upload publik telah dihapus dari antarmuka web. Upload database awal ke cloud Firebase hanya dapat dilakukan secara rahasia melalui URL khusus admin:
  - Buka web dengan parameter: `?upload=1203` (contoh: `http://localhost:8080/?upload=1203` atau di GitHub Pages `https://<domain>/?upload=1203`).
  - Parameter URL akan langsung dihapus otomatis dari address bar setelah verifikasi demi menjaga kerahasiaan.
  - Alternatif via console DevTools: `uploadFirebase('1203')`.

---

## Menjalankan Aplikasi Secara Lokal
Jalankan web server lokal di direktori ini:
```bash
python3 -m http.server 8080
```
Buka browser dan akses: `http://localhost:8080`
