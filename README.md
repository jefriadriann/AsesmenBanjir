# Ruang Risiko · Peta Risiko Banjir

**Data koordinat terkini:** impor file pengguna `Koordinat_KPw_dan_Kas_Titipan_133_Lokasi (1).xlsx`. 52 titik tersedia (44 siap ditinjau, 8 perlu konfirmasi); 81 lokasi belum memiliki koordinat. Peta memakai cadangan pusat wilayah untuk 81 lokasi tersebut dan melabelinya dengan ≈. Tidak ada status yang dipromosikan menjadi verified.

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
- Tampilan menggunakan mode gelap saja; preferensi tema lama di localStorage diabaikan. Daftar lokasi tertutup saat halaman dibuka dan dapat ditampilkan lewat tombol Daftar lokasi. Panel ini mengambang di atas peta agar tidak mengurangi ukuran peta.
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

Mode gelap navy menjadi satu-satunya tema. Tombol pergantian tema dihapus, dan HTML memulai mode gelap sebelum JavaScript dimuat. Preferensi tema lama tidak lagi dibaca.

Logo KPw memakai monogram Bank Indonesia (44 px); kas titipan memakai logo bank pengelola (31 px). Kelompok titik menampilkan logo perwakilan dan jumlah lokasi, bukan satu kantor tunggal. 67 dari 87 bank pengelola dapat dikenali dari nama dalam sumber; 20 data kosong/ambigu memakai ikon netral. Tidak ada bank yang ditebak dari wilayahnya.

Aset: [idn-finlogos 2.5.0](https://github.com/hafidznoor/idn-finlogos), koleksi komunitas (bukan sumber resmi institusi), CC BY-NC 4.0 untuk aset. Bentuk logo tidak digambar ulang; namespace SVG ditambahkan untuk pemuatan sebagai gambar eksternal. Lisensi dan pemberitahuan disertakan dalam `public/bank-logos`. Semua merek milik institusi masing-masing; pemakaian untuk identifikasi.

## Pengukuran jarak dan tampilan interaktif

- Buka **Ukur jarak** melalui tombol di dalam peta. Klik/ketuk peta untuk menggambar garis beberapa ruas; klik marker dapat menambahkan koordinatnya. Gunakan Urungkan, Selesai, dan Garis baru. Escape menutup alat dan menyembunyikan garis. Alat memakai jarak geodesik WGS84 sepanjang ruas yang digambar, bukan rute jalan. Navigasi Kualitas data dihapus; informasi sumber tetap dapat dibuka melalui tombol informasi. Bagian Analisis sementara berisi X (Segera hadir).
- `src/distance.js` memakai GeographicLib Geodesic pada elipsoid WGS84 (algoritma Karney). Jarak adalah geodesik permukaan bumi, bukan rute jalan atau durasi perjalanan. Garis dibuat dari 65 titik geodesik.
- Jika kedua endpoint punya `status: verified` dan `verifiedOfficeCoords: [lat,lng]`, jarak tampil dengan 2 desimal km. Jika salah satu masih perkiraan, hasil diberi tanda ≈, dibulatkan ke km, dan dijelaskan sebagai perkiraan antarpusat kota. Ketelitian algoritma tidak memperbaiki ketepatan koordinat sumber.
- Logo KPw menyesuaikan zoom: 27/34/42 px; kas titipan 19/25/30 px. Kelompok 32/40/46 px. Tidak ada perpindahan koordinat untuk merapikan marker.
- Tema studio memakai gradasi ringan, permukaan transparan, font Manrope dan DM Sans lokal, serta pointer glow hanya untuk pointer halus dan tanpa preferensi reduced motion. Tidak ada library animasi tambahan. Tidak ada permintaan API berbayar.
- Uji matematika: `npm test` (5 pengujian, termasuk referensi WGS84, pasangan hampir antipodal, simetri, titik sama, dan status akurasi).

## Kesiapan sarpras banjir — versi checklist lokal lama

Bagian ini mendokumentasikan versi sebelum impor Excel. Tampilan aktif kini memakai data file dan acuan banjir yang dijelaskan pada bagian terakhir.

Menu **Kesiapan sarpras** (`#sarpras`) mencakup 46 KPw dari daftar aplikasi. Checklist ditranskripsi dari infografik yang diberikan pengguna: perlindungan gedung (5), evakuasi (9), kesehatan/kebutuhan dasar (5), komunikasi/operasional (5), dan langkah preventif (4). Sumber ini tidak diklaim sebagai dokumen petunjuk teknis resmi yang sudah diverifikasi.

Seluruh isian awal kosong. Pengguna dapat mencatat status, jumlah/satuan, catatan tiap butir, PIC, dan catatan kantor. Ringkasan membedakan belum diisi, belum lengkap, ada kekurangan, tercatat siap, dan semua tidak relevan. Tidak ada persentase kesiapan yang dibuat dari data kosong. Progres menunjukkan **kelengkapan pengisian**, bukan skor risiko atau audit kesiapan. Tercatat siap berarti semua butir relevan ditandai siap oleh pengisi, bukan sertifikasi kapasitas/kelayakan.

Data otomatis disimpan hanya dalam localStorage browser (`ruang-risiko-readiness-v1`), **belum tersinkron antarpengguna/perangkat**. Informasi ini ditampilkan di UI. Tombol Unduh rekap menghasilkan JSON untuk 46 KPw lengkap beserta isian dan ringkasan; tidak ada API/backend atau pengiriman data eksternal. Kegagalan penyimpanan browser ditampilkan, dengan anjuran mengunduh rekap.

Popup KPw di peta menampilkan ringkasan kondisi dan empat kategori sarpras dari isian browser, serta tautan langsung ke checklist KPw. Kas titipan tidak diberi kesiapan KPw yang dibuat-buat. Di HP, menu sarpras tersedia melalui ikon perisai pada header.

## Impor koordinat terbaru

`python scripts/import_coordinates.py <file.xlsx>` membutuhkan openpyxl. Skrip memvalidasi seluruh 133 ID, rentang angka, dan duplikasi, lalu mempertahankan nilai koordinat tanpa pembulatan. Nama, bank, alamat, status, catatan, dan URL sumber mengikuti file. Sheet lokasi tambahan yang hanya berisi baris usulan kosong tidak diimpor. SHA-256 dan jumlah status dicatat di `public/coordinate-import.json`.

- `ready_for_review`: 44 titik berstatus Siap ditinjau di Excel; bukan verifikasi independen.
- `needs_confirmation`: 8 titik kandidat berstatus Perlu diperiksa, diberi tanda ! dan label Perlu konfirmasi.
- `not_found`: 81 lokasi tanpa koordinat, tetap ada di daftar/filter dan detail tetapi memakai penanda pusat wilayah berlabel ≈. Titik cadangan ini tidak dipakai sebagai koordinat gedung dalam pengukuran.
- `coords` memuat koordinat kiriman atau null. `legacyCityCoords` menyimpan perkiraan lama hanya untuk arsip. `verifiedOfficeCoords` tetap null.
- Penggaris hanya tersedia di navigasi (sidebar desktop, navigasi atas HP), bukan popup atau toolbar header peta. Popup tetap menyediakan detail dan sarpras.

## Pemulihan peta dan overlay InaRISK

- Tampilan nasional menghitung ulang batas zoom dari ukuran peta yang terlihat, mereset minZoom sebelum perhitungan, dan mengabaikan ukuran nol saat halaman peta disembunyikan. Ini mencegah batas zoom hanya naik ketika layar/menu berubah.
- Jika seluruh tile jalan gagal atau pemuatan timeout, atlas Indonesia lokal otomatis tampil. Penggantian layer dijadwalkan setelah event Leaflet selesai agar tidak mengakses `_map` yang sudah dilepas. Tombol Seluruh Indonesia selalu mengembalikan pusat dan zoom nasional.
- Tombol **Layer banjir** memuat katalog ArcGIS, metadata, legenda, dan gambar dari host resmi BNPB melalui `/api/inarisk`. Proxy Vercel hanya menerima layanan bernama banjir/flood pada host tetap, bukan proxy URL bebas. Vite dev/preview memakai handler yang sama. Tidak ada pencocokan atau pemberian kelas risiko ke koordinat kantor.
- Katalog dicari pada `https://inarisk.bnpb.go.id/arcgis/rest/services` dan folder yang dikembalikannya. Tidak ada service ID atau legenda yang ditebak sebagai data resmi. Nama layer membedakan bahaya dan risiko; legenda, periode jika tersedia, dan atribusi mengikuti metadata sumber. Raster transparan memakai ArcGIS export/exportImage dalam EPSG:3857, opacity bisa diubah, dan marker tetap berada di atas raster.
- **Konektivitas live belum terverifikasi.** Permintaan situs/katalog InaRISK dari cloud ditolak 403, dan fetch proxy mengembalikan `fetch failed`. Domain InaRISK/BNPB disimpan pada draft jaringan untuk ditinjau, disimpan, dan dipublish melalui pengaturan environment. Penyimpanan draft tidak menerapkan koneksi runtime. Jika katalog aktual berpindah/ditutup, adapter perlu disesuaikan setelah sumber resmi bisa diperiksa. UI menyatakan InaRISK belum terhubung; tidak menghasilkan warna atau kelas risiko pengganti.
- Uji browser memakai respons terkontrol untuk memeriksa raster pane, legenda, opacity, toggle, dan kondisi kegagalan; ini tidak membuktikan layanan InaRISK live berfungsi. Uji pemulihan mencakup jaringan tile putus, perubahan desktop ke HP, pindah menu, dan kembali ke tampilan nasional. `npm test` mencakup pembatasan proxy dan pembedaan bahaya/risiko.

## Data sarpras aktif: Excel + acuan infografik banjir

File `Kesiapan_Sarpras_4_Final.xlsx` menjadi bukti per KPw; infografik pengguna menjadi acuan kebutuhan. Hanya banjir ditampilkan. Pengimpor `scripts/import_readiness.py` memeriksa 46 nama kantor pada setiap sheet (tanpa bergantung urutan baris), memvalidasi semua skor sumber, lalu mempublikasikan **sheet Banjir saja** beserta tujuh kolom inventaris pendukung telepon satelit/genset/BBM yang relevan di `public/readiness-import.json`. Sel kosong tetap null.

`src/flood-readiness.js` mencocokkan bukti ke 24 kebutuhan sarpras + 4 langkah preventif. Kebutuhan majemuk yang hanya didukung satu komponen diberi status Data sebagian kebutuhan, meskipun komponen sumber bernilai 1. Contoh: pompa tidak otomatis membuktikan selang tersedia; sepatu karet tidak membuktikan jas hujan/sarung tangan. Bukti medis tidak diduplikasi untuk menyimpulkan P3K evakuasi. Butir yang tidak punya bukti tetap Data belum tersedia; nilainya tidak diubah menjadi nol. Rujukan sheet/kolom/baris ditampilkan untuk tiap pencocokan.

**Tidak memakai skor keseluruhan sheet 19 butir sebagai skor kesiapan penuh acuan 28 butir.** Progres di layar adalah cakupan bukti, bukan persentase kesiapan. Nilai mentah sumber tetap disimpan untuk keterlacakan. Tidak ada label kesiapan penuh yang disimpulkan dari data tidak lengkap.

Menu Kesiapan Sarpras, detail KPw, popup peta, dan unduhan JSON semuanya khusus banjir. Tidak ada tab bencana lain atau tampilan inventaris umum. Semua pengguna membaca dataset file yang sama; cache isian checklist lama tetap dipertahankan di localStorage tetapi tidak menimpa data sumber yang baru. Belum ada penyuntingan dataset bersama melalui backend.

## Penyempurnaan alur navigasi dan tampilan bersih

Daftar lokasi aktif kini berjenjang: **KPw → kas titipan di bawahnya → detail lokasi**. `src/directory.js` menghubungkan 87 kas titipan ke 46 KPw menggunakan kolom KPw induk dari file; tidak menebak berdasarkan jarak atau provinsi. Pencarian kas titipan menampilkan kelompok kantor induknya. Setiap kelompok menyediakan alamat dan bank anak, status koordinat, detail kantor, jaringan di peta, serta akses sarpras. KPw tanpa kas titipan memiliki empty state yang jelas; lokasi tanpa koordinat tetap tampil.

Panel mempunyai tombol kembali dan tutup yang terlihat. Kembali dari detail anak mempertahankan KPw induk. Kembali dari sarpras ke peta menutup panel dan mereset filter agar tidak ada kontrol tertutup atau filter kelompok tersembunyi. Ketika kelompok dipilih, chip nama KPw di peta menunjukkan lingkup yang aktif dan bisa dihapus. Fokus keyboard dipindahkan ke navigasi panel saat dibuka dan dikembalikan ke tombol daftar saat ditutup.

Catatan interpretasi dipusatkan di Sumber & cara baca; rincian sel sarpras dapat ditampilkan atas permintaan. Status data dan kategori sebagian/tidak tersedia tetap terlihat. Layer InaRISK tidak otomatis membuka panel pada awal halaman. Panel layer, daftar lokasi, dan pengukuran saling menutup agar peta tidak tertutup beberapa panel sekaligus.

Gradasi header/permukaan diseragamkan ke biru-kehijauan yang halus, dengan palet gelap tersendiri. Mode gelap kini berlaku untuk semua pengguna; preferensi tema lama diabaikan. Validasi UI mencakup alur pergi-pulang peta/daftar/detail/sarpras, filter, kantor tanpa anak, koordinat kosong, sumber on demand, pengukuran, dan ukuran desktop/HP.

## Layer Kemiringan lahan (Earth Engine)

Tombol **Kemiringan lahan** menyalakan/mematikan raster di pane tersendiri (di atas peta dasar, di bawah marker), menampilkan legenda, opacity, dan atribusi. Layer banjir, kemiringan, dan hujan kini dapat ditumpuk; tiap layer memiliki sakelar serta opasitas sendiri. Layer tidak dianggap aktif sebelum ada gambar tile yang berhasil dimuat.

Perhitungan mengikuti script pengguna: `NASA/NASADEM_HGT/001`, band elevation, `ee.Terrain.slope`, konversi `tan(deg × π/180) × 100`, mask `num != 0`, kemudian clip ke Indonesia dari `USDOS/LSIB_SIMPLE/2017`. Ambang kelas persen: 8, 15, 25, 40; palet persis `e4f3cc, add881, f6d567, ec9141, 942f24`. Metadata dan sumber resmi tersedia di `public/slope-source.json`. Ini kelas kemiringan, bukan kelas risiko banjir.

### Menghubungkan hasil Earth Engine

1. Jalankan `docs/earth-engine-slope-export.js` pada Code Editor dengan akun/project Earth Engine Anda yang sudah dapat menjalankan script asli. Script memakai algoritma yang sama dan mencetak `result.urlFormat` melalui getMapId. Bentuk getMapId/urlFormat telah diperiksa pada SDK resmi @google/earthengine 1.7.52; eksekusi project pengguna belum dilakukan dari cloud.
2. Isi URL itu secara privat di **Vercel → Project Settings → Environment Variables → SLOPE_TILE_URL**, lalu redeploy. Jangan mengirim URL map/token ke chat, memasukkannya ke source control, atau memberi awalan VITE_. Nilai tidak pernah dikirim lewat endpoint config publik; browser memuat gambar melalui proxy `/api/slope`.
3. Klik Kemiringan lahan. URL map Earth Engine bersifat sementara; bila kadaluarsa, jalankan ulang kode dan perbarui environment/redeploy. Untuk penerbitan jangka panjang, diperlukan integrasi Earth Engine terautentikasi yang dapat membuat map ID baru atau layanan tile hasil ekspor; itu belum dikonfigurasi.

**Status runtime saat implementasi:** SLOPE_TILE_URL belum tersedia. File credential Google generik ada tetapi tidak memuat tipe/project Earth Engine yang dapat dipakai; tidak ada kredensial yang disalin atau ditampilkan. Sumber Code Editor diblokir jaringan cloud, namun pengguna sudah memberikan JavaScript lengkap. Button, legenda, sumber, validasi/proxy, dan interaksi sudah diuji dengan gambar fixture; hasil raster Earth Engine live belum dimuat/diverifikasi. Saat belum tersambung, UI menampilkan status jujur dan tidak membuat warna kemiringan palsu.

Proxy membatasi HTTPS ke host Earth Engine yang diizinkan, memvalidasi XYZ, tidak mengikuti redirect, serta meredaksi error provider. Vite dev/preview dan Vercel menggunakan handler API yang sama.

## Logo terpilih dan diagnosis konfigurasi kemiringan

Logo aplikasi memakai opsi tetes air/topografi yang dipilih pengguna, dalam PNG transparan lokal `public/brand/ruang-risiko-drop.png`; digunakan di navigasi dan favicon. Aset diisolasi/dirapikan dengan image generation dari opsi kedua. Logo BI dan bank pada marker tidak berubah.

Endpoint config kemiringan membedakan `missing_variable` (SLOPE_TILE_URL tidak diisi), `invalid_template` (bukan URL XYZ Earth Engine yang didukung), dan `configured`. Nilai asli/URL/token tidak ditampilkan. Whitespace, tanda kutip pembungkus, serta placeholder ter-encode `%7Bz%7D`/`%7Bx%7D`/`%7By%7D` dinormalisasi. Untuk website production, isi variabel server pada environment Production lalu redeploy; konfigurasi lokal/cloud tidak otomatis mengubah Vercel. Pesan pada screenshot pengguna menunjukkan config belum valid, bukan hasil kegagalan kalkulasi NASADEM.


## Berita kebencanaan dan keterbacaan sarpras

Menu **Berita kebencanaan** (`#berita`) mengambil RSS ANTARA News melalui endpoint server `/api/news`, memfilter topik bencana, mengurutkan waktu terbit, dan menampilkan headline, gambar sumber, nama portal, serta waktu dalam WIB. Klik headline atau Baca berita untuk membuka artikel sumber. Gambar cadangan diberi label saat foto sumber tidak tersedia. Tidak ada artikel contoh yang dipublikasikan sebagai berita nyata. Cache server 5 menit; kegagalan refresh mempertahankan data sebelumnya dengan keterangan. Berita bukan peringatan darurat resmi.

Jaringan server memerlukan `www.antaranews.com`; browser memerlukan host gambar ANTARA (`cdn.antaranews.com` dan subdomain foto ANTARA yang dipakai feed). Tidak membutuhkan API key. Pada cloud onboarding, akses feed live masih ditolak proxy; parser, alur UI berhasil/gagal, dan fallback diuji dengan fixture terkontrol. Verifikasi feed production secara terpisah. InaRISK ditunda dan tidak dikembangkan dalam perubahan ini.

Sarpras memakai teks lebih besar dan berkontras tinggi serta 28 ilustrasi SVG lokal berbasis ikon Lucide (ISC); ilustrasi menunjukkan jenis kebutuhan, bukan foto bukti inventaris. Status bukti dan nilai sumber tetap mengikuti dataset. Header, navigasi, panel lokasi, dan ringkasan sarpras tetap navy pada mode terang.

Pengujian: `npm test`, `npm run build`. Regresi browser desktop/mobile (memerlukan Playwright dan Chromium):

```sh
BASE_URL=http://localhost:3001 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser/news-sarpras.mjs
```

Jalankan preview terlebih dahulu dengan `npm run preview -- --port 3001 --strictPort`. Suite memakai fixture berita dan tidak membuktikan koneksi ANTARA live. Vercel mendeteksi handler `api/news.js` bersama build Vite; deploy production mengikuti integrasi Git proyek yang tersambung ke `main`.


## Berita banjir dan tanah longsor

Feed mencakup 16 sumber, termasuk BNPB, media nasional dan daerah, serta artikel situs editorial Folkative dan USS Feed yang ditemukan di indeks Google News. Nama akun, unggahan, dan metrik engagement dari Instagram, TikTok, atau X tidak diambil. Judul disaring untuk topik banjir dan tanah longsor, termasuk banjir rob, dan istilah kiasan umum seperti “banjir diskon” dikeluarkan.

ANTARA, CNN Indonesia, dan detik mengambil RSS langsung serta hasil indeks. Sumber lain memakai indeks RSS per domain dengan pemeriksaan penerbit. URL dan judul yang sama dari penerbit yang sama digabung, dengan RSS langsung didahulukan agar metadata titik penerbit tetap tersedia. Artikel berumur lebih dari 14 hari disaring ketika snapshot baru dibuat. Hasil dibatasi hingga 300 artikel per snapshot berdasarkan ketersediaan indeks. Halaman menampilkan tiga headline lintas topik dan sumber, lalu memungkinkan pemuatan bertahap untuk daftar lainnya.

Snapshot API berlaku **30 menit**. Browser menyegarkan berita sesuai `nextRefreshAt` saat halaman berita atau fitur berita di peta aktif. Saat tab kembali aktif, data yang sudah kedaluwarsa dimuat lagi. Tombol Perbarui meminta snapshot baru. Bila pengambilan gagal, salinan terakhir tetap ditandai dan percobaan ulang dijadwalkan lima menit kemudian. Refresh membutuhkan halaman aktif atau permintaan baru dan tidak menggunakan cron.

Backend perlu HTTPS ke `www.antaranews.com`, `www.cnnindonesia.com`, `news.detik.com`, dan `news.google.com`. Pengujian lokal menggunakan fixture untuk parser, filter, refresh, dan UI. Cakupan artikel langsung mengikuti hasil feed dan indeks saat situs dijalankan.

## Layer prakiraan curah hujan CHIRPS3-GEFS

Tombol **Prakiraan hujan** di peta membuka dua periode dari GeoTIFF pengguna `chirps3_gefs_indonesia_20261117.tif` (15 band, EPSG:4326, grid 0,05°, sekitar 5,6 km). Run **17 November 2026**, tanggal sumber **UTC**:

- Pekan 1: **18–24 November 2026**, rerata band 1–7.
- Pekan 2: **25 November–1 Desember 2026**, rerata band 8–14.

Band 15 (2 Desember) tidak dimasukkan ke kedua rerata pekanan. Sel wajib memiliki tujuh nilai valid non-negatif; nol adalah curah hujan valid. Palet dan simpul warna mengikuti script pengguna: 0, 2, 5, 10, 15, 20, 25, 35, 50, 80+ mm/hari. Prakiraan hujan bukan klasifikasi risiko banjir.

Layer aktif memakai Leaflet GridLayer dengan tile canvas XYZ 256×256. Tiap pixel tile diproyeksikan balik dari Web Mercator ke koordinat grid sumber, lalu nilai curah hujannya diinterpolasi bilinear. Tile baru dihitung pada setiap tingkat zoom dan perpindahan viewport, tanpa membesarkan satu gambar nasional. Batas darat Natural Earth 1:10 juta di-clip sebagai path vektor per tile; batas ini lebih rinci daripada basemap sederhana aplikasi. Bilinear digunakan pada tampilan, sedangkan klik peta/marker membaca rerata sel **grid asli** dari file float32 little-endian. Sel di luar grid atau mask mengembalikan Data tidak tersedia. Penggantian pekan yang gagal mempertahankan gambar sebelumnya. Opasitas dapat diatur; ketiga raster hujan/lereng/InaRISK dapat aktif bersamaan dengan opasitas independen. Tanggal yang telah berlalu diberi keterangan arsip.

**Perbedaan batas:** TIFF mencakup persegi panjang regional, sehingga publikasi web dipotong ke batas Indonesia Natural Earth skala 1:10 juta dari `public/rainfall/boundary.geojson`. Script Earth Engine pengguna memakai `USDOS/LSIB_SIMPLE/2017`; bentuk pantai/pulau kecil dapat berbeda. Rerata nilai dan simpul warna mengikuti perhitungan sumber, tetapi mask tidak diklaim identik dengan LSIB.

`public/rainfall/manifest.json` mencatat tanggal tiap pekan, band, grid, bounds, metode batas, dan SHA-256 TIFF sumber. Grid hasil olahan disimpan bersama aplikasi; PNG hanya arsip preview dan tidak dipakai oleh layer peta; tidak memerlukan API key atau URL Earth Engine sementara. Tautan script rujukan pengguna: https://code.earthengine.google.com/edbe2223fde4d3e7b5e30cc83793539a . Script tersebut bukan sumber data yang dapat otomatis dieksekusi oleh browser aplikasi.

**Ini snapshot run 17 November 2026, bukan feed otomatis.** Untuk run berikutnya, gunakan TIFF baru dan jalankan kembali preparasi; perbarui metadata `src/rainfall-data.js` dan uji label periode sebelum deploy. File TIFF asli dipertahankan sebagai lampiran workspace, tidak dimasukkan ke bundle publik. Reproduksi (Python 3.12, numpy 2.3.5, rasterio 1.5.2, Pillow):

```sh
python -m venv --system-site-packages /workspace/.onboarding-tools/raster-venv
/workspace/.onboarding-tools/raster-venv/bin/pip install rasterio==1.5.2
/workspace/.onboarding-tools/raster-venv/bin/python scripts/prepare_rainfall.py /path/to/chirps3_gefs_indonesia_20261117.tif
npm test
npm run build
BASE_URL=http://localhost:3002 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser/rainfall.mjs
```

Tes angka memakai referensi rerata dari TIFF asli, bukan warna render. Seluruh sel valid pada grid negara telah dibandingkan dengan rerata tujuh band; galat pembulatan float32 maksimum <0,000002 mm/hari. Tes browser memuat grid sungguhan dan menguji tile canvas, termasuk setelah zoom/pan; akses peta dasar eksternal dapat dimatikan tanpa memengaruhi raster prakiraan ini.

Renderer tile memakai `week*-render.f32` yang memuat rerata regional sebelum mask garis pantai, agar interpolasi tepi tidak terpotong mengikuti pixel mask resolusi rendah. Pemotongan negara dilakukan ulang pada setiap tile. Pembacaan titik memakai grid native `week*.f32` seperti sebelumnya. Resolusi sumber tetap ±5,6 km; zoom tinggi tidak menambah ketelitian prakiraan. Tes mencakup koordinat XYZ pada zoom 4/8/12/16, sambungan antartile, rerata sel sumber, serta layer tetap tersedia setelah zoom dan pan.


## Sakelar layer independen

Kemiringan lahan, Prakiraan hujan, dan Layer banjir adalah tiga sakelar terpisah. Klik pertama meminta layer aktif; klik berikutnya mematikan layer itu saja, termasuk ketika panel pengaturannya sedang tertutup. Hujan dan kemiringan diminta otomatis saat peta pertama dibuka, dengan opasitas awal 70% dan 100%. InaRISK baru dihubungi saat diaktifkan. Indikator aktif mengikuti gambar yang berhasil dimuat, dengan status kegagalan sumber tetap terlihat.

Mengaktifkan raster lain hanya mengganti panel pengaturan yang terlihat; tidak mematikan raster sebelumnya. Tab Hujan/Lereng/Banjir pada panel membuka pengaturan tanpa mengubah status layer. Opasitas dipertahankan masing-masing. Urutan gambar dari bawah ke atas: InaRISK, lereng, hujan, garis jaringan, kemudian marker lokasi. Tombol Pengaturan layer membuka kontrol opasitas tanpa mematikan layer. Ini perbandingan visual sumber, bukan perhitungan otomatis skor risiko gabungan.

Regresi browser: `BASE_URL=http://localhost:3002 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser/layer-stack.mjs`. Suite memeriksa kedua urutan aktivasi, ketiga raster bersamaan, opasitas terpisah, matikan layer dengan panel tersembunyi, dan zoom pada desktop/HP. Tile InaRISK dan lereng memakai fixture terkontrol; hujan memakai grid asli. Ini menguji perilaku layer, bukan membuktikan akses live ke BNPB/Earth Engine.

## Penanda berita dan Prioritas Pantauan

**Penanda berita** aktif saat peta dibuka. Sakelar ini bisa mematikan atau menampilkan lagi pin kuning. Koordinat dari RSS penerbit diutamakan. Bila kosong, judul dicocokkan dengan nama kota atau provinsi di daftar wilayah. Penanda memakai perkiraan pusat kota atau ibu kota provinsi dan diberi label sebagai titik acuan wilayah. Artikel tanpa lokasi yang cocok tetap tersedia di menu **Berita kebencanaan**. Popup memuat sumber, waktu terbit dalam WIB, dan tautan artikel.

**Prioritas Pantauan** merangkum wilayah yang disebut dalam berita banjir dan tanah longsor. Urutan mendahulukan jumlah butir sarpras KPw setempat yang tercatat kurang atau tidak tersedia, kemudian waktu berita terbaru. Data kosong tetap ditampilkan sebagai belum tersedia. Daftar ini membantu tindak lanjut dan tidak menetapkan lokasi kejadian atau tingkat risiko banjir.

Peta dan menu berita berbagi cache dan jadwal refresh. Jika sumber gagal saat diperbarui, salinan terakhir tetap tersedia dan diberi keterangan.

Kantor Pusat BI tercantum di Daftar lokasi sebagai entri terpisah dari KPw DKI Jakarta. Keduanya punya tautan pencarian berdasarkan alamat. KPw DKI dan Kantor Pusat memiliki titik acuan terpisah di Senen dan Thamrin. Keduanya diberi label ≈ sampai titik gedung dapat diverifikasi. Kantor Pusat ditampilkan sebagai tambahan di luar 133 lokasi jaringan. Pemeriksaan rentang peta tidak menyatakan bahwa koordinat dari Excel sudah cocok dengan gedung.

Garis tipis pada peta menghubungkan KPw ke kas titipan berdasarkan kolom induk dari sumber. Garis muncul saat kedua ujung punya koordinat dan masuk dalam filter peta. Garis jaringan berwarna biru memakai setidaknya satu titik perkiraan. Garis hijau kebiruan memakai koordinat dari data di kedua ujung. Garis ini menunjukkan hubungan jaringan antartitik.
