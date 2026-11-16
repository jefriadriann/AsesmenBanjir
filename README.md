# Ruang Risiko · Asesmen Banjir

Workspace peta jaringan kas Indonesia. Vite, Leaflet, font lokal DM Sans/Manrope, dan atlas Natural Earth lokal. Tidak memerlukan API key berbayar.

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
- Detail lokasi tampil di direktori desktop atau panel bawah pada HP. Escape menutup detail/dialog. `/` membuka pencarian.
- Mode terang/gelap disimpan di localStorage. Panel direktori dapat disembunyikan.
- Atlas lokal tersedia tanpa permintaan tile. OpenStreetMap opsional di menu peta dasar; kegagalan jaringan ditampilkan dan atlas tetap tersedia di bawahnya.
- Kualitas data membuka keterangan sumber, kelengkapan, dan batas penggunaan.

## Status data

- 46 entri KPw merupakan daftar awal, belum divalidasi terhadap direktori resmi BI.
- Excel sumber memuat **87** baris kas titipan, bukan 88. Seluruh baris dipertahankan, termasuk bank/plafond yang kosong dan angka sumber yang perlu diperiksa (mis. Natuna dan Tana Paser).
- Semua koordinat estimasi pusat kota, **bukan koordinat kantor bank**. Jangan digunakan untuk analisis jarak/radius banjir atau keputusan operasional.
- `public/locations.json` mencatat jenis, sumber, dan status `approximate`. Perlu alamat cabang dan konfirmasi sumber resmi sebelum status dapat berubah.
- Bentuk daratan: Natural Earth melalui datasets/geo-countries, public domain. Layanan jalan opsional: OpenStreetMap; pengguna wajib mengikuti tile usage policy untuk penggunaan lanjutan.
