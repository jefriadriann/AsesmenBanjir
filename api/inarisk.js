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
 if (mode === 'catalog') return {json:{services, source:'BNPB InaRISK', catalogUrl:CATALOG}};

 const layer = services.find(item => item.service === params.get('service'));
 if (!layer) return {status:400,json:{error:'Layanan banjir tidak valid.'}};
 const wmsLayer = wmsLayers[layer.name];

 if (mode === 'metadata') {
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
  const query = new URLSearchParams({service:'WMS',version:'1.1.1',request:'GetMap',layers:wmsLayer,styles:'',
   bbox:parts.join(','),srs:'EPSG:3857',width:'256',height:'256',format:'image/png',transparent:'true'});
  return {binary:await remote(WMS+'?'+query,true)};
 }
 return {status:400,json:{error:'Mode tidak tersedia.'}};
}

export default async function handler(req,res) {
 try {
  const result = await handleInarisk(new URL(req.url,'http://localhost').searchParams);
  res.statusCode = result.status || 200;
  if (result.binary) {
   res.setHeader('Content-Type','image/png');
   res.setHeader('Cache-Control','public, max-age=900');
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
