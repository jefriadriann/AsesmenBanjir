// Jalankan di Google Earth Engine Code Editor dengan project Earth Engine Anda.
// Sama dengan perhitungan layer pada script pengguna; tidak menambahkan kelas risiko banjir.
var indonesia = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017')
  .filter(ee.Filter.eq('country_na', 'Indonesia'));
var nasadem = ee.Image('NASA/NASADEM_HGT/001');
var elevasi = nasadem.select('elevation').rename('Elevasi_m');
var lerengDerajat = ee.Terrain.slope(elevasi).rename('Lereng_derajat');
var lerengPersen = lerengDerajat.multiply(Math.PI / 180).tan().multiply(100).rename('Lereng_persen');
var hasil = elevasi.addBands(lerengDerajat).addBands(lerengPersen)
  .updateMask(nasadem.select('num').neq(0)).clipToCollection(indonesia);
var persen = hasil.select('Lereng_persen');
var kelas = persen.gte(8).add(persen.gte(15)).add(persen.gte(25)).add(persen.gte(40)).toByte();
var visual = {min:0,max:4,palette:['e4f3cc','add881','f6d567','ec9141','942f24']};
Map.setCenter(118,-2.5,5);
Map.addLayer(kelas,visual,'Kemiringan lereng Indonesia (%)');
// URL ini diperlakukan sebagai konfigurasi privat server, jangan dibagikan di chat.
// Isi sebagai SLOPE_TILE_URL di environment Vercel, lalu redeploy.
// URL map Earth Engine bersifat sementara; jika expired, jalankan ulang dan perbarui env.
kelas.getMapId(visual,function(result,error){
  if(error){print('Pembuatan layer gagal',error);return;}
  print('Salin urlFormat ke environment SLOPE_TILE_URL (jangan ke chat):',result.urlFormat);
});
