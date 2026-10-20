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
- **🔔 Info & Alerts** (Histori juara liga, Yonkou Top 4-5, konsistensi pemain, tren performa, lini serang & pertahanan)
- **🌐 Semua** (Menampilkan semua panel secara berurutan)

### 2. 🏆 Manajemen Multi-Season & Riwayat Musim (History Seasons)
- **Season Switcher**: Dropdown pemilih musim di header untuk melihat musim aktif atau riwayat musim sebelumnya (arsip klasemen akhir, podium juara, dan seluruh riwayat skor pertandingan).
- **Siklus Musim (Lifecycle)**:
  - **🟡 DRAFT**: Status musim baru saat dibuat. Admin dapat menambah pemain baru ke liga sebelum kompetisi dimulai (`+ Tambah Pemain`). Jadwal round-robin otomatis dihitung ulang.
  - **🚀 START SEASON**: Tombol untuk memulai musim (memerlukan PIN `1203`). Mengubah status menjadi **🟢 AKTIF / BERJALAN** dan membuka akses input skor di Match Center.
  - **🏁 SELESAIKAN MUSIM**: Mengarsipkan musim saat ini ke `historySeasons` dan membuka form pembuatan musim baru.
- **⚡ Buat Season Baru & Pop-up Partisipasi Pemain**:
  - Tombol **"⚡ Buat Season Baru"** di header membuka modal interaktif.
  - **Daftar Checkbox Pemain**: Memilih siapa saja pemain yang ikut serta di musim baru dengan tombol cepat "Pilih Semua" dan "Kosongkan".
  - **Tambah Pemain Baru**: Mendaftarkan pemain baru ke liga secara instan.
  - **Kalkulator Pertandingan Realtime**: Menampilkan total pemain terpilih dan estimasi jumlah laga secara langsung.
  - Dilindungi verifikasi PIN Admin (**`1203`**).

### 3. 📊 Info, Statistik, Alert Liga & Tracker Performa per Pemain per Season
Modul analitik mendalam pada tab **Info & Alerts**:
1. **👑 Histori Juara Liga (Hall of Fame)**: Merekap daftar juara di tiap musim yang telah diarsipkan beserta torehan poinnya.
2. **⚔️ Yonkou Elite Top 4 - 5**: Menyoroti 4 hingga 5 pemain penguasa papan atas klasemen yang bersaing memperebutkan mahkota juara.
3. **🌟 Konsistensi Pemain Tertinggi**: Menyorot pemain dengan win-rate tertinggi dan torehan selisih gol terbaik.
4. **🎢 Tren Performa Ringkas**: Memantau momentum pemain yang sedang dalam tren kemenangan beruntun (hot) atau membutuhkan evaluasi (cold).
5. **🛡️ Lini Serang & Pertahanan**: Rekap pencetak gol terbanyak (mesin gol) dan pertahanan paling kokoh (kebobolan paling sedikit).

#### 📈 Analisis Performa Tiap Pemain per Season (Player Performance Tracker):
- **Filter Multi-Season**: Pengguna dapat memilih musim yang ingin dianalisis langsung dari tab Info & Alerts (Musim Berjalan, Arsip Musim Terdahulu, atau Akumulasi Semua Musim).
- **Validasi Kelayakan Sampel Pertandingan**:
  - `mp = 0`: Status `⏳ Belum Bertanding` (belum ada sampel data).
  - `mp = 1`: Status `🌱 Sampel Awal (Adaptasi)` (data laga pembuka).
  - `mp >= 2`: Status `✅ Data Tervalidasi` (memenuhi syarat analisis statistik performa).
- **Kondisi & Status Performa Tiap Pemain**:
  - 🔥 **ON FIRE**: Win rate $\ge 75\%$ dan selisih gol $\ge +5$, atau win streak 3 laga beruntun.
  - 📈 **TREN NAIK**: Momentum positif, tak terkalahkan dalam 3 laga terakhir atau win rate $\ge 60\%$.
  - ⚖️ **KONSISTEN**: Rekor stabil, performa berimbang dengan efektivitas poin tinggi.
  - 🎢 **FLUKTUATIF**: Hasil menang dan kalah bergantian, butuh kestabilan tempo.
  - 📉 **TREN MENURUN**: Menderita $\ge 2$ kekalahan di laga terakhir atau kebobolan $\ge 4.0$ gol/laga.
  - 🧊 **BUTUH EVALUASI (KRISIS)**: Belum meraih kemenangan ($w = 0$ dengan $mp \ge 2$) atau kalah 3 kali beruntun.
- **Metrik Analisis Lengkap Tiap Pemain**:
  - *Ribbon Form 5 Laga Terakhir* (`W` hijau, `D` kuning, `L` merah)
  - *Win Rate %*, *Total Poin*, *Gol/Laga (GPM)*, *Kebobolan/Laga (KPM)*
  - *Tag Khusus*: Rekor Tak Terkalahkan (`🌟 Unbeaten`), Pertandingan Clean Sheet (`🧤 Clean Sheet`), Catatan WO (`⚠️ Rekor WO`).
  - *Rating Lini Serang & Pertahanan* (misal: `⚡ Serangan Mematikan` & `🛡️ Tembok Kokoh`).
  - *Akses Cepat Profil*: Klik kartu pemain untuk langsung membuka modal profil lengkap.


### 4. 🔐 Keamanan Input Skor & PIN Admin (PIN: `1203`)
- **Simpan Hasil Pertandingan**: Setiap kali skor pertandingan disimpan di Match Center, sistem akan menampilkan dialog verifikasi PIN Admin (**`1203`**) untuk mencegah kesalahan atau input oleh pihak tidak berwenang.
- **Koreksi / Edit Skor**: Kesalahan input skor pada pertandingan yang sudah selesai dapat langsung diperbaiki melalui tab **Riwayat Hasil** atau modal profil pemain dengan verifikasi PIN **`1203`**.
- **Aksi Siklus Musim**: Mulai musim, selesaikan musim, dan buat musim baru diproteksi oleh PIN **`1203`**.

### 5. ✏️ Fitur Edit Skor Riwayat
- Di tab **Riwayat Hasil**, klik tombol **`✏️ Edit Skor`** pada kartu pertandingan yang ingin diubah.
- Di modal profil pemain (**Klik nama pemain di Klasemen**), daftar riwayat tuntas kini dilengkapi tombol **`✏️ Edit`**.
- Mengubah skor akan langsung menghitung ulang tabel klasemen, selisih gol, poin, dan menyinkronkan data secara instan ke cloud Firebase.

### 6. 🎨 Desain Bersih & Elegan (Bebas "AI Slop")
- Menggunakan tipografi primer Google Fonts **Montserrat** (`wght@400..900`).
- Ikon SVG multi-color yang kontras dan tajam pada logo hero, tab navigator, status badge, dan modal.
- Palet warna kurasi olahraga profesional (Deep Navy `#0b1329`, Royal Blue `#1d4ed8`, Warm Amber `#f59e0b`, Emerald `#10b981`).

### 7. 🔥 Firebase Realtime Database
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

