import {mountRainfall} from './rainfall.js';
import {createMapMeasure} from './map-measure.js';
import {createNews} from './news.js';
import {mountNewsWatch} from './news-watch.js';
import {mountSlope} from './slope.js';
import {centralOffice,jakartaOfficeReferences} from './central-office.js';
import {createDirectory,childrenOf} from './directory.js';
import {mountInarisk} from './inarisk.js';
import {mountSibolgaPreview} from './qgis-preview.js';
import {createReadiness} from './readiness-source.js';
import {locationCoords,isVerified} from './distance.js';
import {bankLogo,bankBrand} from './banks.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './fonts.css';
import {createIcons,CloudRain,Map as MapIcon,ShieldCheck,ChevronRight,Download,Mountain,Ruler,Route,MoveRight,Sparkles,ZoomIn,Network,Landmark,Vault,Globe,Plus,Minus,Maximize,Layers,Info,Search,ChevronDown,FileSpreadsheet,SearchX,X,MapPin,ArrowUpRight,ArrowLeft,ArrowRight,PanelRightClose,PanelRightOpen,Check,SlidersHorizontal,LocateFixed,Menu,Compass,ExternalLink,Database,TriangleAlert,Keyboard} from 'lucide';
import './style.css';
import './studio.css';
import './aurora.css';
import './clean.css';
import './accessibility.css';
import './modern.css';
import './map-workspace.css';
import {mountInteractionEffects} from './interaction-effects.js';
const icons={CloudRain,Map:MapIcon,ShieldCheck,ChevronRight,Download,Mountain,Ruler,Route,MoveRight,Sparkles,ZoomIn,Network,Landmark,Vault,Globe,Plus,Minus,Maximize,Layers,Info,Search,ChevronDown,FileSpreadsheet,SearchX,X,MapPin,ArrowUpRight,ArrowLeft,ArrowRight,PanelRightClose,PanelRightOpen,Check,SlidersHorizontal,LocateFixed,Menu,Compass,ExternalLink,Database,TriangleAlert,Keyboard};
const i=(name,cls='')=>`<i data-lucide="${name}" class="${cls}"></i>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'Belum tersedia':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const bounds=L.latLngBounds([[-11.7,94.4],[6.3,141.5]]);
const validPoint=coords=>Array.isArray(coords)&&coords.length===2&&coords.every(Number.isFinite)&&bounds.contains(coords);
const hasOfficeCoords=d=>validPoint(locationCoords(d));
const areaCoords=d=>jakartaOfficeReferences[d.id]?.coords??d.legacyCityCoords;
const isApproximate=d=>!hasOfficeCoords(d)&&validPoint(areaCoords(d));
const mapCoords=d=>hasOfficeCoords(d)?locationCoords(d):isApproximate(d)?areaCoords(d):null;
const hasCoords=d=>Boolean(mapCoords(d));
const coordinateLabel=d=>isApproximate(d)?`Perkiraan ${jakartaOfficeReferences[d.id]?.name??'wilayah'} · titik gedung belum tersedia`:({ready_for_review:'Siap ditinjau',needs_confirmation:'Perlu konfirmasi',not_found:'Koordinat belum ditemukan',verified:'Terverifikasi'})[d.status]||'Belum diverifikasi';
const refreshIcons=()=>createIcons({icons});
async function init(){
const [data,geo,sourceReadiness]=await Promise.all([fetch('/locations.json').then(r=>{if(!r.ok)throw Error('Data lokasi tidak tersedia');return r.json();}),fetch('/basemap.geojson').then(r=>{if(!r.ok)throw Error('Peta tidak tersedia');return r.json();}),fetch('/readiness-import.json').then(r=>{if(!r.ok)throw Error('Data sarpras tidak tersedia');return r.json();}).catch(error=>{console.error(error);return null;})]);
data.push(centralOffice);
const sumatera=['Aceh','Sumatera Utara','Pematangsiantar','Sibolga','Sumatera Barat','Riau','Kepulauan Riau','Jambi','Sumatera Selatan','Bengkulu','Lampung','Kepulauan Bangka Belitung','Lhokseumawe'];
const jawa=['DKI Jakarta','Banten','Jawa Barat','Cirebon','Tasikmalaya','Tegal','Purwokerto','Jawa Tengah','Solo','DI Yogyakarta','Jawa Timur','Malang','Kediri','Jember'];
data.forEach(d=>{if(d.type==='kpw')d.region=sumatera.includes(d.name)?'Sumatera':jawa.includes(d.name)?'Jawa':['Bali','Nusa Tenggara Barat','Nusa Tenggara Timur'].includes(d.name)?'Balinusra':['Kalimantan Barat','Kalimantan Selatan','Kalimantan Tengah','Kalimantan Timur','Balikpapan','Kalimantan Utara'].includes(d.name)?'Kalimantan':'Sulampua';});
let coordinateFilter='all',directoryParentId=null;
let type='all',region='all',query='',selected=null,panelOpen=false,mapStyle='satellite';
let lastFocus=null,toastTimer,resizeTimer,distanceOpen=false;
const network=data.filter(d=>d.type!=='pusat');
const locatedCount=network.filter(hasOfficeCoords).length;const confirmationCount=network.filter(d=>d.status==='needs_confirmation').length;const reviewCount=network.filter(d=>d.status==='ready_for_review').length;const missingCount=network.length-locatedCount;
const counts={kpw:data.filter(d=>d.type==='kpw').length,kas:data.filter(d=>d.type==='kas').length};
const regions=['Sumatera','Jawa','Kalimantan','Balinusra','Sulampua'];
document.documentElement.dataset.theme='dark';
document.querySelector('#app').innerHTML=`
<aside class="sidebar" aria-label="Navigasi utama">
 <a class="wordmark" href="/" aria-label="Ruang Risiko beranda"><span class="brand-symbol brand-drop"><img src="/brand/ruang-risiko-contour.png" alt="" width="44" height="44" decoding="async" fetchpriority="high"></span><span>Ruang Risiko<small>ASESMEN BANJIR</small></span></a>
 <div class="workspace-switch"><span class="workspace-symbol">BI</span><span>Jaringan kas Indonesia<small>Seluruh Indonesia</small></span><span class="workspace-status" title="Data lokal tersedia"></span></div>

 <a id="map-nav" class="nav-item active" href="#peta" aria-current="page">${i('map')}<span>Asesmen Risiko Banjir</span></a>
 <a class="nav-item" id="news-nav" href="#berita">${i('file-spreadsheet')}<span>Berita kebencanaan</span></a><a class="nav-item" id="readiness-nav" href="#sarpras">${i('shield-check')}<span>Kesiapan sarpras</span></a>
 <div class="sidebar-insight"><div class="insight-kicker">JARINGAN INDONESIA</div><div class="insight-total">133 <span>lokasi</span></div><div class="insight-bar"><b></b><b></b></div><div class="insight-legend"><span><b></b>46 KPw</span><span><b></b>87 Kas titipan</span></div><div class="insight-note">${i('globe')} 5 wilayah operasional</div></div><div class="sidebar-review"><span class="review-dot"></span><div>Verifikasi koordinat<small>${locatedCount}/133 tersedia · belum diverifikasi</small></div><button id="review-info" aria-label="Status verifikasi">${i('arrow-up-right')}</button></div><div class="sidebar-coverage"><span class="section-kicker">CAKUPAN NASIONAL</span><div class="coverage-value">133<span>titik jaringan</span></div><div class="coverage-bar"><span></span><span></span></div><div class="coverage-key"><span><b class="dot cyan"></b>46 KPw BI</span><span><b class="dot amber"></b>87 Kas titipan</span></div><div class="coverage-regions"><span>5</span> wilayah operasional ${i('arrow-up-right')}</div></div>
 <div class="sidebar-bottom"><div class="source-mini">${i('file-spreadsheet')}<span>Data bersumber dari Excel<small>Rekap Kas Titipan (1).xlsx</small></span></div><div class="sidebar-signature"><span class="profile-avatar">JA</span><div>Asesmen Banjir<small>Peta jaringan kas</small></div><span class="version">v0.2</span></div></div>
</aside>
<div class="app-main"><header class="topbar"><div class="map-title"><h1>Asesmen Risiko Banjir</h1><span class="title-tag">${i('globe')} Indonesia</span></div><div class="topbar-actions"><a class="news-mobile" href="#berita">Berita</a><button id="readiness-header" class="readiness-header" aria-label="Buka kesiapan sarpras">${i('shield-check')}</button><a class="export-button" id="export" href="/Database-Koordinat-133-Lokasi.xlsx" download title="Unduh Database Koordinat (Excel)" aria-label="Unduh Database Koordinat (Excel)">${i('download')}<span>Database Koordinat</span></a><button id="help" class="header-icon" aria-label="Tentang data">${i('info')}</button></div></header>
<main id="peta">
<div class="overview"><div class="overview-title">${i('globe')}<span>Jaringan nasional</span><small>5 wilayah</small></div><button class="metric" data-metric="all"><span class="metric-symbol total">${i('network')}</span><span class="metric-number">133</span><span class="metric-name">Total lokasi</span></button><button class="metric" data-metric="kpw"><span class="metric-symbol cyan">${i('landmark')}</span><span class="metric-number">46</span><span class="metric-name">KPw Bank Indonesia</span></button><button class="metric" data-metric="kas"><span class="metric-symbol amber">${i('vault')}</span><span class="metric-number">87</span><span class="metric-name">Kas titipan</span></button><button id="validation" class="validation-chip"><span></span>Lokasi belum diverifikasi ${i('arrow-up-right')}</button></div>
<section class="explorer panel-hidden" aria-label="Peta dan direktori jaringan"><div class="explorer-top"><div class="view-title">${i('map')}<strong>Jaringan kas</strong><span class="view-title-separator"></span><span id="map-region-label">Seluruh Indonesia</span></div>
<div class="news-watch-tools" aria-label="Berita dan pantauan peta">
<button id="news-map-toggle" type="button" aria-pressed="false"><span class="watch-dot" aria-hidden="true"></span>Penanda berita</button>
<button id="watch-priority" type="button" aria-haspopup="dialog" aria-controls="watch-dialog">Prioritas Pantauan</button>
<dialog id="watch-dialog" aria-labelledby="watch-heading">
<div class="watch-heading"><h2 id="watch-heading">Prioritas Pantauan</h2><button id="watch-close" type="button" aria-label="Tutup Prioritas Pantauan">Tutup</button></div>
<p>Hingga delapan lokasi banjir atau longsor dalam 72 jam terakhir, dengan dampak yang dilaporkan atau liputan dari beberapa penerbit. Tampilan nasional memberi ruang bagi tiap Korwil yang memiliki laporan. Perbesar peta untuk memusatkan pantauan pada area yang terlihat.</p>
<button id="watch-refresh" type="button">Perbarui berita</button><p id="watch-status" role="status"></p><div id="watch-results"></div>
</dialog>
</div>
<div class="map-actions">
<div class="map-layer-group" role="group" aria-labelledby="risk-layer-title"><span id="risk-layer-title">Risiko</span><div class="map-layer-buttons" id="risk-layer-buttons"><button id="risk-settings" type="button" title="Pengaturan Risiko" aria-label="Pengaturan Risiko">${i('sliders-horizontal')}</button></div></div>
<div class="map-layer-group" role="group" aria-labelledby="assessment-layer-title"><span id="assessment-layer-title">Asesmen Risiko</span><div class="map-layer-buttons" id="assessment-layer-buttons"><button id="layer-settings" type="button" title="Pengaturan Asesmen Risiko" aria-label="Pengaturan Asesmen Risiko">${i('sliders-horizontal')}</button></div></div>
<button id="reset" title="Kembali ke seluruh Indonesia" aria-label="Tampilkan Indonesia">${i('maximize')}<span> Seluruh Indonesia</span></button><span class="control-separator"></span><button id="panel-toggle" aria-label="Tampilkan daftar lokasi" aria-expanded="false">${i('panel-right-open')}<span>Daftar lokasi</span></button></div></div>
<div class="explorer-body"><div class="map-column"><div class="map-frame"><button id="map-measure" class="map-measure-button" aria-pressed="false">${i('ruler')}<span>Ukur jarak</span></button><div id="map" aria-label="Peta Indonesia interaktif"></div><div class="map-vignette"></div><div id="family-map-context" class="family-map-context hidden"></div><div class="map-watermark">RUANG RISIKO<span>INDONESIA NETWORK EXPLORER</span></div><div class="map-filters" aria-label="Filter jenis jaringan"><button data-type="all" class="active" aria-pressed="true">Semua <span>133</span></button><button data-type="kpw" aria-pressed="false"><b class="dot cyan"></b>KPw BI <span>46</span></button><button data-type="kas" aria-pressed="false"><b class="dot amber"></b>Kas titipan <span>87</span></button></div>
<div class="map-stamp"><span class="stamp-rule"></span><span>KEPULAUAN INDONESIA<small>05° N — 11° S &nbsp; / &nbsp; 95° E — 141° E</small></span></div><div class="compass" title="Utara"><span>N</span>${i('compass')}</div><div class="zoom-controls"><button id="zoom-in" aria-label="Perbesar">${i('plus')}</button><button id="zoom-out" aria-label="Perkecil">${i('minus')}</button></div>
<div class="map-bottom"><button id="layers" class="basemap-button" aria-expanded="false">${i('layers')}<span>Jenis peta</span>${i('chevron-down')}</button></div><div id="layer-menu" class="layer-menu hidden"><span class="menu-caption">JENIS PETA</span><button data-basemap="satellite" class="active"><span class="basemap-swatch satellite"></span><span>Peta satelit<small>Esri · citra dan relief laut</small></span>${i('check')}</button><button data-basemap="atlas"><span class="basemap-swatch atlas"></span><span>Peta sederhana<small>Gambaran wilayah · tersedia tanpa internet</small></span>${i('check')}</button><button data-basemap="street"><span class="basemap-swatch street"></span><span>Peta jalan<small>OpenStreetMap · jalan dan nama tempat</small></span>${i('check')}</button><div id="tile-status" role="status"></div></div>
<div class="map-service-note hidden" id="map-service-note" role="status"><span id="map-service-text"></span><button id="retry-map">Coba peta jalan</button></div><div class="map-zoom-hint" id="map-zoom-hint">Perbesar untuk melihat jalan dan nama tempat</div><div id="map-context" class="map-context hidden"></div><section id="distance-panel" class="distance-panel hidden" aria-label="Gambar garis untuk mengukur jarak"></section>
</div><div class="map-status"><span><b class="dot cyan"></b><strong id="visible-count">133</strong> lokasi ditampilkan<span class="status-divider">/</span><span id="scope-label">Cakupan nasional</span><span id="headquarters-count"></span><span id="approximate-count"></span></span><button id="data-note">${i('info')}Status koordinat kantor ${i('arrow-up-right')}</button></div></div>
<aside class="directory" id="directory" aria-label="Daftar lokasi"><div class="directory-shell-nav"><button id="directory-back">${i('arrow-left')}Kembali ke peta</button><button id="directory-close" aria-label="Tutup daftar lokasi">${i('x')}</button></div><div id="directory-list"><div class="directory-heading"><div><h2><span id="directory-title">Kantor perwakilan</span><span id="directory-total">46</span></h2></div><button class="directory-filter-toggle" id="directory-filter-toggle" aria-label="Buka filter" aria-expanded="false">${i('sliders-horizontal')}</button></div><label class="search-box">${i('search')}<input type="search" id="search" placeholder="Cari kota, KPw, atau bank…" autocomplete="off" aria-label="Cari lokasi"><kbd>/</kbd></label><div id="directory-advanced" class="directory-advanced hidden"><div class="directory-filter"><label for="region">Wilayah</label><div>${i('globe')}<select id="region"><option value="all">Seluruh Indonesia</option>${regions.map(r=>`<option value="${r}">${r==='Balinusra'?'Bali & Nusa Tenggara':r==='Sulampua'?'Sulawesi, Maluku & Papua':r}</option>`).join('')}</select>${i('chevron-down')}</div></div><label class="coordinate-filter-label">Status koordinat<select id="coordinate-filter" aria-label="Filter status koordinat"><option value="all">Semua status koordinat</option><option value="ready_for_review">Siap ditinjau · 44</option><option value="needs_confirmation">Perlu konfirmasi · 8</option><option value="not_found">Perkiraan / belum ditemukan</option></select></label></div><div class="results-heading"><span id="result-count">133 lokasi</span><button id="clear-filters" class="hidden">Hapus filter ${i('x')}</button><span id="list-order">A—Z</span></div><div id="list" aria-live="polite"></div></div><div id="location-detail" class="hidden"></div></aside></div></section>
<div class="page-foot"><span>${i('shield-check')}Perbesar peta untuk melihat jalan dan nama tempat.</span><button id="missing-data">1 kas titipan belum ada di sumber data ${i('arrow-up-right')}</button></div></main></div>
<div class="modal-backdrop hidden" id="audit-modal"><section class="audit-dialog" role="dialog" aria-modal="true" aria-labelledby="audit-title" tabindex="-1"><div class="dialog-head"><span class="dialog-icon">${i('database')}</span><button id="audit-close" aria-label="Tutup informasi data">${i('x')}</button></div><div class="overline">TENTANG DATA</div><h2 id="audit-title">Sumber dan kelengkapan data</h2><p>Koordinat dan keterangan berasal dari Excel pengguna. Status Siap ditinjau menandai kandidat yang masih perlu ditinjau.</p><div class="audit-metrics"><div><strong>46</strong><span>Kantor perwakilan</span></div><div><strong>87<span>/ 88</span></strong><span>Kas titipan di file</span></div><div><strong>0</strong><span>Koordinat terverifikasi</span></div></div><div class="audit-items"><div>${i('layers')}<span><strong>Layer BNPB InaRISK</strong>Legenda dan periode mengikuti layanan sumber. Layer kajian bukan laporan banjir yang sedang terjadi. Aplikasi belum memberikan kelas risiko otomatis ke koordinat kantor.</span></div><div>${i('shield-check')}<span><strong>Cara baca sarpras banjir</strong>Infografik menjadi acuan 24 kebutuhan dan 4 langkah preventif. Excel menyediakan bukti tiap KPw. Progres menunjukkan kelengkapan data, bukan skor kesiapan penuh. Data sebagian tidak membuktikan seluruh kebutuhan siap; sel kosong bukan nol. Rincian sel sumber tersedia pada tiap butir.</span></div><div>${i('map-pin')}<span><strong>${locatedCount} lokasi memiliki koordinat kandidat</strong>${reviewCount} siap ditinjau dan ${confirmationCount} perlu konfirmasi. Sebanyak ${missingCount} lokasi memakai titik acuan wilayah bertanda ≈ selama koordinat gedung belum tersedia. Garis jaringan biru memakai perkiraan wilayah. Garis hijau kebiruan memakai titik dari data di kedua ujung.</span></div><div>${i('file-spreadsheet')}<span><strong>File sumber berisi 87 kas titipan</strong>Satu lokasi dari target 88 belum tercantum dalam file. Beberapa nama bank dan nilai plafon juga belum tersedia.</span></div><div>${i('layers')}<span><strong>Peta jalan dari OpenStreetMap</strong>Anda dapat memperbesar peta untuk melihat jalan, bangunan, dan nama tempat yang tercatat di OpenStreetMap. Peta sederhana tersedia jika koneksi peta jalan terputus. Logo institusi ditampilkan untuk membantu mengenali lokasi, bukan sebagai tanda afiliasi.</span></div></div><p class="logo-credit">Logo: <a href="https://github.com/hafidznoor/idn-finlogos" target="_blank" rel="noopener">idn-finlogos 2.5.0</a> · <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener">CC BY-NC 4.0</a>. Merek milik masing-masing institusi.</p><button id="audit-done" class="primary-button">Kembali ke peta ${i('arrow-right')}</button></section></div><div id="toast" role="status" class="toast hidden"></div>`;
const map=L.map('map',{zoomControl:false,attributionControl:true,minZoom:3,maxZoom:19,maxBounds:bounds.pad(.025),maxBoundsViscosity:1,worldCopyJump:false,zoomSnap:.25,zoomDelta:.75,preferCanvas:false}).setView([-2.5,118],5);
map.attributionControl.setPrefix(false);
map.attributionControl.addAttribution('Natural Earth');
const land=L.geoJSON(geo,{style:landStyle,interactive:false}).addTo(map);
function landStyle(f){return {color:'#335568',weight:f.properties.name==='Indonesia'?1.15:.65,fillColor:f.properties.name==='Indonesia'?'#153b4b':'#102a39',fillOpacity:1};}
const grids=L.layerGroup().addTo(map);
for(let lat=-15;lat<=10;lat+=5)L.polyline([[lat,88],[lat,150]],{color:'#426376',weight:.5,opacity:.15,interactive:false}).addTo(grids);
for(let lng=90;lng<=145;lng+=5)L.polyline([[-20,lng],[15,lng]],{color:'#426376',weight:.5,opacity:.15,interactive:false}).addTo(grids);
const labels=L.layerGroup().addTo(map);
[['SUMATERA',-1,100],['JAWA',-8.9,109.5],['KALIMANTAN',2.4,113.5],['SULAWESI',-4.5,122],['PAPUA',-5.2,137],['MALUKU',-4.4,129],['NUSA TENGGARA',-11.5,120.5]].forEach(([name,lat,lng])=>L.marker([lat,lng],{interactive:false,icon:L.divIcon({className:'island-label',html:name,iconSize:[150,16],iconAnchor:[75,8]})}).addTo(labels));
[['SAMUDRA HINDIA',-9.5,99],['LAUT JAWA',-4.7,110],['LAUT BANDA',-7.2,129],['SAMUDRA PASIFIK',5,135]].forEach(([name,lat,lng])=>L.marker([lat,lng],{interactive:false,icon:L.divIcon({className:'ocean-label',html:name,iconSize:[180,16],iconAnchor:[90,8]})}).addTo(labels));
const networkPane = map.createPane('officeConnections');
networkPane.style.zIndex = '510';
networkPane.style.pointerEvents = 'none';
const connections = L.layerGroup().addTo(map);
const markers=L.layerGroup().addTo(map);
map.createPane('streetMap');map.getPane('streetMap').style.zIndex=450;
const basemapOptions={pane:'streetMap',maxZoom:19,bounds:bounds,noWrap:true,keepBuffer:2,updateWhenIdle:true,updateWhenZooming:false,errorTileUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'};
const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const onlineBasemaps = {
 satellite: L.tileLayer(esri+'World_Imagery/MapServer/tile/{z}/{y}/{x}', {...basemapOptions,bounds:undefined,
  attribution:'Imagery &copy; <a href="https://www.esri.com/en-us/arcgis/products/arcgis-living-atlas/overview" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics, and GIS User Community'}),
 street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {...basemapOptions,
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'}),
};
const satelliteLabels=L.tileLayer(esri+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
 {...basemapOptions,bounds:undefined,maxNativeZoom:16,zIndex:2,attribution:'Label &copy; Esri'});

L.control.scale({position:'bottomleft',imperial:false,maxWidth:90}).addTo(map);
const regionControl = L.control({position:'bottomleft'});
regionControl.onAdd = () => {
 const control = L.DomUtil.create('div', 'map-region-controls');
 const toggle = L.DomUtil.create('button', 'map-region-toggle', control);
 toggle.type = 'button';
 toggle.setAttribute('aria-expanded', 'true');
 toggle.setAttribute('aria-controls', 'map-region-options');
 toggle.textContent = 'Korwil';
 const group = L.DomUtil.create('div', 'map-region-options', control);
 group.id = 'map-region-options';
 toggle.onclick = () => {
   group.hidden = !group.hidden;
   toggle.setAttribute('aria-expanded', String(!group.hidden));
 };
 group.setAttribute('role', 'group');
 group.setAttribute('aria-label', 'Korwil jaringan pada peta');
 for (const area of ['all', ...regions]) {
   const button = L.DomUtil.create('button', '', group);
   button.type = 'button';
   button.dataset.mapRegion = area;
   button.textContent = area === 'all' ? 'Semua' : area;
   button.setAttribute('aria-pressed', String(area === region));
   button.onclick = () => clearFilters(area, false);
 }
 L.DomEvent.disableClickPropagation(control);
 L.DomEvent.disableScrollPropagation(control);
 return control;
};
regionControl.addTo(map);
let tileTimer, failedBasemap='satellite';
function mapNotice(message){
 document.querySelector('#tile-status').textContent=message;
 document.querySelector('#map-service-text').textContent=message;
 document.querySelector('#map-service-note').classList.toggle('hidden',!message);
}
for(const [style, tiles] of Object.entries(onlineBasemaps)){
 tiles.on('loading',()=>{
  clearTimeout(tileTimer);
  tileTimer=setTimeout(()=>{if(mapStyle===style)fallbackMap(style);},12000);
 });
 tiles.on('load',()=>{
  if(mapStyle!==style)return;
  clearTimeout(tileTimer);
  const images=tiles.getContainer().querySelectorAll('img');
  const failed=[...images].filter(image=>image.src.startsWith('data:'));
  if(images.length&&failed.length===images.length){
   queueMicrotask(()=>{if(mapStyle===style)fallbackMap(style);});
  }else mapNotice(failed.length?'Sebagian peta dasar belum termuat.':'');
 });
}
function setMapStyle(next,notify=false){
 clearTimeout(tileTimer);
 mapNotice('');
 for(const tiles of Object.values(onlineBasemaps))map.removeLayer(tiles);
 map.removeLayer(satelliteLabels);
 mapStyle=next;
 const online=onlineBasemaps[next];
 const frame=document.querySelector('.map-frame');
 frame.classList.toggle('is-street',next==='street');
 frame.classList.toggle('is-satellite',next==='satellite');
 if(online){
  map.removeLayer(labels);
  map.removeLayer(grids);
  online.addTo(map);
  if(next==='satellite')satelliteLabels.addTo(map);
 }else{
  labels.addTo(map);
  grids.addTo(map);
 }
 document.querySelectorAll('[data-basemap]').forEach(el=>{
  el.classList.toggle('active',el.dataset.basemap===next);
  el.setAttribute('aria-pressed',String(el.dataset.basemap===next));
 });
 document.querySelector('#map-zoom-hint').classList.toggle('hidden',next!=='street'||map.getZoom()>=13);
 if(notify){
  document.querySelector('#layer-menu').classList.add('hidden');
  document.querySelector('#layers').setAttribute('aria-expanded','false');
  showToast({satellite:'Peta satelit ditampilkan.',street:'Peta jalan OpenStreetMap ditampilkan.',atlas:'Peta sederhana ditampilkan.'}[next]);
 }
}
function fallbackMap(style){
 failedBasemap=style;
 setMapStyle('atlas');
 document.querySelector('#retry-map').textContent=style==='satellite'?'Coba peta satelit':'Coba peta jalan';
 mapNotice('Peta sederhana aktif.');
}
document.querySelector('#retry-map').onclick=()=>setMapStyle(failedBasemap);

function mapHasSize(){
 const frame=document.querySelector('.map-frame');
 return frame.clientWidth>=80&&frame.clientHeight>=80&&!document.querySelector('#peta').classList.contains('hidden');
}
function nationalZoom(){
 map.setMinZoom(3);
 return Math.max(3,Math.min(7,map.getBoundsZoom(bounds,false,L.point(32,32))));
}
function nationalView(animate=false){
 if(!mapHasSize())return;
 map.stop();
 map.invalidateSize({pan:false});
 const zoom=nationalZoom();
 map.setMinZoom(zoom);
 map.setView(bounds.getCenter(),zoom,{animate});
}
function currentRows(){return data.filter(d=>(!directoryParentId||d.id===directoryParentId||d.kpw===data.find(p=>p.id===directoryParentId)?.name)&&(coordinateFilter==='all'||d.status===coordinateFilter)&&(type==='all'||d.type===type)&&(region==='all'||d.region===region)&&`${d.name} ${d.bank} ${d.kpw} ${d.city||''}`.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id')));}
function updateViewForRows(animate=true){const rows=currentRows().filter(hasCoords);if(region==='all'&&!query&&!directoryParentId){nationalView(animate);}else if(rows.length){map.stop();map.fitBounds(L.latLngBounds(rows.map(d=>mapCoords(d))),{padding:[60,80],maxZoom:8,animate});}}
let lastMarkerView;
function renderMarkers(){
 const rows=currentRows().filter(hasCoords), z=map.getZoom();
 const key=JSON.stringify([z,selected,rows.map(row=>row.id)]);
 if(key===lastMarkerView)return;
 lastMarkerView=key;
 markers.clearLayers();const groups=[];const biSize=z<6?27:z<9?34:42,bankSize=z<6?19:z<9?25:30,clusterSize=z<6?32:z<9?40:46;document.querySelector('#map').style.setProperty('--bi-marker',biSize+'px');document.querySelector('#map').style.setProperty('--bank-marker',bankSize+'px');document.querySelector('#map').style.setProperty('--cluster-marker',clusterSize+'px');const cellSize=z<6?38:z<8?39:34;
 for(const d of rows){const point=map.project(mapCoords(d),z);let group=groups.find(g=>Math.hypot(g.point.x-point.x,g.point.y-point.y)<cellSize);if(d.id===selected)group=null;if(group&&!group.items.some(x=>x.id===selected)){group.items.push(d);const n=group.items.length;group.point=L.point((group.point.x*(n-1)+point.x)/n,(group.point.y*(n-1)+point.y)/n);}else groups.push({point,items:[d]});}
 for(const group of groups){const many=group.items.length>1;const d=group.items[0];const latLng=many?map.unproject(group.point,z):mapCoords(d);const kpw=group.items.filter(x=>x.type==='kpw').length;let html,size;
  if(many){size=clusterSize;const lead=group.items.find(x=>x.type==='kpw')||d;const other=group.items.find(x=>x.type==='kas');html=`<button class="logo-cluster ${kpw?'has-bi':'banks-only'}" aria-label="Perbesar kelompok ${group.items.length} lokasi"><span class="cluster-brand">${bankLogo(lead)}</span>${kpw&&other?`<span class="cluster-secondary">${bankLogo(other)}</span>`:''}<span class="cluster-count">${group.items.length}</span></button>`;}
  else{size=d.type==='kas'?bankSize:biSize;html=`<button class="map-pin logo-pin ${d.type} ${selected===d.id?'selected':''}" aria-label="${esc(d.type==='kpw'?'KPw '+d.name:d.name)}">${bankLogo(d)}${isApproximate(d)?'<span class="unverified-marker-badge approximate-marker-badge">≈</span>':d.status==='needs_confirmation'?'<span class="unverified-marker-badge">!</span>':d.status==='ready_for_review'?'<span class="submitted-marker-badge"></span>':isVerified(d)?'':'<span class="unverified-marker-badge">?</span>'}</button>`;}
  const marker=L.marker(latLng,{keyboard:false,zIndexOffset:selected===d.id?1000:many?100:0,icon:L.divIcon({className:'marker-container',html,iconSize:[size,size],iconAnchor:[size/2,size/2]})});
  marker.on('click',()=>{if(many){map.fitBounds(L.latLngBounds(group.items.map(d=>mapCoords(d))),{padding:[85,85],maxZoom:Math.max(8,map.getZoom()+1.5),animate:true});}else openLocation(d.id);});
  marker.bindTooltip(many?`${group.items.length} lokasi · ${kpw} KPw, ${group.items.length-kpw} kas titipan`:`${d.type==='kpw'?'KPw ':''}${esc(d.name)} · ${coordinateLabel(d)}`,{direction:'top',offset:[0,-12],className:'location-tooltip'});markers.addLayer(marker);
 }
}
function render(){
 const rows=currentRows();const sorting=[...rows].sort((a,b)=>a.name.localeCompare(b.name,'id'));
 const mappedNetwork = rows.filter(d => d.type !== 'pusat' && hasCoords(d));
 const headquartersVisible = rows.some(d => d.type === 'pusat' && hasCoords(d));
 const approximateCount = mappedNetwork.filter(isApproximate).length;
 document.querySelector('#approximate-count').textContent = approximateCount ? ` · ${approximateCount} perkiraan wilayah (≈)` : '';
 document.querySelector('#headquarters-count').textContent = headquartersVisible ? ' · +1 Kantor Pusat' : '';
 document.querySelector('#visible-count').textContent=mappedNetwork.length;document.querySelector('#directory-total').textContent=rows.length;document.querySelector('#result-count').textContent=`${rows.length} lokasi ditemukan`;
 document.querySelector('#clear-filters').classList.toggle('hidden',type==='all'&&region==='all'&&!query&&coordinateFilter==='all');document.querySelector('#list-order').classList.toggle('hidden',type!=='all'||region!=='all'||!!query||coordinateFilter!=='all');
 watch.setRegion(region);
 regionControl.getContainer().querySelectorAll('[data-map-region]').forEach(button=>{
   button.setAttribute('aria-pressed', String(button.dataset.mapRegion===region));
 });
 document.querySelector('#map-region-label').textContent=region==='all'?'Seluruh Indonesia':region;document.querySelector('#scope-label').textContent=region==='all'?'Cakupan nasional':region;
 document.querySelectorAll('[data-type]').forEach(b=>{b.classList.toggle('active',b.dataset.type===type);b.setAttribute('aria-pressed',String(b.dataset.type===type));});document.querySelectorAll('[data-metric]').forEach(b=>b.classList.toggle('selected',b.dataset.metric===type&&type!=='all'));
 const family=data.find(d=>d.id===directoryParentId);const familyChip=document.querySelector('#family-map-context');familyChip.classList.toggle('hidden',!family);familyChip.innerHTML=family?`<span>KPw ${esc(family.name)}<small>${childrenOf(data,family.id).length} kas titipan</small></span><button id="clear-family" aria-label="Kembali ke seluruh KPw">${i('x')}</button>`:'';document.querySelector('#clear-family')?.addEventListener('click',()=>showFamily(null));
 connections.clearLayers();
 const parents = new Map(rows.filter(d => d.type === 'kpw' && hasCoords(d)).map(d => [d.name, d]));
 for (const child of rows.filter(d => d.type === 'kas' && hasCoords(d))) {
   const parent = parents.get(child.kpw);
   if (!parent) continue;
   const approximate = isApproximate(parent) || isApproximate(child);
   L.polyline([mapCoords(parent), mapCoords(child)], {
     pane: 'officeConnections', className: 'kpw-kas-link', color: approximate ? '#468fb9' : '#2bb6ad',
     weight: approximate ? 1 : 1.2, opacity: approximate ? .65 : .85,
     lineCap: 'round', dashArray: '4 4', interactive: false,
   }).addTo(connections);
 }
 directory.render(rows);renderMarkers();refreshIcons();
}
function setType(next){type=next;closeDetail();render();updateViewForRows();}
function clearFilters(nextRegion='all',animate=true){directoryParentId=null;directory.setParent(null);coordinateFilter='all';document.querySelector('#coordinate-filter').value='all';type='all';region=nextRegion;query='';document.querySelector('#search').value='';document.querySelector('#region').value=region;closeDetail();render();updateViewForRows(animate);}
function setPanel(open){if(open){document.querySelector('.rainfall-panel')?.classList.add('hidden');document.querySelector('.slope-panel')?.classList.add('hidden');document.querySelector('.inarisk-panel')?.classList.add('hidden');document.querySelector('#inarisk-toggle')?.setAttribute('aria-expanded','false');document.querySelector('#layer-menu').classList.add('hidden');}panelOpen=open;document.querySelector('.explorer').classList.toggle('panel-hidden',!open);const button=document.querySelector('#panel-toggle');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Sembunyikan daftar lokasi':'Tampilkan daftar lokasi');button.innerHTML=i(open?'panel-right-close':'panel-right-open')+'<span>Daftar lokasi</span>';refreshIcons();requestAnimationFrame(()=>{const target=open?document.querySelector(document.querySelector('.explorer').classList.contains('detail-open')?'#detail-back':'#directory-back'):document.querySelector('#panel-toggle');target?.focus({preventScroll:true});});}
function closeDetail(){selected=null;map.closePopup();document.querySelector('.explorer').classList.remove('detail-open');document.querySelector('#directory-list').classList.remove('hidden');document.querySelector('#location-detail').classList.add('hidden');document.querySelector('#map-context').classList.add('hidden');renderMarkers();}
function openLocation(id){
 if(distanceOpen){const d=data.find(d=>d.id===id);if(d&&hasOfficeCoords(d))measure.add(locationCoords(d));else if(d&&isApproximate(d))showToast('Titik perkiraan wilayah tidak dipakai sebagai koordinat kantor untuk pengukuran.');return;}
 if(document.querySelector('#rainfall-toggle')?.getAttribute('aria-pressed')==='true'&&!document.querySelector('.rainfall-panel')?.classList.contains('hidden')){const d=data.find(d=>d.id===id);if(d&&hasCoords(d)){const [lat,lng]=mapCoords(d);rainfall.sample({lat,lng});}return;}
 const d=data.find(x=>x.id===id);if(!d)return;if(!hasCoords(d)){openDetail(id);return;}
 selected=null;map.closePopup();document.querySelector('.explorer').classList.remove('detail-open');document.querySelector('#directory-list').classList.remove('hidden');document.querySelector('#location-detail').classList.add('hidden');document.querySelector('#map-context').classList.add('hidden');
 selected=id;if(panelOpen)setPanel(false);map.setView(mapCoords(d),Math.max(map.getZoom(),10),{animate:false});
 const content=document.createElement('div');content.className=`network-popup-card ${d.type}`;
 const name=d.type==='kpw'?`KPw ${d.name}`:d.type==='kas'?`Kas Titipan ${d.name}`:d.name;
 content.innerHTML=`<div class="popup-eyebrow"><span class="popup-type-symbol bank-brand-symbol">${bankLogo(d)}</span><span>${d.type==='kpw'?'KANTOR PERWAKILAN BI':d.type==='pusat'?'KANTOR PUSAT BI':'KAS TITIPAN'}</span></div><h3>${esc(name)}</h3><p class="popup-bank">${esc(d.type==='kpw'?d.city:d.bank||'Bank pengelola belum tersedia')}</p><div class="popup-meta"><span>${i('map-pin')}${esc(d.region)}</span><span>${esc(d.id)}</span></div>${d.type==='kas'?`<div class="popup-parent"><span>KPw induk</span><button class="popup-parent-network">${esc(d.kpw)} ${i('chevron-right')}</button></div>`:d.type==='kpw'?`<button class="popup-network-button">${i('network')}${childrenOf(data,d.id).length} kas titipan${i('chevron-right')}</button>`:''}${d.type==='kpw'?readiness.popupHtml(d.id):''}<div class="popup-accuracy coordinate-state ${d.status}"><b></b>${coordinateLabel(d)}</div><div class="popup-actions"><button class="popup-detail-button">Lihat detail ${i('arrow-right')}</button><button class="popup-area-button" aria-label="Perbesar titik pada peta">${i('zoom-in')}</button></div>`;
 const popup=L.popup({className:'network-popup',maxHeight:Math.max(220,map.getSize().y-150),maxWidth:310,minWidth:250,offset:[0,-12],autoPanPaddingTopLeft:[20,75],autoPanPaddingBottomRight:[20,80],closeButton:true,autoClose:true,closeOnClick:true}).setLatLng(mapCoords(d)).setContent(content);
 popup.on('remove',()=>{if(selected===id&&!document.querySelector('.explorer').classList.contains('detail-open')){selected=null;renderMarkers();}});
 content.querySelector('.popup-network-button')?.addEventListener('click',()=>showFamily(id));content.querySelector('.popup-parent-network')?.addEventListener('click',()=>{const parent=data.find(p=>p.type==='kpw'&&p.name===d.kpw);if(parent)showFamily(parent.id);});
 content.querySelector('.popup-readiness-button')?.addEventListener('click',()=>{location.hash='sarpras/'+id;});
 content.querySelector('.popup-detail-button').onclick=()=>openDetail(id);
 content.querySelector('.popup-area-button').setAttribute('aria-label','Perbesar titik pada peta');
 content.querySelector('.popup-area-button').onclick=()=>{setMapStyle('street');map.flyTo(mapCoords(d),12,{duration:.8});};
 if(d.id==='KPW-04')mountSibolgaPreview(content,popup);
 popup.openOn(map);document.querySelector('#map-zoom-hint').classList.add('hidden');renderMarkers();refreshIcons();
}
function openDetail(id){const d=data.find(x=>x.id===id);if(!d)return;selected=id;document.querySelector('.explorer').classList.add('detail-open');map.closePopup();if(!panelOpen)setPanel(true);document.querySelector('#directory-list').classList.add('hidden');const detail=document.querySelector('#location-detail');detail.classList.remove('hidden');
 const mapsQuery=d.address?`${d.bank||d.name}, ${d.address}`:`${d.type==='kpw'?'Bank Indonesia '+d.name:(d.bank||'Bank')+' '+d.name} Indonesia`;
 detail.innerHTML=`<div class="detail-nav"><button id="detail-back">${i('arrow-left')}Daftar lokasi</button><button id="detail-close" aria-label="Tutup detail">${i('x')}</button></div><div class="detail-hero"><span class="detail-type-icon bank-brand-symbol ${d.type}">${bankLogo(d)}</span><span class="detail-type ${d.type}">${d.type==='kpw'?'KANTOR PERWAKILAN BI':d.type==='pusat'?'KANTOR PUSAT BI':'KAS TITIPAN'}</span><h2>${esc(d.name)}</h2><p>${esc(d.type==='kpw'?d.city:d.bank||'Bank pengelola belum tersedia')}</p><span class="detail-id">${esc(d.id)}<b>·</b>${esc(d.region)}</span></div><div class="detail-content">${d.type==='kpw'?readiness.popupHtml(d.id):''}<div class="detail-section-title">INFORMASI JARINGAN</div><dl>${d.type!=='pusat'?`<div><dt>KPw induk</dt><dd>${esc(d.kpw)}</dd></div>`:''}<div><dt>Bank pengelola</dt><dd>${esc(d.bank||'Belum tersedia')}</dd></div>${d.type==='kas'?`<div class="plafond"><dt>Plafon dalam file sumber</dt><dd>${money(d.plafond)}</dd></div>`:''}</dl><div class="location-certainty coordinate-state ${d.status}">${i('locate-fixed')}<div><strong>${coordinateLabel(d)}</strong><p>${esc(d.address||'Alamat belum tersedia')}</p><details class="location-source-more"><summary>Catatan sumber</summary><p>${esc(d.submissionNotes||'Belum ada catatan tambahan.')}</p></details>${/^https?:\/\//.test(d.sourceUrl)?`<a target="_blank" rel="noopener noreferrer" href="${esc(d.sourceUrl)}">Lihat sumber alamat ${i('arrow-up-right')}</a>`:''}</div></div><button id="view-area" class="area-button" ${hasCoords(d)?'':'disabled'}>${i('zoom-in')}${hasCoords(d)?'Perbesar lokasi':'Koordinat belum tersedia'}</button><a class="primary-button maps-link" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}">Cari kantor di Google Maps ${i('arrow-up-right')}</a><div class="detail-source">${i('file-spreadsheet')}<div><span>SUMBER DATA</span><p>${esc(d.source)}</p></div></div></div>`;
 detail.querySelector('.popup-readiness-button')?.addEventListener('click',()=>{location.hash='sarpras/'+id;});
 document.querySelector('#view-area').onclick=()=>{if(!hasCoords(d))return;setMapStyle('street');map.flyTo(mapCoords(d),12,{duration:.8});if(matchMedia('(max-width:640px)').matches){document.querySelector('.explorer').classList.remove('detail-open');setPanel(false);document.querySelector('.map-frame').scrollIntoView({behavior:'smooth',block:'center'});}};
 document.querySelector('#detail-back').innerHTML=i('arrow-left')+(directoryParentId?'Kembali ke KPw':'Daftar KPw');document.querySelector('#detail-back').onclick=()=>{closeDetail();render();};document.querySelector('#detail-close').onclick=()=>{closeDetail();render();setPanel(false);};
 const context=document.querySelector('#map-context');context.innerHTML=`<b class="dot ${d.type==='kpw'?'cyan':'amber'}"></b><span>${esc(d.type==='kpw'?'KPw '+d.name:d.name)}<small>${coordinateLabel(d)}</small></span><button id="context-close" aria-label="Hapus pilihan">${i('x')}</button>`;context.classList.remove('hidden');document.querySelector('#context-close').onclick=()=>{closeDetail();render();nationalView(true);};
 if(hasCoords(d))map.flyTo(mapCoords(d),12,{duration:.8});renderMarkers();refreshIcons();
}
function showToast(message){clearTimeout(toastTimer);const toast=document.querySelector('#toast');toast.innerHTML=`${i('check')}<span>${esc(message)}</span>`;toast.classList.remove('hidden');refreshIcons();toastTimer=setTimeout(()=>toast.classList.add('hidden'),4500);}
function openAudit(){lastFocus=document.activeElement;document.querySelector('#audit-modal').classList.remove('hidden');document.querySelector('#audit-close').focus();}
function closeAudit(){document.querySelector('#audit-modal').classList.add('hidden');lastFocus?.focus();}
document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>setType(b.dataset.type));document.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>setType(b.dataset.metric));
document.querySelector('#search').oninput=e=>{query=e.target.value;render();};document.querySelector('#region').onchange=e=>{region=e.target.value;closeDetail();render();updateViewForRows();};document.querySelector('#clear-filters').onclick=()=>clearFilters();document.querySelector('#coordinate-filter').onchange=e=>{coordinateFilter=e.target.value;closeDetail();render();updateViewForRows();};
document.querySelector('#zoom-in').onclick=()=>map.zoomIn();document.querySelector('#zoom-out').onclick=()=>map.zoomOut();document.querySelector('#reset').onclick=()=>{closeDetail();render();nationalView(true);};document.querySelector('#panel-toggle').onclick=()=>setPanel(!panelOpen);
const layersButton=document.querySelector('#layers');layersButton.onclick=()=>{const open=document.querySelector('#layer-menu').classList.toggle('hidden')===false;layersButton.setAttribute('aria-expanded',String(open));};
document.addEventListener('click',e=>{if(!e.target.closest('#layer-menu')&&!e.target.closest('#layers')){document.querySelector('#layer-menu').classList.add('hidden');layersButton.setAttribute('aria-expanded','false');}});
document.querySelectorAll('[data-basemap]').forEach(b=>b.onclick=()=>setMapStyle(b.dataset.basemap,true));
['help','validation','data-note','missing-data','review-info'].forEach(id=>document.getElementById(id).onclick=openAudit);document.querySelector('#audit-close').onclick=closeAudit;document.querySelector('#audit-done').onclick=closeAudit;document.querySelector('#audit-modal').onclick=e=>{if(e.target.id==='audit-modal')closeAudit();};
document.addEventListener('keydown',e=>{const modalOpen=!document.querySelector('#audit-modal').classList.contains('hidden');if(modalOpen&&e.key==='Tab'){const elements=[...document.querySelectorAll('#audit-modal button')];if(e.shiftKey&&document.activeElement===elements[0]){e.preventDefault();elements.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===elements.at(-1)){e.preventDefault();elements[0].focus();}}if(e.key==='Escape'){if(modalOpen)closeAudit();else if(distanceOpen)toggleDistance(false);else if(selected){closeDetail();render();}else if(panelOpen){if(directoryParentId)showFamily(null);else setPanel(false);}document.querySelector('#layer-menu').classList.add('hidden');layersButton.setAttribute('aria-expanded','false');}if(e.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)&&!modalOpen){e.preventDefault();if(selected)closeDetail();if(!panelOpen)setPanel(true);document.querySelector('#search').focus();}});
const measure=createMapMeasure({map,icon:i,refreshIcons,onToggle:open=>{distanceOpen=open;if(open){document.querySelector('.rainfall-panel')?.classList.add('hidden');document.querySelector('.slope-panel')?.classList.add('hidden');document.querySelector('.inarisk-panel')?.classList.add('hidden');document.querySelector('#inarisk-toggle')?.setAttribute('aria-expanded','false');document.querySelector('#layer-menu').classList.add('hidden');if(panelOpen)setPanel(false);}}});
function toggleDistance(open){measure.setOpen(open);}
function showFamily(id){directoryParentId=id;directory.setParent(id);query='';document.querySelector('#search').value='';closeDetail();setPanel(true);render();document.querySelector('#directory-back').focus({preventScroll:true});updateViewForRows();}
const directory=createDirectory({data,icon:i,escape:esc,coordinateLabel,onFamily:showFamily,onLocation:openDetail,onMap:()=>{setPanel(false);updateViewForRows();},onReadiness:id=>{location.hash='sarpras/'+id;},onClose:()=>setPanel(false)});
document.querySelector('#directory-filter-toggle').onclick=()=>{const hidden=document.querySelector('#directory-advanced').classList.toggle('hidden');document.querySelector('#directory-filter-toggle').setAttribute('aria-expanded',String(!hidden));};
const readiness=createReadiness({data,sourceReadiness,icons,refreshIcons,onAbout:openAudit,onMap:id=>{location.hash=id?'peta/'+id:'peta';}});
const news = createNews({onUpdate: snapshot => watch.update(snapshot)});
const watch = mountNewsWatch({
  map, locations: data, readiness: sourceReadiness,
  onActive: (active, refresh) => news.setMapActive(active, refresh),
});
function applyWorkspace(){const [view,id]=location.hash.slice(1).split('/');const isReadiness=view==='sarpras',isNews=view==='berita';document.querySelector('#news-nav').classList.toggle('active',isNews);document.querySelector('#news-nav').setAttribute('aria-current',isNews?'page':'false');watch.setVisible(!isReadiness&&!isNews);if(isNews)news.show();else news.hide();document.querySelector('#peta').classList.toggle('hidden',isReadiness||isNews);document.querySelector('.app-main').classList.toggle('readiness-active',isReadiness);document.querySelector('#map-nav').classList.toggle('active',!isReadiness&&!isNews);document.querySelector('#readiness-nav').classList.toggle('active',isReadiness);document.querySelector('#map-nav').setAttribute('aria-current',isReadiness||isNews?'false':'page');document.querySelector('#readiness-nav').setAttribute('aria-current',isReadiness?'page':'false');document.querySelector('.map-title h1').textContent=isNews?'Berita kebencanaan':isReadiness?'Kesiapan Sarpras':'Asesmen Risiko Banjir';document.querySelector('.title-tag').innerHTML=i('globe')+(isReadiness?'46 KPw':'Indonesia');
 if(isNews){toggleDistance(false);map.closePopup();readiness.hide();}else if(isReadiness){toggleDistance(false);map.closePopup();readiness.show(id);}else{readiness.hide();clearFilters();setPanel(false);requestAnimationFrame(()=>{map.invalidateSize({pan:false});if(id&&data.some(d=>d.id===id)){directoryParentId=null;directory.setParent(null);query='';document.querySelector('#search').value='';render();openLocation(id);}else if(!selected)nationalView();});}refreshIcons();}
window.addEventListener('hashchange',applyWorkspace);document.querySelector('#readiness-header').onclick=()=>{location.hash=location.hash.startsWith('#sarpras')?'peta':'sarpras';};
// A restrained pointer glow on application chrome; map controls keep normal interactions.
if(matchMedia('(pointer:fine) and (prefers-reduced-motion:no-preference)').matches){let frame;document.addEventListener('pointermove',e=>{if(e.target.closest('.map-frame'))return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{document.documentElement.style.setProperty('--pointer-x',e.clientX+'px');document.documentElement.style.setProperty('--pointer-y',e.clientY+'px');});},{passive:true});}
map.on('moveend',()=>{const node=document.querySelector('#map');node.dataset.viewZoom=String(map.getZoom());node.dataset.viewCenter=map.getCenter().lat.toFixed(6)+','+map.getCenter().lng.toFixed(6);renderMarkers();document.querySelector('#map-zoom-hint').classList.toggle('hidden',mapStyle!=='street'||map.getZoom()>=13||!!selected);});
new ResizeObserver(()=>{
 clearTimeout(resizeTimer);
 resizeTimer=setTimeout(()=>{
  if(!mapHasSize())return;
  map.invalidateSize({animate:false});
  // A resize may change the zoom floor, but should never move the current view.
  const zoom=map.getZoom();
  map.setMinZoom(Math.min(zoom,nationalZoom()));
  renderMarkers();
 },120);
}).observe(document.querySelector('#map'));
map.invalidateSize();nationalView();setMapStyle('satellite');render();
function openLayerSettings(target){
 setPanel(false);
 toggleDistance(false);
 document.querySelector('#layer-menu').classList.add('hidden');
 showLayerPanel(target);
}
mountInarisk({map,bounds,refreshIcons,onAbout:openAudit,onOpen:()=>openLayerSettings('inarisk')});
const rainfall=mountRainfall({map,bounds,refreshIcons,onOpen:()=>openLayerSettings('rainfall')});
mountSlope({map,bounds,refreshIcons,onOpen:()=>openLayerSettings('slope')});
const layerPanels=[['rainfall','Hujan'],['slope','Lereng'],['inarisk','Banjir']];
for(const [id] of layerPanels){const panel=document.querySelector('.'+id+'-panel');const tabs=document.createElement('nav');tabs.className='layer-panel-tabs';tabs.setAttribute('aria-label','Pengaturan layer');tabs.innerHTML=layerPanels.map(([target,label])=>`<button data-layer-panel="${target}" aria-current="${target===id}">${label}</button>`).join('');panel.prepend(tabs);}
function showLayerPanel(target){
 document.querySelector('.'+target+'-panel').scrollTop=0;
 for(const [id] of layerPanels)document.querySelector('.'+id+'-panel').classList.toggle('hidden',id!==target);
 document.querySelector('#inarisk-toggle').setAttribute('aria-expanded',String(target==='inarisk'));
}
document.addEventListener('click',event=>{const tab=event.target.closest('[data-layer-panel]');if(tab)showLayerPanel(tab.dataset.layerPanel);});
document.querySelector('#risk-settings').onclick=()=>openLayerSettings('inarisk');
document.querySelector('#layer-settings').onclick=()=>openLayerSettings('rainfall');
applyWorkspace();
mountInteractionEffects(document.querySelector("#app"));

}
init().catch(error=>{console.error(error);document.querySelector('#app').innerHTML='<div class="load-error"><h1>Peta belum dapat dimuat.</h1><p>Periksa koneksi dan muat ulang halaman.</p><button onclick="location.reload()">Coba lagi</button></div>';});
