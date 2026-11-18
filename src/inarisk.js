import L from 'leaflet';
import './inarisk.css';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CACHE_KEY='ruang-inarisk-last-good-v2',CACHE_AGE=24*60*60*1000;
export function tileBbox({x,y,z}){const world=40075016.68557849,span=world/2**z;return [x*span-world/2,world/2-(y+1)*span,(x+1)*span-world/2,world/2-y*span].join(',');}
export function mountInarisk({map,bounds,refreshIcons,onAbout,onOpen}){
 const frame=document.querySelector('.map-frame');let overlay=null,activeService=null,services=[],requestId=0,pending=null,controller=null,busy=false,cache={services:[],metadata:{}};
 try{const stored=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(stored&&Date.now()-stored.savedAt<CACHE_AGE&&Array.isArray(stored.services)&&stored.metadata&&typeof stored.metadata==='object')cache=stored;}catch{}
 const remember=()=>{try{localStorage.setItem(CACHE_KEY,JSON.stringify({...cache,savedAt:Date.now()}));}catch{}};
 // Keep the flood classes visible above rain and slope, below office lines and markers.
 const floodPane=map.createPane('floodOverlay');
 floodPane.style.zIndex='490';
 floodPane.style.pointerEvents='none';
 const button=document.createElement('button');button.id='inarisk-toggle';button.setAttribute('aria-label','Layer banjir');button.innerHTML='<i data-lucide="layers"></i><span>Layer banjir</span>';button.setAttribute('aria-expanded','false');button.setAttribute('aria-pressed','false');document.querySelector('#risk-layer-buttons').append(button);
 const panel=document.createElement('section');panel.className='inarisk-panel hidden';panel.setAttribute('aria-label','Layer banjir BNPB InaRISK');panel.innerHTML=`<div class="inarisk-head"><span>BNPB / INARISK</span><button id="inarisk-close" aria-label="Tutup panel InaRISK"><i data-lucide="x"></i></button></div><h2>Layer banjir</h2><div id="inarisk-status" role="status">Layer mati. Klik Layer banjir untuk mengaktifkan.</div><details id="inarisk-connection" class="hidden"><summary>Detail koneksi</summary><p id="inarisk-connection-error"></p><a href="/api/inarisk?mode=catalog" target="_blank" rel="noopener noreferrer">Periksa respons katalog ↗</a></details><div id="inarisk-controls" class="hidden"><label class="inarisk-service-label">Kajian InaRISK<select id="inarisk-service"></select></label><label class="inarisk-check"><input type="checkbox" id="inarisk-visible">Tampilkan layer banjir</label><label class="inarisk-opacity-label">Opasitas warna<span id="inarisk-opacity-value">100%</span><input type="range" id="inarisk-opacity" min="0" max="100" value="100" aria-label="Opasitas layer banjir"></label><div id="inarisk-legend"></div><div id="inarisk-summary"></div><div id="inarisk-metadata"></div></div><button id="inarisk-retry">Perbarui layer</button><a href="https://inarisk.bnpb.go.id/" target="_blank" rel="noopener noreferrer" class="inarisk-source-link">Buka InaRISK BNPB <i data-lucide="arrow-up-right"></i></a><button class="inarisk-about" id="inarisk-about">Tentang sumber</button>`;frame.append(panel);
 const status=panel.querySelector('#inarisk-status'),retry=panel.querySelector('#inarisk-retry'),select=panel.querySelector('#inarisk-service'),visible=panel.querySelector('#inarisk-visible'),opacity=panel.querySelector('#inarisk-opacity'),controls=panel.querySelector('#inarisk-controls');
 const connection=panel.querySelector('#inarisk-connection'),connectionError=panel.querySelector('#inarisk-connection-error');
 const setStatus=(text,error=false)=>{if(!error)connection.classList.add('hidden');status.textContent=text;status.classList.toggle('error',error);button.classList.toggle('source-error',error);};
 const setBusy=value=>{busy=value;retry.disabled=value;retry.textContent=value?'Memperbarui…':'Perbarui layer';panel.setAttribute('aria-busy',String(value));};
 const validService=s=>s&&typeof s.name==='string'&&typeof s.service==='string'&&/^[\w /-]+\/(MapServer|ImageServer)$/.test(s.service)&&/banjir|flood|layer_peta_kapasitas/i.test(s.service)&&!s.service.includes('..');
 function cancelPending(){if(pending){clearTimeout(pending.timer);pending.layer.remove();pending.layer.off();pending=null;}}
 function begin(){requestId++;controller?.abort();controller=new AbortController();cancelPending();setBusy(true);return requestId;}
 function finish(token){if(token===requestId)setBusy(false);}
 function failure(token,message,error){if(token!==requestId)return;cancelPending();if(activeService)select.value=activeService.service;setStatus(overlay?'Pembaruan gagal. Layer sebelumnya tetap tersedia.':message,true);connection.classList.remove('hidden');connectionError.textContent=error?.message||message;finish(token);}
 panel.querySelector('#inarisk-about').onclick=()=>onAbout?.();
 const setActive=value=>{
  button.classList.toggle('active',value);
  button.setAttribute('aria-pressed',String(value));
 };
 button.onclick=()=>{if(visible.checked){visible.checked=false;visible.onchange({target:visible});panel.classList.add('hidden');button.setAttribute('aria-expanded','false');}else{panel.classList.remove('hidden');button.setAttribute('aria-expanded','true');onOpen?.();visible.checked=true;visible.onchange({target:visible});}};panel.querySelector('#inarisk-close').onclick=()=>{panel.classList.add('hidden');button.setAttribute('aria-expanded','false');};
 async function api(mode,service,refresh=false){
  const query=new URLSearchParams({mode,...(service?{service}:{}),...(refresh?{refresh:'1'}:{})});
  const step=mode==='catalog'?'Katalog layanan InaRISK':'Metadata dan legenda InaRISK';
  let response;try{response=await fetch('/api/inarisk?'+query,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)]),cache:refresh?'no-store':'default'});}catch(error){throw Error(step+': '+(error.name==='TimeoutError'?'waktu tunggu habis.':error.name==='AbortError'?'permintaan dibatalkan.':'API website tidak dapat dijangkau.'));}
  let body;try{body=await response.json();}catch{throw Error(step+' (HTTP '+response.status+'): API website tidak mengembalikan JSON. Periksa deployment fungsi /api/inarisk.');}
  if(!response.ok||body.error)throw Error(step+' (HTTP '+response.status+'): '+(body.error||'Sumber belum tersedia.'));
  return body;
 }
 const number = new Intl.NumberFormat('id-ID', {maximumFractionDigits:1});
 const currency = new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0});
 const classLabels = {tinggi:'Tinggi',sedang:'Sedang',rendah:'Rendah'};
 const classColors = {tinggi:'#d7191c',sedang:'#ffff00',rendah:'#1a9641'};
 const studyNotes = {
  bahaya:'Indeks bahaya banjir dari kajian BNPB. Warna menunjukkan kelas bahaya dalam kajian BNPB.',
  risiko:'Kelas risiko menggambarkan potensi dampak banjir berdasarkan kajian BNPB.',
  kerentanan:'Kelas kerentanan menggambarkan seberapa rentan wilayah terhadap dampak banjir.',
  kapasitas:'Kelas kapasitas menggambarkan kemampuan daerah menghadapi bencana. Hijau menunjukkan kapasitas tinggi.'
 };
 function drawSummary(result) {
  const {study,summary} = result;
  const target = panel.querySelector('#inarisk-summary');
  if (!studyNotes[study]) {target.innerHTML = '';return;}
  if (!summary) {target.innerHTML = '<p>Ringkasan nasional InaRISK belum tersedia.</p>';return;}
  const capacity = study === 'kapasitas';
  const total = summary.classes.reduce((sum,row)=>sum+row.value,0);
  const hasLoss = summary.classes.every(row=>Number.isFinite(row.loss));
  const loss = summary.classes.reduce((sum,row)=>sum+(row.loss ?? 0),0);
  target.innerHTML = `<h3>Ringkasan nasional</h3>
   <p><strong>${number.format(summary.count)}</strong> ${capacity?'kabupaten/kota':'kecamatan terpapar'}</p>
   <table aria-label="Distribusi kelas nasional"><tbody>${summary.classes.map(row=>`<tr>
    <th scope="row">${classLabels[row.key]}</th>
    <td>${number.format(row.value)}${capacity?'':' ha'}</td>
    <td>${total?number.format(100*row.value/total)+'%':'–'}</td>
   </tr>`).join('')}</tbody></table>
   ${hasLoss?`<p>Estimasi kerugian fisik dan ekonomi <strong>${currency.format(loss)}</strong></p>`:''}
   <p>Cakupan Indonesia · <a href="${escape(summary.sourceUrl)}" target="_blank" rel="noopener noreferrer">Data ringkasan BNPB ↗</a></p>`;
 }
 function drawMetadata(service,result){const legend=result.legend?.layers||[];panel.querySelector('#inarisk-legend').innerHTML=legend.length?'<h3>Legenda dari sumber</h3>'+legend.map(layer=>`<div class="inarisk-legend-layer"><strong>${escape(layer.layerName||'')}</strong>${(layer.legend||[]).map(item=>`<span>${item.imageData&&/^image\/(png|jpeg|gif)$/.test(item.contentType||'image/png')?`<img alt="" src="data:${item.contentType||'image/png'};base64,${escape(item.imageData)}">`:''}${escape(item.label||'Tanpa label')}</span>`).join('')}</div>`).join(''):'<p class="legend-missing">Legenda sumber belum tersedia.</p>';
  if (studyNotes[result.study]) {
   const keys = Object.keys(classLabels);
   const colors = result.study === 'kapasitas' ? Object.values(classColors).reverse() : Object.values(classColors);
   panel.querySelector('#inarisk-legend').innerHTML = `<h3>Kelas ${escape(result.study)}</h3><div class="inarisk-legend-layer">${keys.map((key,index)=>`<span><i style="background:${colors[index]}" aria-hidden="true"></i>${classLabels[key]}</span>`).join('')}</div><p>${escape(studyNotes[result.study])}</p>`;
  }
  drawSummary(result);
  const m=result.metadata;panel.querySelector('#inarisk-metadata').innerHTML=`<strong>${escape(service.kind)}</strong><p>${escape(m.name)}</p>${m.copyrightText?`<p>${escape(m.copyrightText)}</p>`:''}<p>Tahun/periode: ${m.timeInfo?.timeExtent?escape(m.timeInfo.timeExtent.map(t=>new Date(t).getUTCFullYear()).join('–')):'belum tercantum'}</p><a href="${escape(m.sourceUrl||service.sourceUrl)}" target="_blank" rel="noopener noreferrer">Metadata layanan ↗</a>`;refreshIcons();}
 function stage(service,result,token,stale,refresh){if(token!==requestId)return;
  // Request the candidate at zero opacity; keep the current raster until its replacement succeeds.
  const revision=refresh?String(Date.now()):null;
  const Raster=L.TileLayer.extend({getTileUrl(coords){return '/api/inarisk?'+new URLSearchParams({mode:'image',service:service.service,bbox:tileBbox(coords),...(revision?{refresh:revision}:{})});}});
  const candidate=new Raster('',{pane:'floodOverlay',opacity:0,bounds,noWrap:true,keepBuffer:2,updateWhenIdle:true,updateWhenZooming:false,maxZoom:19,attribution:'<a href="https://inarisk.bnpb.go.id/" target="_blank" rel="noopener">BNPB InaRISK</a>'});let errors=0,images=0,committed=false;
  const commit=()=>{if(token!==requestId)return;clearTimeout(pending?.timer);pending=null;const previous=overlay;overlay=candidate;activeService=service;committed=true;candidate.setOpacity(Number(opacity.value)/100);if(!visible.checked)candidate.remove();setActive(visible.checked&&images>0);previous?.remove();previous?.off();select.value=service.service;drawMetadata(service,result);cache.services=services;cache.metadata[service.service]={...result,cachedAt:Date.now()};remember();setStatus(!visible.checked?'Layer disembunyikan.':stale?'Layer tampil menggunakan sumber tersimpan; pembaruan sumber belum berhasil.':service.kind+' · BNPB InaRISK',stale);finish(token);};
  candidate.on('loading',()=>{errors=0;images=0;});candidate.on('tileload',()=>{images++;if(committed&&overlay===candidate&&visible.checked)setActive(true);});candidate.on('tileerror',()=>{errors++;});candidate.on('load',()=>{if(committed){if(overlay===candidate&&!busy&&errors)setStatus('Sebagian gambar sumber belum termuat. Layer yang tersedia tetap ditampilkan.',true);return;}queueMicrotask(()=>{if(token!==requestId)return;if(!images||(errors&&activeService?.service===service.service))failure(token,'Gambar InaRISK belum dapat dimuat. Coba lagi.');else{commit();if(errors)setStatus(service.kind+' · Sebagian gambar sumber belum termuat.',true);}});});
  pending={layer:candidate,timer:setTimeout(()=>failure(token,'Sumber belum merespons. Coba lagi.'),22000)};
  if(visible.checked){candidate.addTo(map);setStatus(overlay?'Memperbarui layer… tampilan sebelumnya tetap tersedia.':'Memuat gambar banjir dari sumber…');}else{commit();}
 }
 async function choose(service,token,refresh=false,stale=false){if(!service){failure(token,'Layer banjir belum tersedia.');return;}setStatus(overlay?'Memperbarui sumber… layer sebelumnya tetap tersedia.':'Membaca sumber dan legenda…');try{let result;try{result=await api('metadata',service.service,refresh);stale=stale||!!result.stale;}catch(error){if(token!==requestId)return;const stored=cache.metadata[service.service];if(!overlay&&stored&&Date.now()-stored.cachedAt<CACHE_AGE){result=stored;stale=true;}else throw error;}if(token!==requestId)return;if(!result.metadata)throw Error('Metadata belum tersedia.');stage(service,result,token,stale,refresh);}catch(error){failure(token,'InaRISK belum terhubung. Buka detail koneksi untuk melihat penyebabnya.',error);}}
 async function load(refresh=false){const token=begin(),previous=activeService?.service||select.value;setStatus(overlay?'Memperbarui sumber… layer sebelumnya tetap tersedia.':'Menghubungkan layanan InaRISK…');try{let result,stale=false;try{result=await api('catalog',null,refresh);}catch(error){if(token!==requestId)return;if(overlay)throw error;if(cache.services?.some(validService)){result={services:cache.services};stale=true;}else throw error;}if(token!==requestId)return;
   const available=(result.services||[]).filter(validService);if(!available.length)throw Error('Katalog belum memuat layanan banjir.');stale=stale||!!result.stale;available.sort((a,b)=>{const rank=s=>s.kind==='Bahaya banjir'?0:s.kind==='Risiko banjir'?1:2;return rank(a)-rank(b);});if(activeService&&!available.some(s=>s.service===activeService.service))available.push(activeService);services=available;
   select.innerHTML=services.map(s=>`<option value="${escape(s.service)}">${escape(s.kind)}</option>`).join('');const selected=services.find(s=>s.service===previous)||services[0];select.value=selected.service;controls.classList.remove('hidden');await choose(selected,token,refresh,stale);
  }catch(error){failure(token,'InaRISK belum terhubung. Buka detail koneksi untuk melihat penyebabnya.',error);}}
 select.onchange=()=>{const service=services.find(s=>s.service===select.value);const token=begin();choose(service,token);};retry.onclick=()=>load(true);
 visible.onchange=e=>{if(!e.target.checked){requestId++;controller?.abort();cancelPending();setBusy(false);overlay?.remove();setActive(false);setStatus('Layer disembunyikan.');}else if(overlay&&activeService?.service===select.value){overlay.addTo(map);setActive(true);setStatus('Menampilkan layer yang terakhir berhasil dimuat.');}else if(!services.length){load();}else{const token=begin();choose(services.find(s=>s.service===select.value),token);}};
 opacity.oninput=e=>{panel.querySelector('#inarisk-opacity-value').textContent=e.target.value+'%';overlay?.setOpacity(Number(e.target.value)/100);};refreshIcons();
}
