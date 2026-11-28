import reference from './webgis-reference.json';
import {levels, validSummary, webgisUrl} from '../lib/webgis-summary.js';

const accents = ['#ef4444','#f97316','#facc15','#22c55e','#eebc36'];
const wib = new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'});
const storageKey = 'sekar.webgis-bi.nasional.v1';
const period = 15*60_000;

function element(tag, text) {
 const el = document.createElement(tag);
 el.textContent = text;
 return el;
}

export function mountWebgisSummary(summary, offices) {
 summary.innerHTML = `
  <div class="bi-summary-grid">
   <section class="bi-summary-hero">
    <span class="bi-eyebrow">Status peringatan dini · Kantor BI · Indonesia</span>
    <p data-asof role="status"></p>
    <h2 data-headline></h2><p data-context></p>
    <div class="bi-counts" aria-label="Jumlah kantor BI menurut status dan potensi"></div>
    <div class="bi-attention"><h3></h3><div data-office-list></div></div>
   </section>
   <aside class="bi-summary-side">
    <section class="bi-climate"><h3 class="bi-eyebrow">Pengendali iklim global</h3>
     <div class="bi-indices"><div><small>ENSO (ONI)</small><strong data-oni></strong><span data-oni-period></span></div>
     <div><small>IOD</small><strong data-iod></strong><span data-iod-period></span></div></div>
     <svg class="bi-trend" viewBox="0 0 240 46" preserveAspectRatio="none" role="img" aria-label="Tren indeks ONI NOAA"><polyline fill="none" stroke="#fbbf24" stroke-width="2"/></svg>
     <p data-season></p>
    </section>
    <div class="bi-feeds" aria-label="Sumber data pada waktu ringkasan"></div>
   </aside>
  </div>
  <footer class="bi-summary-footer">
   <nav aria-label="Sumber dan modul pemantauan">
    <a href="${webgisUrl}#ringkasan" target="_blank" rel="noopener noreferrer">WebGIS BI BNPB ↗</a>
    <button type="button" data-view-alerts>Peringatan BMKG</button>
    <a href="${webgisUrl}simulasi/index.html#banjir" target="_blank" rel="noopener noreferrer">Simulasi banjir ↗</a>
    <a href="${webgisUrl}simulasi/index.html#kegiatan" target="_blank" rel="noopener noreferrer">Kegiatan PRB ↗</a>
   </nav>
  </footer>`;
 let current = reference, checked = 0, busy = false, state = 'saved';
 try {
  const cached = JSON.parse(localStorage.getItem(storageKey));
  if (validSummary(cached) && Date.parse(cached.asOf)>Date.parse(current.asOf)) current=cached;
 } catch { /* Storage is optional. */ }
 const local = new Map(offices.map(office=>[office.name.replace(/^KPw /,'').toLowerCase(),office.id]));
 const find = selector => summary.querySelector(selector);
 function showTime() {
  const stamp = wib.format(new Date(current.asOf))+' WIB';
  const status = {loading:' · Memeriksa pembaruan…',failed:' · Pembaruan belum tersedia',saved:' · Arsip',fresh:''}[state];
  const missing = current.total-levels.slice(0,4).reduce((n,label)=>n+current.counts[label],0);
  find('[data-asof]').textContent = 'Data WebGIS BI · '+stamp+status+(missing?' · '+missing+' kantor tanpa status':'');
 }
 function draw() {
  const {counts,climate} = current;
  const top = levels.slice(0,4).find(label=>counts[label]>0);
  const headline = find('[data-headline]');
  headline.replaceChildren();
  if (top) {
   const emphasis = element('em',top.toUpperCase());
   find('.bi-summary-hero').style.setProperty('--status-color',accents[levels.indexOf(top)]);
   headline.append('Status tertinggi ',emphasis,' · '+(counts.Siaga+counts.Awas)+' dari '+current.total+' Kantor BI Siaga–Awas, '+counts.Waspada+' Waspada');
  } else headline.textContent = 'Status peringatan dini kantor belum tersedia';
  find('[data-context]').textContent=current.context;
  const cards = find('.bi-counts');
  cards.replaceChildren();
  for (const [i,label] of levels.entries()) {
   const card = element('div','');
   card.style.setProperty('--level',accents[i]);
   card.append(element('small',label),element('strong',String(counts[label])),element('span',i===4?'Kantor BI (kab/kota InaRISK)':'Kantor BI'));
   cards.append(card);
  }
  find('.bi-attention h3').textContent='Kantor BI perlu perhatian ('+current.offices.length+')';
  const list=find('[data-office-list]');
  list.replaceChildren();
  for (const {name,status} of current.offices) {
   const id = local.get(name.toLowerCase());
   const chip=element(id?'a':'span','');
   if (id) chip.href='#peta/'+encodeURIComponent(id);
   chip.style.setProperty('--level',accents[levels.indexOf(status)]);
   chip.append(element('i','BI'),name,element('b',status));
   list.append(chip);
  }
  for (const key of ['oni','iod']) {
   find('[data-'+key+']').textContent=climate[key];
   find('[data-'+key+'-period]').textContent=climate[key+'Period'];
  }
  const points=climate.points||'';
  find('.bi-trend').style.display=points?'':'none';
  find('.bi-trend polyline').setAttribute('points',points);
  const season = find('[data-season]');
  season.replaceChildren(climate.note||'');
  if (/^https:\/\//.test(climate.link||'')) {
   const link=element('a',climate.citation);
   link.href=climate.link; link.target='_blank'; link.rel='noopener noreferrer';
   season.append(' ',link);
  }
  const feeds=find('.bi-feeds');
  feeds.replaceChildren();
  for (const feed of current.feeds) {
   const badge=element('span',feed.text);
   badge.dataset.state=feed.state; badge.title=feed.text;
   feeds.append(badge);
  }
  showTime();
 }
 async function refresh() {
  if (document.hidden || location.hash!=='#ringkasan' || busy || Date.now()-checked<period) return;
  busy=true; state='loading'; showTime();
  try {
   const res=await fetch('/api/webgis-summary',{signal:AbortSignal.timeout(170_000)});
   if (!res.ok) throw Error();
   const {data,stale}=await res.json();
   if (!validSummary(data) || Date.parse(data.asOf)<Date.parse(current.asOf)) throw Error();
   current=data;
   state=stale || Date.now()-Date.parse(data.asOf)>period*2?'failed':'fresh';
   try {localStorage.setItem(storageKey,JSON.stringify(data));} catch { /* Render even if storage is full. */ }
   draw();
  } catch {state='failed';}
  finally {checked=Date.now()-(state==='failed'?period-120_000:0); busy=false; showTime();}
 }
 draw();
 window.addEventListener('hashchange',refresh);
 document.addEventListener('visibilitychange',refresh);
 window.setInterval(refresh,60_000);
 refresh();
}
