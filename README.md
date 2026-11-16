# Ruang Risiko · Asesmen Banjir

Workspace peta jaringan kas Indonesia. Vite, Leaflet, font lokal DM Sans/Manrope, peta jalan OpenStreetMap, dan peta sederhana Natural Earth. Tidak memerlukan API key berbayar.

## Pengembangan

Node.js 22+. Gunakan checkout yang ada; setiap cloud task sudah terisolasi, tidak perlu membuat worktree.

```sh
npm ci
npm run dev -- --port 3000
```

Build produksi: `npm run build`. Uji build dengan `npm run preview -- --port 3001`.

Vercel: preset **Vite**, build `npm run build`, direktori output `dist`. Tidak ada environment variable wajib atau Google Maps SDK. Tautan Google Maps hanya membuka pencarian eksternal saat dipilih pengguna.

## Interaksi

- Tampilan nasional otomatis menyesuaikan area peta, termasuk saat ukuran layar atau panel berubah.
- Kelompok marker diberi jumlah dan cincin komposisi KPw (cyan) / kas titipan (amber). Klik untuk memperbesar kelompok. Marker tunggal KPw berbentuk persegi, kas berbentuk lingkaran.
- Filter jenis, filter wilayah, pencarian kota/KPw/bank, reset filter, dan ekspor JSON mengikuti data yang sedang difilter.
- Detail lokasi tampil di daftar desktop atau panel bawah pada HP. Escape menutup detail/dialog. `/` membuka pencarian.
- Mode terang/gelap disimpan di localStorage. Panel direktori dapat disembunyikan.
- OpenStreetMap menjadi peta utama dengan zoom hingga level 19 untuk melihat jalan, bangunan, dan nama tempat yang tercatat. Tombol Lihat area sekitar memperbesar area kota hingga level 17. Peta sederhana Natural Earth tersedia lewat menu Jenis peta. Gangguan koneksi ditampilkan dengan opsi mencoba kembali; peta sederhana tetap ada di bawah lapisan jalan.
- Kualitas data membuka keterangan sumber, kelengkapan, dan batas penggunaan.

## Status data

- 46 entri KPw merupakan daftar awal, belum divalidasi terhadap direktori resmi BI.
- Excel sumber memuat **87** baris kas titipan, bukan 88. Seluruh baris dipertahankan, termasuk bank/plafond yang kosong dan angka sumber yang perlu diperiksa (mis. Natuna dan Tana Paser).
- Semua koordinat estimasi pusat kota, **bukan koordinat kantor bank**. Jangan digunakan untuk analisis jarak/radius banjir atau keputusan operasional.
- `public/locations.json` mencatat jenis, sumber, dan status `approximate`. Perlu alamat cabang dan konfirmasi sumber resmi sebelum status dapat berubah.
- Bentuk daratan: Natural Earth melalui datasets/geo-countries, public domain. Peta jalan: OpenStreetMap; pengguna wajib mengikuti tile usage policy untuk penggunaan lanjutan.

## Koneksi peta

Browser memerlukan akses HTTPS ke `tile.openstreetmap.org`. Tidak ada API key atau billing. Peta jalan tersedia sesuai kelengkapan OpenStreetMap; tidak setiap bangunan atau landmark memiliki nama. Peta ini tidak mengubah koordinat perkiraan menjadi lokasi kantor terverifikasi. Saat pengujian cloud, permintaan tile ditolak jaringan; alur zoom, pergantian peta, pemuatan tile, dan penanganan error diuji di browser dengan respons layanan terkontrol. Tampilan tile asli perlu diperiksa pada jaringan yang mengizinkan domain tersebut.
