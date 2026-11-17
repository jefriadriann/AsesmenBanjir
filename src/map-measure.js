import L from 'leaflet';
import {measurePath} from './distance.js';

export function createMapMeasure({map, icon, refreshIcons, onToggle}) {
  const host = document.querySelector('#distance-panel');
  const button = document.querySelector('#map-measure');
  const layer = L.layerGroup().addTo(map), preview = L.layerGroup().addTo(map);
  let points = [], active = false, finished = false, restoreDoubleClick = false;
  map.createPane('measureLine'); map.getPane('measureLine').style.zIndex = 650;
  const options = {pane: 'measureLine', interactive: false};
  const format = meters => meters < 1000 ? `${new Intl.NumberFormat('id-ID', {maximumFractionDigits: 0}).format(meters)} m` : `${new Intl.NumberFormat('id-ID', {maximumFractionDigits: 2}).format(meters / 1000)} km`;

  function render() {
    layer.clearLayers(); preview.clearLayers();
    const result = measurePath(points);
    if (points.length > 1) {
      L.polyline(result.line, {...options, color: '#ffffff', weight: 7, opacity: .9}).addTo(layer);
      L.polyline(result.line, {...options, color: '#1761ed', weight: 3.5}).addTo(layer);
    }
    points.forEach((point, index) => L.circleMarker(point, {...options, radius: index === 0 || index === points.length - 1 ? 6 : 4, color: '#092b6b', weight: 2, fillColor: '#ffcf3e', fillOpacity: 1}).addTo(layer));
    host.innerHTML = `<div class="distance-head"><span class="distance-tool-icon">${icon('ruler')}</span><div><span class="section-kicker">GAMBAR DI PETA</span><h2>Ukur jarak</h2></div><button id="distance-close" aria-label="Tutup pengukuran">${icon('x')}</button></div>
      <p class="distance-intro">${finished ? 'Garis selesai. Mulai garis baru untuk mengukur lagi.' : 'Klik atau ketuk peta untuk menggambar garis. Tambahkan belokan, lalu tekan Selesai.'}</p>
      <div id="distance-result" class="distance-result" role="status" data-point-count="${points.length}" data-meters="${result.meters}"><span class="distance-result-label">${points.length ? `${points.length} TITIK · ${Math.max(0, points.length - 1)} RUAS` : 'MULAI DENGAN KLIK PETA'}</span><div class="distance-number">${format(result.meters)}</div></div>
      <div class="measure-actions"><button id="distance-undo" ${!points.length || finished ? 'disabled' : ''}>${icon('arrow-left')}Urungkan</button><button id="distance-finish" ${points.length < 2 || finished ? 'disabled' : ''}>${icon('check')}Selesai</button><button id="distance-clear">${icon('plus')}Garis baru</button></div>
      <p class="distance-method">Jarak geodesik WGS84 sepanjang garis yang digambar, bukan rute jalan atau batas banjir.</p>`;
    host.querySelector('#distance-close').onclick = () => setOpen(false);
    host.querySelector('#distance-undo').onclick = () => { points.pop(); render(); };
    host.querySelector('#distance-clear').onclick = () => { points = []; finished = false; render(); };
    host.querySelector('#distance-finish').onclick = () => { finished = true; render(); };
    refreshIcons();
  }
  function add(coords) {
    if (!active || finished) return;
    const last = points.at(-1);
    if (last && Math.abs(last[0] - coords[0]) + Math.abs(last[1] - coords[1]) < 1e-8) return;
    points.push(coords); render();
  }
  function setOpen(open) {
    if (open === active) return;
    active = open;
    onToggle(open);
    host.classList.toggle('hidden', !open);
    document.querySelector('.map-frame').classList.toggle('measuring', open);
    button.classList.toggle('active', open); button.setAttribute('aria-pressed', String(open));
    if (open) {
      restoreDoubleClick = map.doubleClickZoom.enabled(); map.doubleClickZoom.disable(); map.closePopup(); render();
    } else {
      if (restoreDoubleClick) map.doubleClickZoom.enable();
      layer.clearLayers(); preview.clearLayers(); button.focus({preventScroll: true});
    }
  }
  map.on('click', event => add([event.latlng.lat, event.latlng.lng]));
  map.on('mousemove', event => {
    preview.clearLayers();
    if (!active || finished || !points.length) return;
    const result = measurePath([points.at(-1), [event.latlng.lat, event.latlng.lng]]);
    L.polyline(result.line, {...options, color: '#1761ed', weight: 2, dashArray: '5 6', opacity: .7}).addTo(preview);
  });
  map.on('mouseout', () => preview.clearLayers());
  const mapNode = map.getContainer(); mapNode.tabIndex = 0;
  mapNode.addEventListener('keydown', event => {
    if (!active || !['Enter', 'Backspace', 'Delete'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Enter') { const center = map.getCenter(); add([center.lat, center.lng]); }
    else if (!finished) { points.pop(); render(); }
  });
  button.onclick = () => setOpen(!active);
  return {setOpen, add};
}
