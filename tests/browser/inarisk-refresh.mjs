// Run against a built preview: BASE_URL=http://localhost:3040 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser/inarisk-refresh.mjs
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE1sAAAAASUVORK5CYII=','base64');
const service=name=>({name:'inarisk/'+name,service:'inarisk/'+name+'/MapServer',kind:'Bahaya banjir',sourceUrl:'https://inarisk.bnpb.go.id/'});
let fail='',version=1;
await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
await page.route('**/api/inarisk?*',async route=>{
 const mode=new URL(route.request().url()).searchParams.get('mode');
 if(fail==='deployment')return route.fulfill({status:404,contentType:'text/html',body:'Not Found'});
 if(mode===fail)return route.fulfill({status:502,json:{error:'Controlled source failure'}});
 if(mode==='image')return route.fulfill({contentType:'image/png',body:png});
 return route.fulfill({json:mode==='catalog'?{services:[{...service('RISIKO_BANJIR'),kind:'Risiko banjir'},service('BAHAYA_BANJIR'),service('BAHAYA_BANJIR_ALTERNATIF')]}:{metadata:{name:'Fixture '+version},legend:{layers:[{layerName:'Fixture',legend:[{label:'Class '+version}]}]}}});
});
const ready=()=>page.waitForFunction(()=>document.querySelector('#inarisk-retry')?.disabled===false);
const layers=()=>page.locator('.leaflet-floodOverlay-pane .leaflet-layer');
try{
 await page.goto(process.env.BASE_URL||'http://localhost:3040');
 await page.locator('#inarisk-toggle').click();await ready();
 assert.equal(await layers().count(),1);
 assert.equal(await page.locator('#inarisk-service').inputValue(),'inarisk/BAHAYA_BANJIR/MapServer');
 await page.locator('#inarisk-opacity').fill('35');
 await layers().evaluate(el=>el.dataset.regressionOriginal='yes');
 for(const phase of ['catalog','metadata','image']){
  fail=phase;await page.locator('#inarisk-retry').click();await ready();
  assert.match(await page.locator('#inarisk-status').innerText(),/Layer sebelumnya tetap tersedia/,phase);
  assert.equal(await layers().count(),1,phase+' must retain exactly one raster');
  assert.equal(await layers().getAttribute('data-regression-original'),'yes');
  assert.equal(await layers().evaluate(el=>el.style.opacity),'0.35');
  assert.match(await page.locator('#inarisk-legend').innerText(),/Class 1/);
  assert.equal(await page.locator('#inarisk-controls').evaluate(el=>el.classList.contains('hidden')),false);
 }
 fail='metadata';await page.locator('#inarisk-service').selectOption('inarisk/BAHAYA_BANJIR_ALTERNATIF/MapServer');await ready();
 assert.equal(await page.locator('#inarisk-service').inputValue(),'inarisk/BAHAYA_BANJIR/MapServer');
 assert.equal(await layers().getAttribute('data-regression-original'),'yes');
 fail='';version=2;await page.locator('#inarisk-retry').click();await ready();
 assert.equal(await layers().count(),1);assert.equal(await layers().getAttribute('data-regression-original'),null);
 assert.equal(await layers().evaluate(el=>el.style.opacity),'0.35');
 assert.match(await page.locator('#inarisk-legend').innerText(),/Class 2/);
 await page.locator('#inarisk-visible').uncheck();assert.equal(await layers().count(),0);
 await page.locator('#inarisk-visible').check();await page.waitForTimeout(300);assert.equal(await layers().count(),1);
 // A returning visitor can recover the last successful public source configuration, labelled as cached.
 fail='catalog';await page.reload();await page.locator('#inarisk-toggle').click();await ready();assert.equal(await layers().count(),1);
 assert.match(await page.locator('#inarisk-status').innerText(),/sumber tersimpan/);
 // Cold-start failure must remain honest, without inventing an overlay.
 await page.evaluate(()=>localStorage.removeItem('ruang-inarisk-last-good-v2'));
 fail='catalog';await page.reload();await page.locator('#inarisk-toggle').click();await ready();assert.equal(await layers().count(),0);
 assert.match(await page.locator('#inarisk-status').innerText(),/belum terhubung/);
 assert.match(await page.locator('#inarisk-connection-error').textContent(),/Katalog layanan InaRISK \(HTTP 502\): Controlled source failure/);
 fail='deployment';await page.reload();await page.locator('#inarisk-toggle').click();await ready();assert.equal(await layers().count(),0);
 assert.match(await page.locator('#inarisk-connection-error').textContent(),/HTTP 404.*deployment/);
 assert.deepEqual(errors,[]);
 console.log('PASS: refresh catalog, metadata and image failures retain raster, legend, selection and opacity; successful replacement, visibility and cold failure. Controlled fixtures, not live BNPB verification.');
}finally{await browser.close();}
