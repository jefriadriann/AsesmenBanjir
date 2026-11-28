import L from 'leaflet';
import './slope.css';
import {createTerrainSlope} from './slope-terrain.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountSlope({map,bounds,refreshIcons,onOpen}){
 const button=document.createElement('button');button.id='slope-toggle';button.setAttribute('aria-label','Kemiringan lahan');button.title='Kemiringan lahan';button.setAttribute('aria-pressed','false');button.innerHTML='<i data-lucide="mountain"></i><span>Kemiringan lahan</span>';document.querySelector('#assessment-layer-buttons').insertBefore(button, document.querySelector('#rainfall-toggle'));
 const panel=document.createElement('section');panel.className='slope-panel hidden';panel.setAttribute('aria-label','Legenda kemiringan lahan');panel.innerHTML='<div class="slope-head"><h2>Kemiringan lahan</h2><button id="slope-close" aria-label="Tutup legenda kemiringan"><i data-lucide="x"></i></button></div><div id="slope-status" role="status">Menyiapkan layer…</div><div id="slope-legend"></div><label class="slope-opacity">Opasitas<span id="slope-opacity-value">100%</span><input id="slope-opacity" aria-label="Opasitas kemiringan lahan" type="range" min="0" max="100" value="100"></label><div id="slope-source"></div><button id="slope-retry" class="slope-retry hidden">Coba hubungkan lagi</button>';document.querySelector('.map-frame').append(panel);
 map.createPane('slopeOverlay');map.getPane('slopeOverlay').style.zIndex=480;map.getPane('slopeOverlay').style.pointerEvents='none';let layer=null,desired=false,generation=0,source=null;
 const status=panel.querySelector('#slope-status');const write=(message,error=false)=>{status.textContent=message;status.classList.toggle('error',error);panel.querySelector('#slope-retry').classList.toggle('hidden',!error);};
 const legend=panel.querySelector('#slope-legend');
 const sourcePanel=panel.querySelector('#slope-source');
 const opacity=()=>Number(panel.querySelector('#slope-opacity').value)/100;
 const active=value=>{
  button.classList.toggle('active',value);
  button.setAttribute('aria-pressed',String(value));
 };
 const sourceReady=fetch('/slope-source.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(s=>{
  source=s;
  legend.innerHTML=s.legend.map(item=>`<div><b style="background:${escape(item.color)}"></b><span>${escape(item.label)}</span></div>`).join('');
 }).catch(()=>write('Keterangan sumber belum dapat dimuat.',true));

 function showSource(fallback){
  sourcePanel.innerHTML=fallback
   ? '<span>Elevasi Mapzen / AWS Terrain Tiles</span><p>Perkiraan lereng dari tile elevasi publik. Ketelitian bergantung pada tingkat zoom dan sumber elevasi.</p><a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer">Sumber Terrain Tiles ↗</a>'
   : `<span>${escape(source.sourceName)} · ${escape(source.resolution)}</span><p>${escape(source.sensor)}</p><div><a href="${escape(source.catalogUrl)}" target="_blank" rel="noopener noreferrer">Sumber NASADEM ↗</a><a href="${escape(source.scriptUrl)}" target="_blank" rel="noopener noreferrer">Script Earth Engine ↗</a></div><details><summary>Metode</summary><p>${escape(source.method)}</p></details>`;
 }
 function disable(){desired=false;generation++;layer?.remove();layer=null;active(false);panel.classList.add('hidden');}

 function attach(candidate, token, fallback) {
  if (token!==generation) return;
  layer?.remove(); layer=candidate;
  let failed=false,hasImage=false;
  showSource(fallback);
  active(false);
  write(fallback?'Memuat elevasi cadangan…':'Memuat warna kemiringan…');
  candidate.on('loading',()=>{failed=false;hasImage=false;});
  candidate.on('tileerror',()=>{failed=true;});
  candidate.on('tileload',({tile})=>{
   if(token!==generation||layer!==candidate) return;
   if(fallback ? tile.dataset.terrain!=='drawn' : tile.src.startsWith('data:')) return;
   hasImage=true; active(true);
  });
  candidate.on('load',()=>{
   if(token!==generation||layer!==candidate) return;
   if(failed&&!hasImage&&!fallback){
    queueMicrotask(()=>{if(token===generation&&layer===candidate) startFallback(token);});
   }else if(failed){
    active(hasImage);
    write(hasImage?'Sebagian tile kemiringan gagal dimuat.':'Sumber elevasi cadangan gagal dimuat.',true);
   }else{
    write(fallback?'Layer aktif · perkiraan dari elevasi cadangan':'Layer aktif · kemiringan dalam persen');
   }
  });
  candidate.addTo(map);
 }

 async function startFallback(token){
  if(token!==generation) return;
  layer?.remove(); layer=null; active(false); showSource(true); write('Menghubungkan sumber elevasi cadangan…');
  try{
   const response=await fetch('/rainfall/boundary.geojson',{signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error();
   const boundary=await response.json();
   if(token!==generation)return;
   attach(createTerrainSlope({boundary,legend:source.legend,bounds,opacity:opacity()}),token,true);
  }catch{
   if(token===generation)write('Sumber elevasi cadangan belum dapat dimuat.',true);
  }
 }

 async function enable(openPanel=true){
  const token=++generation;desired=true;
  if(openPanel){panel.classList.remove('hidden');onOpen?.();}
  write('Menghubungkan layer…');await sourceReady;
  if(token!==generation||!source)return;
  try{
   const response=await fetch('/api/slope?mode=config',{signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error();
   const config=await response.json();
   if(token!==generation)return;
   if(!config.available){await startFallback(token);return;}
   const candidate=L.tileLayer('/api/slope?mode=tile&z={z}&x={x}&y={y}',{pane:'slopeOverlay',bounds,noWrap:true,maxZoom:19,keepBuffer:2,updateWhenIdle:true,updateWhenZooming:false,opacity:opacity(),attribution:'NASADEM NASA/USGS · Google Earth Engine'});
   attach(candidate,token,false);
  }catch{await startFallback(token);}
 }

 button.onclick=()=>{if(desired)disable();else enable();};panel.querySelector('#slope-close').onclick=()=>panel.classList.add('hidden');panel.querySelector('#slope-retry').onclick=()=>enable();panel.querySelector('#slope-opacity').oninput=e=>{panel.querySelector('#slope-opacity-value').textContent=e.target.value+'%';layer?.setOpacity(Number(e.target.value)/100);};
 refreshIcons();return {disable,closePanel(){panel.classList.add('hidden');}};
}
