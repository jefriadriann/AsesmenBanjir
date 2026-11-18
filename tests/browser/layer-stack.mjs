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
 const count=key=>page.locator('.leaflet-'+pane[key]+'-pane>.leaflet-layer').count();
 for(const key of ['rainfall','slope']){
   await page.waitForFunction(id=>document.querySelector('#'+id+'-toggle')?.getAttribute('aria-pressed')==='true',key);
   assert.equal(await count(key),1);
   assert.equal(await page.locator('.'+key+'-panel').isHidden(),true);
 }
 assert.equal(await count('inarisk'),0);
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
 if (width > 1000) assert.ok(Math.abs((news.y + news.height / 2) - (slope.y + slope.height / 2)) <= 2);
 assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
 await page.locator('#layer-settings').click();
 await page.locator('#rainfall-opacity').waitFor();
 assert.match(await page.locator('.rainfall-panel').innerText(), /inframerah satelit geostasioner/);
 await page.locator('.rainfall-panel [data-layer-panel="slope"]').click();
 assert.match(await page.locator('#slope-source').innerText(), /Radar pita C SRTM.*Endeavour/);
 await page.locator('#inarisk-toggle').click();
 await page.waitForFunction(()=>document.querySelector('#inarisk-toggle')?.getAttribute('aria-pressed')==='true');
 assert.deepEqual(await contextOpacity(),['0.1','0.1']);
 assert.equal(await page.locator('#inarisk-opacity').inputValue(),'100');
 await page.locator('#inarisk-close').click();
 assert.deepEqual(await contextOpacity(),['0.1','0.1']);
 await page.locator('#layer-settings').click();
 await page.locator('.rainfall-panel [data-layer-panel="inarisk"]').click();
 await page.locator('#inarisk-opacity').fill('0');
 assert.deepEqual(await contextOpacity(),['1','1']);
 await page.locator('#inarisk-opacity').fill('100');
 assert.deepEqual(await contextOpacity(),['0.1','0.1']);
 // Settings tabs open a panel without changing raster visibility.
 await page.locator('.inarisk-panel [data-layer-panel="rainfall"]').click();
 await page.locator('#rainfall-opacity').fill('35');
 await page.locator('.rainfall-panel [data-layer-panel="slope"]').click();
 await page.locator('#slope-opacity').fill('45');
 await page.locator('.slope-panel [data-layer-panel="inarisk"]').click();
 await page.locator('#inarisk-opacity').fill('55');
 for(const [key,opacity] of [['rainfall','0.35'],['slope','0.45'],['inarisk','0.55']])assert.equal(await page.locator('.leaflet-'+pane[key]+'-pane>.leaflet-layer').evaluate(e=>e.style.opacity),opacity);
 // Buttons must turn off their own raster even while its panel is hidden.
 for(const key of ['rainfall','slope','inarisk']){await page.locator('#'+key+'-toggle').click();assert.equal(await count(key),0);assert.equal(await page.locator('#'+key+'-toggle').getAttribute('aria-pressed'),'false');for(const remaining of keys.slice(keys.indexOf(key)+1))assert.equal(await count(remaining),1);}
 assert.deepEqual(await contextOpacity(),['1','1']);
 // Reverse activation order catches cross-layer side effects.
 for(const key of [...keys].reverse()){await page.locator('#'+key+'-toggle').click();await page.waitForFunction(id=>document.querySelector('#'+id+'-toggle')?.getAttribute('aria-pressed')==='true',key);}
 for(const key of keys)assert.equal(await count(key),1);
 await page.locator('#rainfall-close').click();
 for(const key of keys)assert.equal(await count(key),1);
 await page.locator('#zoom-in').click();await page.waitForTimeout(500);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:`/tmp/layer-stack-${width}.png`});
 await page.locator('#slope-toggle').click();
 await page.route('**/api/slope?mode=config',r=>r.fulfill({json:{available:false,state:'missing_variable'}}));
 await page.locator('#slope-toggle').click();
 await page.waitForSelector('#slope-status.error');
 assert.equal(await count('slope'),0);assert.equal(await count('rainfall'),1);assert.equal(await count('inarisk'),1);
 await page.locator('#slope-toggle').click();assert.ok(await page.locator('.slope-panel').isHidden());
 assert.deepEqual(errors,[]);
 await page.close();console.log('PASS independent on/off, both activation orders, stacked opacity, settings and zoom',width);
}}finally{await browser.close();}
