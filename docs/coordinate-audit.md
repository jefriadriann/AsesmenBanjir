# Audit koordinat — 16 November 2026

133 lokasi diperiksa: 46 KPw, 87 kas titipan. **0 koordinat kantor terverifikasi.** Ini audit kualitas dan asal data, bukan pengesahan lokasi.

Semua koordinat lama berstatus `approximate` dan berpresisi dua desimal. Asalnya perkiraan pusat kota yang dibuat saat prototipe; bukan Google Maps, bukan geocoding alamat, dan bukan sumber kantor resmi. Dua desimal saja tidak membuktikan salah, tetapi asal perkiraan tersebut tidak memadai untuk menempatkan kantor atau menghitung paparan banjir.

- Seluruh 133 titik berada dalam kotak kawasan Indonesia; ini tidak membuktikan posisi kantor benar.
- 18 kas titipan tidak mencantumkan bank pengelola.
- 2 entri hanya mencantumkan BPD yang ambigu: Mukomuko dan Polewali Mandar. Tidak boleh menebak bank dari wilayah.
- Sumatera Utara (`KPW-02`): pengguna melaporkan titik salah. Screenshot mengidentifikasi bangunan kantor BI di sekitar Jalan Raden Saleh, Medan. Screenshot tidak memuat koordinat, sehingga tidak cukup untuk menetapkan latitude/longitude.
- Daftar 46 KPw sendiri belum direkonsiliasi terhadap direktori resmi BI.

## Rekam per lokasi

`coordinate-audit.csv` mencantumkan seluruh 133 lokasi, koordinat perkiraan lama, masalah data, kolom koordinat terverifikasi yang masih kosong, dan URL pencarian. URL pencarian adalah langkah pencarian, **bukan bukti verifikasi**.

`public/locations.json` mempertahankan `coords` untuk tampilan perkiraan wilayah dan kompatibilitas. `verifiedOfficeCoords` bernilai null, `coordinateAccuracy` bernilai `city_estimate`, dan `coordinateEvidence` kosong. Angka lama tidak boleh dipakai untuk mengekspor/mengklaim lokasi kantor terverifikasi.

## Verifikasi yang masih harus dilakukan

1. Cocokkan nama resmi dan alamat KPw dengan direktori BI. Untuk kas titipan, cocokkan bank pengelola, cabang, kota, dan alamat dari direktori resmi bank; selesaikan entri tanpa identitas bank terlebih dahulu.
2. Temukan bangunan kantor yang sesuai pada peta, bukan pusat kota, ATM, museum BI, kantor lama, atau cabang lain dengan nama mirip.
3. Bandingkan alamat dan lokasi dengan sumber kedua. Simpan URL, nama tempat/ID jika tersedia, alamat, tanggal akses, dan alasan kecocokan. Hasil pencarian tunggal/urutan pertama tidak cukup.
4. Catat koordinat bangunan yang didukung bukti dan ubah status hanya setelah kecocokan dipastikan. Jika ambigu, tetap tandai belum terverifikasi.

## Kendala akses

Permintaan read-only ke `www.bi.go.id`, `nominatim.openstreetmap.org`, dan `overpass-api.de` ditolak HTTP 403 oleh jaringan environment. Google Maps juga ditolak pada pemeriksaan sebelumnya. Tambahan domain sudah disimpan sebagai draft pengaturan jaringan; penyimpanan draft belum menerapkannya ke runtime. Tidak ada koordinat baru yang ditetapkan berdasarkan dugaan atau hasil geocoding otomatis.
