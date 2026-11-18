import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE1sAAAAASUVORK5CYII=','base64');
try {
 const page=await browser.newPage({viewport:{width:1440,height:950}});
 page.setDefaultTimeout(18000);
 let stallStreet=false;
 let stalledTiles=0;
 await page.route('https://**',route=>route.abort());
 await page.route('https://tile.openstreetmap.org/**',route=>{
  if(stallStreet){stalledTiles++;return;}
  return route.fulfill({contentType:'image/png',body:png});
 });
 await page.route('**/api/slope?mode=config',route=>route.fulfill({json:{available:false,state:'missing_variable'}}));
 await page.goto(process.env.BASE_URL||'http://localhost:3053');
 const map=page.locator('#map');
 await map.locator('.leaflet-streetMap-pane .leaflet-tile-loaded').first().waitFor({state:'attached'});
 const view=()=>map.evaluate(node=>({
  zoom:Number(node.dataset.viewZoom),
  center:node.dataset.viewCenter.split(',').map(Number)
 }));
 await page.waitForTimeout(500);
 const initial=await view();
 for(let step=0;step<20;step++){
  const {zoom}=await view();
  if(zoom>=12)break;
  await page.locator('#zoom-in').click();
  await page.waitForFunction(previous=>Number(document.querySelector('#map').dataset.viewZoom)>previous,zoom,{timeout:5000});
 }
 const closeView=await view();
 assert.ok(closeView.zoom>=12);
 const assertView=async label=>{
  const current=await view();
  assert.equal(current.zoom,closeView.zoom,label);
  assert.ok(current.center.every((value,index)=>Math.abs(value-closeView.center[index])<.003),label+' center');
 };
 await page.locator('#panel-toggle').click();
 await page.waitForTimeout(450);
 await assertView('Opening the directory');
 await page.locator('#panel-toggle').click();
 await page.waitForTimeout(450);
 await assertView('Closing the directory');
 await page.setViewportSize({width:390,height:850});
 await page.waitForTimeout(450);
 await assertView('Resizing to a mobile viewport');
 await page.setViewportSize({width:1440,height:950});
 await page.waitForTimeout(450);
 await assertView('Resizing back to desktop');
 stallStreet=true;
 for(let step=0;step<2;step++){
  const {zoom}=await view();
  await page.locator('#zoom-in').click();
  await page.waitForFunction(previous=>Number(document.querySelector('#map').dataset.viewZoom)>previous,zoom,{timeout:5000});
 }
 await page.locator('.map-frame:not(.is-street)').waitFor();
 assert.ok(stalledTiles>0);
 const fallbackView=await view();
 assert.ok(fallbackView.zoom>closeView.zoom,'Tile fallback keeps the new zoom');
 assert.ok(fallbackView.center.every((value,index)=>Math.abs(value-closeView.center[index])<.003),'Tile fallback keeps the center');
 await page.locator('#reset').click();
 await page.waitForFunction(zoom=>Number(document.querySelector('#map').dataset.viewZoom)<=zoom+.25, initial.zoom);
 console.log('PASS: close zoom survives directory panels, viewport changes and tile fallback; national reset still works.');
} finally {await browser.close();}
