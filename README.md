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

Setelah input skor:
1. Klik `SIMPAN HASIL`.
2. Data langsung tersimpan di browser sebagai cadangan.
3. Klik `Simpan JSON` untuk mengunduh `liga.json` versi terbaru.
4. Tim lain/komputer lain bisa memakai `Import JSON` untuk melanjutkan data.

Catatan: browser biasa tidak boleh menulis balik langsung ke file `liga.json` di folder. Karena itu aplikasi menggunakan export/import JSON, tanpa database/backend.


## Fitur tambahan
- `Acak Pertandingan` mengacak urutan tampilan 36 pertandingan tanpa mengubah pasangan/home-away maupun hasil.
- `THRONE KING` muncul untuk pemimpin klasemen.
- `AREA ZONKOU` menandai 5 besar klasemen.
- `ZONA DEGRADASI` menandai posisi terakhir.
- Jika Teguh berada di posisi 1, muncul alert khusus: `SUDAH BIASA`.
