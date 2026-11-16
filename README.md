# Asesmen Banjir · Nusa

Peta jaringan kas dengan tampilan Ruang Risiko, dibangun menggunakan Vite, Leaflet, dan Google Maps JavaScript API (opsional saat key belum tersedia).

## Jalankan

Node.js 22+; `npm ci`, lalu `npm run dev -- --port 3000`. Build: `npm run build`. Vercel: preset Vite, build `npm run build`, output `dist`.

## Google Maps

Aktifkan billing dan Maps JavaScript API pada Google Cloud project. Buat browser API key, batasi API ke Maps JavaScript API, serta HTTP referrer ke domain Vercel dan localhost yang dipakai. Salin `.env.example` ke `.env.local` untuk lokal; isi `VITE_GOOGLE_MAPS_API_KEY`. Pada Vercel, isi variabel tersebut di Project Settings → Environment Variables, lalu rebuild/redeploy. Key browser memang terlihat di browser: pembatasan API/domain wajib. Script menggunakan channel `v=weekly`. Tanpa key, peta Natural Earth lokal digunakan.

Untuk pencarian koordinat kantor, aktifkan Places API (New) dan gunakan key server terpisah melalui backend, dibatasi ke API tersebut. Jangan beri awalan VITE_ pada key server. Integrasi pengambilan Places dan verifikasi koordinat belum dikerjakan; tidak ada klaim bahwa data sudah diverifikasi Google Maps. Data Places perlu dipakai/disimpan mengikuti ketentuan Google Maps Platform.

## Status data

- 46 entri KPw merupakan daftar awal, belum divalidasi terhadap direktori resmi BI.
- Excel sumber memuat **87** baris kas titipan, bukan 88. Semua baris dipertahankan, termasuk bank/plafond yang kosong dan angka sumber yang mungkin perlu diperiksa (mis. Natuna dan Tana Paser).
- Semua koordinat saat ini estimasi pusat kota, **bukan koordinat kantor bank**. Jangan digunakan untuk analisis jarak/radius banjir atau keputusan operasional.
- `public/locations.json` mencatat jenis titik, sumber, dan status `approximate`. Perlu alamat cabang, pencocokan hasil Places, dan konfirmasi sebelum status dapat berubah.
- Bentuk daratan: Natural Earth melalui datasets/geo-countries, public domain. Basemap eksternal opsional: OpenStreetMap/CARTO. Google Maps memerlukan API key dan koneksi.

Fitur: filter jenis/wilayah, pencarian, detail jaringan, tautan pencarian Google Maps, ekspor JSON, zoom/reset, dan responsif.
