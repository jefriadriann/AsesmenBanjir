import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE1sAAAAASUVORK5CYII=','base64');
const service={name:'inarisk/RISIKO_BANJIR',service:'inarisk/RISIKO_BANJIR/MapServer',kind:'Risiko banjir',sourceUrl:'https://inarisk.bnpb.go.id/'};
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',r=>r.abort());
 await page.route('**/api/slope?*',r=>new URL(r.request().url()).searchParams.get('mode')==='tile'?r.fulfill({contentType:'image/png',body:png}):r.fulfill({json:{available:true,state:'configured'}}));
 await page.route('**/api/inarisk?*',r=>{const mode=new URL(r.request().url()).searchParams.get('mode');return mode==='image'?r.fulfill({contentType:'image/png',body:png}):r.fulfill({json:mode==='catalog'?{services:[service]}:{metadata:{name:'Controlled risk layer'},legend:{layers:[]}}});});
 await page.goto(process.env.BASE_URL||'http://localhost:3002');
 const keys=['rainfall','slope','inarisk'];
 const pane={rainfall:'rainfallOverlay',slope:'slopeOverlay',inarisk:'floodOverlay'};
 const contextOpacity=()=>page.evaluate(()=>['rainfallOverlay','slopeOverlay'].map(name=>
   getComputedStyle(document.querySelector('.leaflet-'+name+'-pane')).opacity));
 const floodOpacity=()=>page.locator('.leaflet-floodOverlay-pane').evaluate(node=>getComputedStyle(node).opacity);
 await page.locator('#slope-toggle').waitFor();
 assert.equal(await page.getByRole('group',{name:'Risiko',exact:true}).locator('#inarisk-toggle').count(),1);
 const assessment=page.getByRole('group',{name:'Asesmen Risiko',exact:true});
 assert.equal(await assessment.locator('#rainfall-toggle, #slope-toggle').count(),2);
 const expectButtonColor=(key,color)=>page.waitForFunction(({key,color})=>
   getComputedStyle(document.querySelector('#'+key+'-toggle')).backgroundColor===color,{key,color},{timeout:4000});
 const count=key=>page.locator('.leaflet-'+pane[key]+'-pane>.leaflet-layer').count();
 for(const key of ['rainfall','slope']){
   await page.waitForFunction(id=>document.querySelector('#'+id+'-toggle')?.getAttribute('aria-pressed')==='true',key);
   assert.equal(await count(key),1);
   await expectButtonColor(key,'rgb(221, 226, 231)');
   assert.equal(await page.locator('.'+key+'-panel').isHidden(),true);
 }
 assert.equal(await count('inarisk'),0);
 await expectButtonColor('inarisk','rgb(36, 73, 110)');
 assert.deepEqual(await contextOpacity(),['1','1']);
 assert.equal(await page.locator('.leaflet-rainfallOverlay-pane>.leaflet-layer').evaluate(e=>e.style.opacity),'0.7');
 assert.equal(await page.locator('#slope-opacity').inputValue(),'100');
 const layerOrder = await page.evaluate(() => [
   'slopeOverlay', 'rainfallOverlay', 'floodOverlay', 'officeConnections', 'marker'
 ].map(name => Number(getComputedStyle(document.querySelector('.leaflet-'+name+'-pane')).zIndex)));
 assert.ok(layerOrder.every((level,index) => index===0 || level>layerOrder[index-1]), layerOrder.join(' < '));
 const toolbar = await page.locator('.explorer-top').boundingBox();
 const news = await page.locator('#news-map-toggle').boundingBox();
 const slope = await page.locator('#slope-toggle').boundingBox();
 assert.ok(news.y >= toolbar.y && slope.y + slope.height <= toolbar.y + toolbar.height);
 if (width > 1000) {
   const group = await assessment.boundingBox();
   assert.ok(Math.abs((news.y + news.height / 2) - (group.y + group.height / 2)) <= 2);
 }
 assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
 await page.locator('#layer-settings').click();
 await page.locator('#rainfall-opacity').waitFor();
 assert.match(await page.locator('.rainfall-panel details').textContent(), /inframerah satelit geostasioner/);
 await page.locator('.rainfall-panel [data-layer-panel="slope"]').click();
 assert.match(await page.locator('#slope-source').innerText(), /Radar pita C SRTM.*Endeavour/);
 await page.locator('#inarisk-toggle').click();
 await page.waitForFunction(()=>document.querySelector('#inarisk-toggle')?.getAttribute('aria-pressed')==='true');
 assert.deepEqual(await contextOpacity(),['1','1']);
 await expectButtonColor('inarisk','rgb(221, 226, 231)');
 assert.equal(await page.locator('#inarisk-opacity').inputValue(),'100');
 await page.locator('#inarisk-close').click();
 assert.deepEqual(await contextOpacity(),['1','1']);
 await page.locator('#layer-settings').click();
 assert.deepEqual(await contextOpacity(),['1','1']);
 assert.equal(await floodOpacity(),'1');
 for(const key of keys)assert.equal(await count(key),1);
 await page.locator('#risk-settings').click();
 assert.equal(await floodOpacity(),'1');
 await page.locator('#inarisk-opacity').fill('0');
 assert.deepEqual(await contextOpacity(),['1','1']);
 await page.locator('#inarisk-opacity').fill('100');
 assert.deepEqual(await contextOpacity(),['1','1']);
 // Settings tabs open a panel without changing raster visibility.
 await page.locator('.inarisk-panel [data-layer-panel="rainfall"]').click();
 await page.locator('#rainfall-opacity').fill('35');
 assert.deepEqual(await contextOpacity(),['1','1']);
 assert.equal(await floodOpacity(),'1');
 await page.locator('.rainfall-panel [data-layer-panel="slope"]').click();
 await page.locator('#slope-opacity').fill('45');
 await page.locator('.slope-panel [data-layer-panel="inarisk"]').click();
 await page.locator('#inarisk-opacity').fill('55');
 for(const [key,opacity] of [['rainfall','0.35'],['slope','0.45'],['inarisk','0.55']])assert.equal(await page.locator('.leaflet-'+pane[key]+'-pane>.leaflet-layer').evaluate(e=>e.style.opacity),opacity);
 // Buttons must turn off their own raster even while its panel is hidden.
 for(const key of ['rainfall','slope','inarisk']){await page.locator('#'+key+'-toggle').click();assert.equal(await count(key),0);assert.equal(await page.locator('#'+key+'-toggle').getAttribute('aria-pressed'),'false');for(const remaining of keys.slice(keys.indexOf(key)+1))assert.equal(await count(remaining),1);}
 assert.deepEqual(await contextOpacity(),['1','1']);
 for(const key of keys)await expectButtonColor(key,'rgb(36, 73, 110)');
 // Reverse activation order catches cross-layer side effects.
 for(const key of [...keys].reverse()){await page.locator('#'+key+'-toggle').click();await page.waitForFunction(id=>document.querySelector('#'+id+'-toggle')?.getAttribute('aria-pressed')==='true',key);}
 for(const key of keys)assert.equal(await count(key),1);
 await page.locator('#rainfall-close').click();
 for(const key of keys)assert.equal(await count(key),1);
 await page.locator('#zoom-in').click();await page.waitForTimeout(500);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:`/tmp/layer-stack-${width}.png`});
 await page.locator('#slope-toggle').click();
 const terrainFixture = await page.evaluate(() => {
   const canvas = document.createElement('canvas');
   canvas.width = canvas.height = 256;
   const context = canvas.getContext('2d');
   const pixels = context.createImageData(256, 256);
   for (let i = 0; i < pixels.data.length; i += 4) {
     pixels.data.set([128, (i / 4) % 256, 0, 255], i);
   }
   context.putImageData(pixels, 0, 0);
   return canvas.toDataURL().split(',')[1];
 });
 assert.deepEqual(errors,[]);
 await page.close();
 const fallbackPage = await browser.newPage({viewport:{width,height:950}});
 const fallbackErrors = [];
 fallbackPage.on('pageerror', error => fallbackErrors.push(error.message));
 await fallbackPage.route('https://**', r => r.abort());
 await fallbackPage.route('**/api/news', r => r.fulfill({json:{items:[],fetchedAt:new Date().toISOString()}}));
 await fallbackPage.route('**/api/slope?mode=config', r => r.fulfill({json:{available:true,state:'configured'}}));
 await fallbackPage.route('**/api/slope?mode=tile&*', r => r.fulfill({status:502,json:{error:'Earth Engine unavailable'}}));
 await fallbackPage.route('**/api/slope?mode=dem&*', r => r.fulfill({contentType:'image/png',body:Buffer.from(terrainFixture,'base64')}));
 await fallbackPage.goto(process.env.BASE_URL||'http://localhost:3002');
 await fallbackPage.locator('.leaflet-slopeOverlay-pane canvas[data-terrain="drawn"]').first().waitFor();
 await fallbackPage.getByText('Layer aktif · perkiraan dari elevasi cadangan').waitFor({state:'attached'});
 assert.match(await fallbackPage.locator('#slope-source').textContent(), /Mapzen/);
 await fallbackPage.waitForFunction(() => document.querySelector('#rainfall-toggle')?.getAttribute('aria-pressed') === 'true');
 assert.equal(await fallbackPage.locator('.leaflet-slopeOverlay-pane > .leaflet-layer').count(),1);
 await fallbackPage.locator('#slope-toggle').click();
 assert.equal(await fallbackPage.locator('.leaflet-slopeOverlay-pane > .leaflet-layer').count(),0);
 assert.deepEqual(fallbackErrors,[]);
 await fallbackPage.close();
 console.log('PASS independent on/off, stacked opacity, settings, zoom and slope fallback',width);
}}finally{await browser.close();}
