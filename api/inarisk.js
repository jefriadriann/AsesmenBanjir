const CATALOG = 'https://inarisk.bnpb.go.id/v4/config/arcgis-layers.json';
const WMS = 'https://inarisk1.bnpb.go.id/geoserver/raster/wms';
const capabilities = WMS + '?service=WMS&request=GetCapabilities';
const wmsLayers = {
 layer_bahaya_banjir:'INDEKS_BAHAYA_BANJIR1',
 layer_bahaya_banjir_bandang:'INDEKS_BAHAYA_BANJIRBANDANG1',
 layer_kerentanan_banjir:'INDEKS_KERENTANAN_BANJIR1',
 layer_peta_kapasitas:'INDEKS_KAPASITAS',
 layer_risiko_banjir:'INDEKS_RISIKO_BANJIR1',
 layer_risiko_banjir_bandang:'INDEKS_RISIKO_BANJIR_BANDANG1',
 layer_kerentanan_banjir_bandang:'INDEKS_KERENTANAN_BANJIR_BANDANG1'
};
const SUMMARY = 'https://inarisk.bnpb.go.id/apiv4/kajian-summary';
const studyNames = {bahaya:'Bahaya', risiko:'Risiko', kerentanan:'Kerentanan', kapasitas:'Kapasitas'};
const hazardNames = {banjir:'banjir', banjir_bandang:'banjir bandang'};
const services = Object.entries(hazardNames).flatMap(([hazard, label]) =>
 Object.entries(studyNames).filter(([study]) => study !== 'kapasitas').map(([study, name]) => ({
  hazard, study, kind: name + ' ' + label, service: 'inarisk/layer_' + study + '_' + hazard + '/ImageServer'
 })));
services.push({hazard:'banjir', study:'kapasitas', kind:'Kapasitas daerah', service:'inarisk/layer_peta_kapasitas/ImageServer'});
for (const layer of services) {
 layer.name = layer.service.split('/')[1];
 layer.type = 'ImageServer';
 layer.sourceUrl = capabilities;
}

const dashboard = 'https://inarisk.bnpb.go.id/dashboard-monev-bencana/';
const nowcast = 'https://nowcasting.bmkg.go.id/arcgis/rest/services/production/nowcasting_publik_phase2/MapServer';
const discharge = 'https://flood-api.open-meteo.com/v1/flood';
const extraLayers = [
 ['bahaya_longsor', 'Bahaya tanah longsor', 'INDEKS_BAHAYA_TANAHLONGSOR1'],
 ['risiko_longsor', 'Risiko tanah longsor', 'INDEKS_RISIKO_TANAH_LONGSOR1'],
 ['bahaya_gempa', 'Bahaya gempa bumi', 'INDEKS_BAHAYA_GEMPABUMI1'],
 ['bahaya_karhutla', 'Bahaya kebakaran hutan dan lahan', 'INDEKS_BAHAYA_KARHUTLA1'],
 ['bahaya_kekeringan', 'Bahaya kekeringan', 'INDEKS_BAHAYA_KEKERINGAN1'],
 ['bahaya_cuaca_ekstrem', 'Bahaya cuaca ekstrem', 'INDEKS_BAHAYA_CUACAEKSTRIM1'],
 ['risiko_abrasi', 'Risiko gelombang ekstrem dan abrasi', 'INDEKS_RISIKO_GELOMBANG_EKSTRIM_ABRASI1'],
 ['sesar', 'Sesar Indonesia', 'Faults2017_Rupture2018'],
];
for (const [name, kind, wmsLayer] of extraLayers) {
 wmsLayers[name] = wmsLayer;
 services.push({name, kind, service:`monev/${name}/ImageServer`, type:'ImageServer', sourceUrl:capabilities, group:'Dashboard Monev'});
}
const ministry = 'https://geoportal.planologi.kehutanan.go.id/server/rest/services/Peta_Interaktif_2026/';
const arcgisLayers = {
 nowcasting: {label:'Nowcasting aktif BMKG',url:nowcast,layers:'show:2',credit:'BMKG'},
 das: {label:'Batas DAS',url:ministry+'DAS_AR_50K/MapServer',credit:'Kementerian Kehutanan'},
 administrasi: {label:'Batas administrasi kabupaten/kota',url:ministry+'RBI50K_ADMINISTRASI_KAB_KOTA_202512/MapServer',credit:'Kementerian Kehutanan'},
 penggunaan_lahan: {label:'Penggunaan lahan 2025',url:ministry+'PL_AR_250K/MapServer',layers:'show:0',credit:'Kementerian Kehutanan'},
 kawasan_hutan: {label:'Kawasan hutan',url:ministry+'KWSHUTAN_AR_250K/MapServer',credit:'Kementerian Kehutanan'},
 lahan_kritis: {label:'Lahan kritis',url:ministry+'LAHAN_KRITIS_AR_50K/MapServer',credit:'Kementerian Kehutanan'},
};
for (const [name, source] of Object.entries(arcgisLayers)) {
 services.push({name,kind:source.label,service:`monev/${name}/MapServer`,type:'MapServer',
  sourceUrl:source.url+'?f=pjson',credit:source.credit,group:'Dashboard Monev'});
}

async function remote(url, binary = false, timeout = 10000) {
 const response = await fetch(url, {signal:AbortSignal.timeout(timeout), headers:{Accept:binary?'image/png':'application/json'}, redirect:'error'});
 if (!response.ok) throw Error('Sumber InaRISK merespons HTTP ' + response.status);
 if (binary) {
  if (!response.headers.get('content-type')?.startsWith('image/png')) throw Error('Layanan belum mengembalikan gambar peta.');
  return Buffer.from(await response.arrayBuffer());
 }
 const body = await response.json();
 if (body.error) throw Error(body.error.message || 'Layanan InaRISK tidak tersedia.');
 return body;
}

async function getSummary(layer) {
 const hazard = layer.hazard.replaceAll('_','');
 const url = SUMMARY + '/' + hazard + '/ALL?kajian=' + layer.study;
 const {summary} = await remote(url, false, 4500);
 const capacity = layer.study === 'kapasitas';
 const values = capacity ? summary?.kapasitas_kabupaten : summary;
 const classes = ['tinggi','sedang','rendah'].map(key => ({
  key,
  value: values?.[capacity ? key : key + '_luas'],
  ...(layer.study === 'bahaya' ? {loss: Number.isFinite(values?.[key + '_rp']) ? values[key + '_rp'] * 1000 : null} : {})
 }));
 const count = values?.[capacity ? 'total' : 'wilayah_count'];
 if (![count, ...classes.map(row => row.value)].every(value => Number.isFinite(value) && value >= 0)) {
  throw Error('Ringkasan nasional tidak lengkap.');
 }
 return {count, classes, sourceUrl:url};
}

export async function handleInarisk(params) {
 const mode = params.get('mode') || 'catalog';
 if (mode === 'catalog') return {json:{services, source:'BNPB InaRISK', catalogUrl:CATALOG, dashboard}};

 if (mode === 'discharge') {
  const coords = ['lat','lng'].map(key => params.get(key));
  const [lat,lng] = coords.map(Number);
  if (coords.some(value => !value?.trim()) || !Number.isFinite(lat) || !Number.isFinite(lng)
   || lat < -11.7 || lat > 6.3 || lng < 94.4 || lng > 141.5) {
   return {status:400,json:{error:'Pilih titik dalam cakupan peta Indonesia.'}};
  }
  const query = new URLSearchParams({latitude:lat.toFixed(3),longitude:lng.toFixed(3),
   daily:'river_discharge,river_discharge_max',forecast_days:'7'});
  const data = await remote(discharge+'?'+query);
  const daily = data.daily;
  const days = Array.isArray(daily?.time) ? daily.time.slice(0,7).flatMap((date,index) => {
   const value = daily.river_discharge?.[index], max = daily.river_discharge_max?.[index];
   return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value) && value >= 0
    ? [{date,value,max:Number.isFinite(max) && max >= 0 ? max : null}] : [];
  }) : [];
  return {json:{days,latitude:data.latitude,longitude:data.longitude,source:'GloFAS melalui Open-Meteo',timeZone:'UTC'}};
 }

 const layer = services.find(item => item.service === params.get('service'));
 if (!layer) return {status:400,json:{error:'Layanan banjir tidak valid.'}};
 const wmsLayer = wmsLayers[layer.name];
 const arcgis = arcgisLayers[layer.name];
 const wms = layer.name === 'sesar' ? 'https://inarisk1.bnpb.go.id/geoserver/basemap/wms' : WMS;

 if (mode === 'metadata') {
  if (layer.group) {
   const legendUrl = wmsLayer ? wms+'?'+new URLSearchParams({service:'WMS',version:'1.0.0',request:'GetLegendGraphic',format:'image/png',layer:wmsLayer}) : null;
   const legend = arcgis && layer.name !== 'nowcasting' ? await remote(arcgis.url+'/legend?f=json',false,5000).catch(() => null) : null;
   if (legend && arcgis.layers) legend.layers = legend.layers?.filter(item=>`show:${item.layerId}`===arcgis.layers);
   return {json:{metadata:{name:wmsLayer||layer.kind,sourceUrl:layer.name==='sesar'?wms+'?service=WMS&request=GetCapabilities':layer.sourceUrl},legendUrl,legend}};
  }
  const summary = await getSummary(layer).catch(() => null);
  return {json:{
   metadata:{name:wmsLayer, sourceUrl:capabilities},
   study:layer.study, summary
  }};
 }

 if (mode === 'image') {
  const parts = (params.get('bbox') || '').split(',');
  const [west, south, east, north] = parts.map(Number);
  if (parts.length !== 4 || !parts.every(n => n.trim() && Number.isFinite(Number(n)) && Math.abs(Number(n)) <= 21000000) || west >= east || south >= north) {
   return {status:400,json:{error:'Batas peta tidak valid.'}};
  }
  if (arcgis) {
   const query = new URLSearchParams({bbox:parts.join(','),bboxSR:'3857',imageSR:'3857',size:'256,256',
    format:'png32',transparent:'true',...(arcgis.layers?{layers:arcgis.layers}:{}),f:'image'});
   return {binary:await remote(arcgis.url+'/export?'+query,true),maxAge:layer.name==='nowcasting'?60:900};
  }
  const query = new URLSearchParams({service:'WMS',version:'1.1.1',request:'GetMap',layers:wmsLayer,styles:'',
   bbox:parts.join(','),srs:'EPSG:3857',width:'256',height:'256',format:'image/png',transparent:'true'});
  return {binary:await remote(wms+'?'+query,true)};
 }
 return {status:400,json:{error:'Mode tidak tersedia.'}};
}

export default async function handler(req,res) {
 try {
  const result = await handleInarisk(new URL(req.url,'http://localhost').searchParams);
  res.statusCode = result.status || 200;
  if (result.binary) {
   res.setHeader('Content-Type','image/png');
   res.setHeader('Cache-Control','public, max-age='+(result.maxAge??900));
   res.end(result.binary);
  } else {
   res.setHeader('Content-Type','application/json');
   res.setHeader('Cache-Control',result.status || result.json.summary === null ? 'no-store' : 'public, max-age=300');
   res.end(JSON.stringify(result.json));
  }
 } catch(error) {
  res.statusCode = 502;
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify({error:error.name==='TimeoutError'?'Sumber InaRISK belum merespons.':error.message,source:'BNPB InaRISK'}));
 }
}
