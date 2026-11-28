import {getCache} from '@vercel/functions';
import chromium from '@sparticuz/chromium';
import {chromium as playwright} from 'playwright-core';
import {validSummary, webgisUrl} from '../lib/webgis-summary.js';

const refreshInterval = 15 * 60_000;
let latest, pending, retryAfter = 0;
const hosts = new Set([
 'inarisk.bnpb.go.id','inarisk1.bnpb.go.id','gis.bnpb.go.id','api.open-meteo.com','marine-api.open-meteo.com',
 'nowcasting.bmkg.go.id','www.bmkg.go.id','api.bmkg.go.id','datacuaca.bmkg.go.id','www.cpc.ncep.noaa.gov'
]);

async function readGeography(url) {
 for (let attempt=0;attempt<2;attempt++) {
  try {
   const res=await fetch(url,{signal:AbortSignal.timeout(8500),redirect:'error'});
   if (!res.ok) continue;
   const body=await res.text();
   const data=JSON.parse(body);
   if (data.regions?.length || (data.kabs?.length && data.d?.length)) return body;
  } catch { /* Retry transient source errors once within WebGIS's timeout. */ }
 }
 return null;
}

// WebGIS computes the office matrix in its public page, after multiple asynchronous feeds finish.
async function readSource() {
 chromium.setGraphicsMode = false;
 const executablePath = await chromium.executablePath();
 const browser = await playwright.launch({executablePath, args:['--no-sandbox','--no-zygote','--disable-webgl'],
  env:Object.fromEntries(['PATH','LD_LIBRARY_PATH','FONTCONFIG_PATH','LANG'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]))});
 try {
  const page = await browser.newPage({locale:'id-ID',timezoneId:'Asia/Jakarta',serviceWorkers:'block'});
  const geoFiles = new Map();
  await page.route('**/*', async route => {
   const request = route.request();
   const url = new URL(request.url());
   const allowed = url.protocol === 'https:' && hosts.has(url.hostname) && !['image','media','font'].includes(request.resourceType());
   if (!allowed) return route.abort();
   // The reference page also looks up offices while initializing its map.
   // Defer that lookup until its kab/kota table exists or it caches unmatched offices.
   if (url.href === webgisUrl+'data/kantor_bi.json') {
    try {await page.waitForSelector('.feed.ok[data-id="inarisk"]',{state:'attached',timeout:18_000});}
    catch {return route.abort();}
   }
   if (url.origin === new URL(webgisUrl).origin && /^\/webgis-bi\/data\/impact\/(index|\d+)\.json$/.test(url.pathname)) {
    // Several offices request the same index concurrently. Serve the same source bytes to each.
    if (!geoFiles.has(url.href)) geoFiles.set(url.href, readGeography(url.href));
    const body = await geoFiles.get(url.href);
    return body ? route.fulfill({status:200,contentType:'application/json',body}) : route.abort();
   }
   return route.continue();
  });
  await page.goto(webgisUrl,{waitUntil:'domcontentloaded',timeout:30_000});
  await page.waitForFunction(() => {
   const feed = id => document.querySelector('.feed[data-id="'+id+'"]');
   const required = ['inarisk','ce','fc','hist','marine','cap'];
   for (const id of required) {
    const el = feed(id);
    if (el?.classList.contains('err')) throw Error('Sumber WebGIS gagal: '+id);
   }
   if (!required.every(id => feed(id)?.classList.contains('ok'))) return false;
   if (required.some(id => /gagal/i.test(feed(id).textContent))) throw Error('Cakupan sumber WebGIS tidak lengkap');
   for (const id of ['fc','hist','marine']) {
    const coverage = feed(id).textContent.match(/(\d+)\/(\d+)/);
    if (!coverage || coverage[1] !== coverage[2]) throw Error('Cakupan prakiraan belum lengkap');
   }
   const capCount = feed('cap').textContent.match(/·\s*(\d+)/);
   if (!capCount) return false;
   if (Number(capCount[1]) && !feed('capgeo')?.classList.contains('ok')) return false;
   if (/gagal/i.test(feed('capgeo')?.textContent || '')) throw Error('Poligon CAP belum lengkap');
   return feed('oni') && !feed('oni').classList.contains('load') && document.querySelector('#biMatrix tbody tr')
    && [...document.querySelectorAll('#statusStrip strong')].length === 5
    && /^\d+$/.test(document.querySelector('#statusStrip strong').textContent.trim());
  },null,{timeout:110_000});
  const data = await page.evaluate(() => {
   const text = selector => document.querySelector(selector)?.textContent.trim() || '';
   const cards = [...document.querySelectorAll('#statusStrip .st')];
   const counts = Object.fromEntries(cards.map(card => [card.querySelector('small').textContent.toLowerCase()
    .replace(/(^| )\S/g, s => s.toUpperCase()), Number(card.querySelector('strong').textContent)]));
   const rows = [...document.querySelectorAll('#biMatrix tbody tr')].map(row => ({
    id:row.dataset.id, name:row.querySelector('td b').textContent.trim(), status:row.cells[1].textContent.trim(),
   }));
   const cells = [...document.querySelectorAll('#biMatrix tbody tr')];
   const high = cells.filter(row => [...row.querySelectorAll('.bi-cell')].some(cell => cell.textContent.trim()==='T')).length;
   if (high !== counts['Potensi Tinggi'] || ['Awas','Siaga','Waspada','Normal'].some(label => rows.filter(row=>row.status===label).length !== counts[label]))
    throw Error('Kartu WebGIS berbeda dengan matriks kantor');
   const order = [...document.querySelectorAll('#biHeroList button[data-id]')].map(button => button.dataset.id);
   const priority = rows.filter(row => ['Awas','Siaga','Waspada'].includes(row.status));
   const ranked = [...order.map(id => priority.find(row => row.id===id)), ...priority.filter(row => !order.includes(row.id))];
   return {
    asOf:new Date().toISOString(), total:rows.length, counts, offices:ranked.map(({name,status})=>({name,status})),
    context:text('#heroText'), climate:{
     oni:text('#ensoVal'), oniPeriod:text('#ensoPhase'), iod:text('#iodVal'), iodPeriod:text('#iodPhase'),
     guides:[...document.querySelectorAll('#oniSpark line')].map(line=>Number(line.getAttribute('y1'))),
     points:document.querySelector('#oniSpark polyline')?.getAttribute('points') || '',
     note:document.querySelector('#seasonNote')?.firstChild?.textContent.trim() || '',
     citation:text('#seasonNote a'), link:document.querySelector('#seasonNote a')?.href || '',
    },
    feeds:[...document.querySelectorAll('#feedStatus .feed')].map(el => ({text:el.textContent.trim(),state:el.classList.contains('ok')?'ok':el.classList.contains('err')?'error':'pending'})),
   };
  });
  if ([...await Promise.all(geoFiles.values())].some(body=>!body)) throw Error('Data administrasi WebGIS tidak lengkap');
  if (!validSummary(data)) throw Error('Kartu dan matriks kantor WebGIS belum selaras');
  return data;
 } finally { await browser.close(); }
}

export default async function handler(req,res) {
 if (req.method !== 'GET') return res.status(405).end();
 const cache=getCache({namespace:'webgis-bi'});
 if (!latest) {
  const saved=await cache.get('national').catch(()=>null);
  if (validSummary(saved)) latest=saved;
 }
 if ((!latest || Date.now()-Date.parse(latest.asOf)>=refreshInterval) && Date.now()>=retryAfter) {
  pending ??= readSource().then(async data => {
   latest=data;
   await cache.set('national',data,{ttl:7*86400}).catch(()=>{});
  }).catch(error => {
   console.warn('Ringkasan WebGIS BI:',error.message);
   retryAfter=Date.now()+120_000;
  }).finally(()=>{pending=null;});
  await pending;
 }
 const stale = !latest || Date.now()-Date.parse(latest.asOf)>=refreshInterval;
 res.setHeader('Cache-Control',stale?'public, max-age=0, s-maxage=120':'public, max-age=0, s-maxage=900, stale-while-revalidate=300, stale-if-error=86400');
 return latest ? res.status(200).json({data:latest,stale}) : res.status(503).json({error:'Ringkasan WebGIS BI belum termuat lengkap.'});
}
