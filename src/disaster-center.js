import L from 'leaflet';
import './disaster-center.css';

const bnpb = 'https://inarisk.bnpb.go.id/webgis-bi/';
const labels = {Extreme:'Ekstrem',Severe:'Berat',Moderate:'Sedang',Minor:'Ringan'};
const colors = {Extreme:'#ff5372',Severe:'#ff935a',Moderate:'#ffd263',Minor:'#73d4bd'};
const time = new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'});
const wib = value => time.format(value)+' WIB';

function inPolygon([lat,lng], polygon) {
 let inside = false;
 for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
  const [y,x]=polygon[i], [py,px]=polygon[j];
  if ((y>lat)!==(py>lat) && lng<(px-x)*(lat-y)/(py-y)+x) inside=!inside;
 }
 return inside;
}
function node(tag,text) {
 const result=document.createElement(tag);
 result.textContent=text;
 return result;
}

export function mountDisasterCenter({map,offices,trigger}) {
 const dialog=document.createElement('dialog');
 dialog.className='disaster-center';
 dialog.id='disaster-center';
 dialog.setAttribute('aria-labelledby','disaster-title');
 dialog.innerHTML=`
  <header><h2 id="disaster-title">Pusat Pantauan Bencana</h2><button type="button" data-close aria-label="Tutup pusat pantauan">×</button></header>
  <nav aria-label="Modul pantauan">
    <button type="button" data-tab="alerts" aria-pressed="true">Peringatan BMKG</button>
    <button type="button" data-tab="simulation" aria-pressed="false">Simulasi Banjir</button>
    <button type="button" data-tab="activity" aria-pressed="false">Kegiatan PRB</button>
  </nav>
  <section data-view="alerts">
    <p data-status role="status">Memuat peringatan resmi BMKG…</p>
    <div class="disaster-actions">
      <label><input type="checkbox" data-offices> Hanya wilayah yang mencakup titik kantor</label>
      <button type="button" data-refresh>Perbarui</button>
      <button type="button" data-clear>Tutup overlay BMKG</button>
    </div>
    <div data-results></div>
  </section>
  <section data-view="simulation" hidden>
    <h3>Simulasi banjir per DAS</h3>
    <p>Modul BNPB menyediakan skenario debit, tinggi muka air, hasil HEC-RAS 2D, dan potensi genangan dari hujan Himawari. Hasil mengikuti parameter dan cakupan model yang dipilih.</p>
    <a href="${bnpb}simulasi/index.html#banjir" target="_blank" rel="noopener noreferrer">Buka simulasi BNPB ↗</a>
  </section>
  <section data-view="activity" hidden>
    <h3>Pemantauan kegiatan pengurangan risiko bencana</h3>
    <p>Telusuri kegiatan, survei kesiapsiagaan dan kerentanan, serta laporan kerusakan menurut wilayah di modul BNPB.</p>
    <a href="${bnpb}simulasi/index.html#kegiatan" target="_blank" rel="noopener noreferrer">Buka kegiatan PRB BNPB ↗</a>
  </section>
  <footer><a href="${bnpb}" target="_blank" rel="noopener noreferrer">WebGIS BI BNPB ↗</a></footer>`;
 document.querySelector('#app').append(dialog);
 const notice=document.createElement('aside');
 notice.className='disaster-notice';
 notice.hidden=true;
 notice.innerHTML='<p role="status"></p><button type="button" data-open>Lihat peringatan</button><button type="button" data-dismiss aria-label="Tutup notifikasi">×</button>';
 document.querySelector('#app').append(notice);
 const status=dialog.querySelector('[data-status]');
 const results=dialog.querySelector('[data-results]');
 const officeFilter=dialog.querySelector('[data-offices]');
 const count=trigger.querySelector('[data-count]');
 const layer=L.layerGroup().addTo(map);
 const pane=map.createPane('bmkgAlerts');
 pane.style.zIndex='505';
 pane.style.pointerEvents='none';
 let snapshot, selected, busy=false, failed=false;
 const seen=new Set();

 function open() { notice.hidden=true; if(!dialog.open)dialog.showModal(); }
 function render() {
  const now=Date.now();
  const active=(snapshot?.items||[]).filter(item=>item.start<=now&&now<item.end);
  count.textContent=active.length||'';
  count.hidden=!active.length;
  trigger.setAttribute('aria-label',active.length?`Pusat pantauan, ${active.length} peringatan BMKG aktif`:'Pusat pantauan bencana');
  if (selected && !active.some(item=>item.id===selected)) {selected=null;layer.clearLayers();}
  if (snapshot) {
   status.textContent=`${active.length} aktif · ${snapshot.items.filter(item=>item.start>now).length} akan berlaku · diperiksa ${wib(new Date(snapshot.checkedAt))}`
    +(snapshot.incomplete?' · Sebagian dokumen belum termuat.':'')
    +(failed?' · Pembaruan gagal, menampilkan hasil pemeriksaan terakhir.':'');
  } else status.textContent=failed?'Sumber BMKG belum dapat dihubungi.':'Memuat peringatan resmi BMKG…';
  const fresh=active.filter(item=>item.rank>=3&&!seen.has(item.id));
  for (const item of fresh) seen.add(item.id);
  if (!dialog.open && fresh.length) {
   notice.querySelector('p').textContent=`${fresh.length} peringatan cuaca berat atau ekstrem dari BMKG sedang berlaku.`;
   notice.hidden=false;
  }
  if (!active.some(item=>item.rank>=3)) notice.hidden=true;
  results.replaceChildren();
  for (const item of (snapshot?.items||[]).filter(item=>now<item.end)) {
   const matches=offices.filter(office=>item.polygons.some(polygon=>inPolygon(office.coords,polygon)));
   if (officeFilter.checked && !matches.length) continue;
   const card=node('article','');
   card.style.setProperty('--alert-color',colors[item.level]||'#a9bdcd');
   card.append(node('strong',(labels[item.level]||'Tingkat belum tersedia')+' · '+(item.start<=now?'Aktif':'Akan berlaku')),
    node('h3',item.title),node('p',[item.region,wib(item.start)+' – '+wib(item.end)].filter(Boolean).join(' · ')));
   if (matches.length) card.append(node('p','Titik kantor dalam area CAP · '+matches.map(office=>office.name).join(', ')));
   const details=node('details','');
   details.append(node('summary','Rincian BMKG'),node('p',item.description));
   if(item.instruction)details.append(node('p',item.instruction));
   const source=node('a','Dokumen resmi BMKG ↗');
   source.href=item.link;source.target='_blank';source.rel='noopener noreferrer';
   details.append(source);card.append(details);
   if(item.polygons.length && item.start<=now){
    const show=node('button','Tampilkan wilayah di peta');
    show.onclick=()=>{
     selected=item.id;
     layer.clearLayers();
     const shape=L.polygon(item.polygons.map(ring=>[ring]),{pane:'bmkgAlerts',color:colors[item.level]||'#e9eef2',fillOpacity:.20,weight:2,interactive:false}).addTo(layer);
     dialog.close();
     if(document.querySelector('#peta').classList.contains('hidden'))location.hash='peta';
     // Apply the bounds after any workspace switch has reset the map.
     requestAnimationFrame(()=>requestAnimationFrame(()=>map.fitBounds(shape.getBounds(),{padding:[45,45],maxZoom:11,animate:false})));
    };
    card.append(show);
   }
   results.append(card);
  }
  if(snapshot&&!results.childElementCount) results.append(node('p','Belum ada peringatan sesuai filter.'));
 }

 async function refresh() {
  if(busy)return;
  busy=true;
  const button=dialog.querySelector('[data-refresh]');
  button.disabled=true;
  try {
   const response=await fetch('/api/bmkg-alerts',{signal:AbortSignal.timeout(27000)});
   if(!response.ok)throw Error();
   snapshot=await response.json();
   failed=false;
  } catch {failed=true;}
  finally {busy=false;button.disabled=false;render();}
 }

 trigger.onclick=open;
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.querySelector('[data-refresh]').onclick=refresh;
 dialog.querySelector('[data-clear]').onclick=()=>{selected=null;layer.clearLayers();};
 notice.querySelector('[data-open]').onclick=open;
 notice.querySelector('[data-dismiss]').onclick=()=>{notice.hidden=true;};
 officeFilter.onchange=render;
 for (const tab of dialog.querySelectorAll('[data-tab]')) tab.onclick=()=>{
  for (const button of dialog.querySelectorAll('[data-tab]')) button.setAttribute('aria-pressed',String(button===tab));
  for (const section of dialog.querySelectorAll('[data-view]')) section.hidden=section.dataset.view!==tab.dataset.tab;
 };
 const interval=120000;
 refresh();
 setInterval(()=>{if(!document.hidden)refresh();},interval);
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden){render();if(!snapshot||Date.now()-Date.parse(snapshot.checkedAt)>interval)refresh();}
 });
}
