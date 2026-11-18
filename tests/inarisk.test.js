import test from 'node:test';
import assert from 'node:assert/strict';
import {handleInarisk} from '../api/inarisk.js';

const hazard = 'inarisk/layer_bahaya_banjir/ImageServer';
const params = (mode, extra = {}) => new URLSearchParams({mode,service:hazard,...extra});

test('the catalog exposes the official flood studies and district capacity', async () => {
 const {json:{services}} = await handleInarisk(params('catalog'));
 assert.equal(services.length,7);
 assert.deepEqual(services.filter(layer=>layer.hazard==='banjir').map(layer=>layer.study), ['bahaya','risiko','kerentanan','kapasitas']);
 assert.ok(services.every(layer=>new URL(layer.sourceUrl).hostname==='inarisk1.bnpb.go.id'));
});

test('the proxy rejects unlisted services and invalid bboxes', async () => {
 for (const service of ['https://evil.example/MapServer','../BAHAYA_BANJIR/MapServer','inarisk/GEMPA/MapServer']) {
  assert.equal((await handleInarisk(params('metadata',{service}))).status,400);
 }
 for (const bbox of ['NaN,0,0,1','1,0,0,1','0,0,0,0']) {
  assert.equal((await handleInarisk(params('image',{bbox}))).status,400);
 }
});

test('Upstream error responses do not become map pixels', async t => {
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:{message:'Unavailable'}}));
 await assert.rejects(handleInarisk(params('image',{bbox:'0,0,256,256'})),/gambar peta/);
});

test('national data is mapped to class areas and losses in rupiah', async t => {
 t.mock.method(globalThis,'fetch',async url => {
  if (url.includes('kajian-summary')) {
   assert.match(url,/banjir\/ALL\?kajian=bahaya$/);
   return Response.json({summary:{wilayah_count:6424,tinggi_luas:25846638,sedang_luas:23929691,rendah_luas:1480200,tinggi_rp:710678329,sedang_rp:296240850,rendah_rp:0}});
  }
  return Response.json({name:'Bahaya Banjir'});
 });
 const {json} = await handleInarisk(params('metadata'));
 assert.equal(json.summary.count,6424);
 assert.deepEqual(json.summary.classes[0],{key:'tinggi',value:25846638,loss:710678329000});
 assert.equal(json.summary.classes[2].loss,0);
});

test('metadata remains usable when national statistics are unavailable', async t => {
 t.mock.method(globalThis,'fetch',async url => url.includes('kajian-summary')
  ? new Response(null,{status:503})
  : Response.json({name:'Bahaya Banjir'}));
 const {json} = await handleInarisk(params('metadata'));
 assert.equal(json.summary,null);
 assert.equal(json.study,'bahaya');
});

test('risk uses the official WMS layer and preserves the tile projection', async t => {
 t.mock.method(globalThis,'fetch',async url => {
  const request = new URL(url);
  assert.equal(request.hostname,'inarisk1.bnpb.go.id');
  assert.equal(request.searchParams.get('layers'),'INDEKS_RISIKO_BANJIR1');
  assert.equal(request.searchParams.get('srs'),'EPSG:3857');
  assert.equal(request.searchParams.get('bbox'),'0,0,256,256');
  return new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}});
 });
 const result = await handleInarisk(params('image',{service:'inarisk/layer_risiko_banjir/ImageServer',bbox:'0,0,256,256'}));
 assert.equal(result.binary.length,4);
});
