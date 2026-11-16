# Ruang Risiko · Peta Risiko Banjir

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
- Klik titik untuk membuka popup berisi nama KPw atau kas titipan, bank pengelola, dan wilayah. Tombol Lihat detail membuka informasi lengkap di panel desktop atau panel bawah pada HP. Escape menutup detail/dialog. `/` membuka pencarian.
- Mode terang/gelap disimpan di localStorage. Daftar lokasi tertutup saat halaman dibuka dan dapat ditampilkan lewat tombol Daftar lokasi. Panel ini mengambang di atas peta agar tidak mengurangi ukuran peta.
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

## Tampilan dan batas peta

Header diringkas menjadi satu baris, navigasi desktop menampilkan nama menu, dan keterangan berulang dipindahkan dari area peta. Peta memenuhi sisa tinggi layar. Batas pergeseran, zoom keluar, serta permintaan tile dibatasi ke kawasan Indonesia (94,4–141,5 BT; 11,7 LS–6,3 LU). Tile yang bersinggungan dengan batas tetap dapat memperlihatkan sebagian negara tetangga; aplikasi tidak mengunduh peta seluruh dunia. `keepBuffer: 0`, `noWrap`, dan `updateWhenIdle` membatasi pengambilan tile. Geografi lokal hanya memuat fitur Indonesia.

Judul Peta Risiko Banjir menyatakan tujuan workspace; lapisan bahaya banjir belum terpasang, sebagaimana dijelaskan di Kualitas data.

## Logo dan tema

Tema terang menjadi bawaan, termasuk untuk pengguna yang sebelumnya menyimpan mode gelap. Preferensi baru disimpan melalui `nusa-theme-v3`.

Logo KPw memakai monogram Bank Indonesia (44 px); kas titipan memakai logo bank pengelola (31 px). Kelompok titik menampilkan logo perwakilan dan jumlah lokasi, bukan satu kantor tunggal. 67 dari 87 bank pengelola dapat dikenali dari nama dalam sumber; 20 data kosong/ambigu memakai ikon netral. Tidak ada bank yang ditebak dari wilayahnya.

Aset: [idn-finlogos 2.5.0](https://github.com/hafidznoor/idn-finlogos), koleksi komunitas (bukan sumber resmi institusi), CC BY-NC 4.0 untuk aset. Bentuk logo tidak digambar ulang; namespace SVG ditambahkan untuk pemuatan sebagai gambar eksternal. Lisensi dan pemberitahuan disertakan dalam `public/bank-logos`. Semua merek milik institusi masing-masing; pemakaian untuk identifikasi.
