import {createRainfallTiles} from './rainfall-tiles.js';
import L from 'leaflet';
import {RAINFALL_SOURCE, rainfallPeriods, rainfallValue} from './rainfall-data.js';
import './rainfall.css';
const labelDate = value => new Intl.DateTimeFormat('id-ID', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(value + 'T00:00:00Z'));
export function mountRainfall({map, refreshIcons, onOpen}) {
  const button = document.createElement('button');
  button.id = 'rainfall-toggle'; button.title = 'Prakiraan curah hujan'; button.setAttribute('aria-label', 'Prakiraan curah hujan'); button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<i data-lucide="cloud-rain"></i><span>Prakiraan hujan</span>';
  document.querySelector('#assessment-layer-buttons').append(button);
  const periods = rainfallPeriods();
  const panel = document.createElement('section'); panel.className = 'rainfall-panel hidden'; panel.setAttribute('aria-label', 'Prakiraan curah hujan Indonesia');
  panel.innerHTML = `<div class="rainfall-head"><div><span class="rainfall-kicker">PRAKIRAAN / INDONESIA</span><h2>Curah hujan</h2></div><button id="rainfall-close" aria-label="Tutup panel curah hujan"><i data-lucide="x"></i></button></div>
    <p class="rainfall-source">${RAINFALL_SOURCE.name} · ${RAINFALL_SOURCE.resolution}<br>Run ${labelDate(RAINFALL_SOURCE.runDate)} · tanggal sumber UTC</p>
    <p class="rainfall-source">CHIRPS3: inframerah satelit geostasioner dan data stasiun hujan. Prakiraan: model ensemble GEFS dari NOAA.</p>
    <label class="rainfall-period">Periode prakiraan<select id="rainfall-week" aria-label="Pekan prakiraan">${periods.map(period => `<option value="${period.id}">${period.label} · ${labelDate(period.start)} – ${labelDate(period.end)}</option>`).join('')}</select></label>
    <div id="rainfall-status" role="status">Menyiapkan prakiraan…</div>
    <p id="rainfall-expired" class="hidden">Periode prakiraan ini sudah berakhir. Data ditampilkan sebagai arsip run sumber.</p>
    <h3>Rata-rata curah hujan <span>(mm/hari)</span></h3><div class="rainfall-gradient"></div><div class="rainfall-scale">${RAINFALL_SOURCE.thresholds.map((value, index) => `<span style="background:#${RAINFALL_SOURCE.palette[index]};color:${index >= 6 ? '#fff' : '#17242b'}">${index === 9 ? '80+' : value}</span>`).join('')}</div>
    <div id="rainfall-point" role="status">Klik lokasi di peta untuk membaca nilai dari sel sumber.</div>
    <label class="rainfall-opacity">Opasitas layer <span id="rainfall-opacity-value">70%</span><input id="rainfall-opacity" aria-label="Opasitas curah hujan" type="range" min="0" max="100" value="70"></label>
    <div class="rainfall-actions"><button id="rainfall-retry">Muat ulang layer</button><button id="rainfall-off">Matikan layer</button></div>
    <details><summary>Sumber & cara baca</summary><p>CHIRPS3-GEFS, run 17 November 2026, dari GeoTIFF pengguna. Rerata 7 hari; nilai negatif dan sel tanpa 7 hari lengkap di-mask. Angka titik dibaca pada grid sumber, bukan ditebak dari warna gambar.</p><p>Tile dirender ulang pada setiap tingkat zoom dari grid sumber, dengan interpolasi bilinear dalam proyeksi Web Mercator. Resolusi prakiraan tetap ±5,6 km; zoom tidak menambah ketelitian data. Batas Indonesia menggunakan Natural Earth skala 1:10 juta, berbeda dari LSIB 2017 pada script Earth Engine. Prakiraan curah hujan bukan kelas risiko banjir.</p></details>`;
  panel.querySelector('.rainfall-gradient').style.background = `linear-gradient(90deg,${RAINFALL_SOURCE.palette.map(color => '#' + color).join(',')})`;
  document.querySelector('.map-frame').append(panel);
  map.createPane('rainfallOverlay'); map.getPane('rainfallOverlay').style.zIndex = 485; map.getPane('rainfallOverlay').style.pointerEvents = 'none';
  let layer = null, manifest = null, activeWeek = null, requested = false, generation = 0, pending = null, sampleRequest = 0, lastPoint = null, boundary = null;
  const grids = new Map();
  const select = panel.querySelector('#rainfall-week'), status = panel.querySelector('#rainfall-status'), point = panel.querySelector('#rainfall-point');
  const write = (message, error = false) => { status.textContent = message; status.classList.toggle('error', error); };
  const active = value => { button.classList.toggle('active', value); button.setAttribute('aria-pressed', String(value)); };
  const updatePeriod = () => { const period = periods.find(item => item.id === select.value); panel.querySelector('#rainfall-expired').classList.toggle('hidden', Date.now() < Date.parse(period.end + 'T00:00:00Z') + 86400000); };
  function cancelPending() { if (pending) { clearTimeout(pending.timer); pending.image.remove(); pending.image.off(); pending = null; } }
  function disable() {
    requested = false; generation++; sampleRequest++; cancelPending(); layer?.remove(); layer?.off(); layer = null; activeWeek = null; active(false); panel.classList.add('hidden');
  }
  async function sample(latlng) {
    if (!activeWeek || !manifest) return;
    const token = ++sampleRequest, week = activeWeek;
    lastPoint = latlng; point.textContent = 'Membaca sel sumber…';
    try {
      const period = manifest.periods.find(item => item.id === week);
      if (!grids.has(week)) {
        const response = await fetch(period.grid, {signal: AbortSignal.timeout(15000)});
        if (!response.ok) throw Error();
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength !== manifest.grid.width * manifest.grid.height * 4) throw Error();
        grids.set(week, buffer);
      }
      if (token !== sampleRequest || week !== activeWeek) return;
      const value = rainfallValue(grids.get(week), manifest.grid, latlng.lat, latlng.lng);
      point.textContent = value === null ? 'Data tidak tersedia di titik ini.' : `${new Intl.NumberFormat('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(value)} mm/hari · ${period.label} · ${latlng.lat.toFixed(3)}°, ${latlng.lng.toFixed(3)}°`;
    } catch { if (token === sampleRequest) point.textContent = 'Nilai sel belum dapat dibaca. Klik lokasi untuk mencoba lagi.'; }
  }
  async function enable(force = false, openPanel = true) {
    const token = ++generation, week = select.value;
    sampleRequest++; cancelPending(); requested = true;
    if (openPanel) { panel.classList.remove('hidden'); onOpen?.(); }
    updatePeriod(); write('Memuat prakiraan…');
    try {
      if (!manifest || force) {
        const response = await fetch('/rainfall/manifest.json', {signal: AbortSignal.timeout(15000), cache: force ? 'reload' : 'default'});
        if (!response.ok) throw Error();
        const next = await response.json(); if (token !== generation) return;
        if (!Array.isArray(next.periods) || next.runDate !== RAINFALL_SOURCE.runDate || next.grid?.crs !== 'EPSG:4326') throw Error();
        manifest = next;
      }
      if (token !== generation) return;
      const period = manifest.periods.find(item => item.id === week);
      if (!period || !/^\/rainfall\/week[12]-render\.f32$/.test(period.renderGrid)) throw Error();
      const [raster, coastline] = await Promise.all([
        fetch(period.renderGrid, {signal: AbortSignal.timeout(15000), cache: force ? 'reload' : 'default'}).then(async response => { if (!response.ok) throw Error(); return response.arrayBuffer(); }),
        boundary ? Promise.resolve(boundary) : fetch('/rainfall/boundary.geojson').then(response => { if (!response.ok) throw Error(); return response.json(); }),
      ]);
      if (token !== generation) return;
      if (raster.byteLength !== manifest.grid.width * manifest.grid.height * 4) throw Error();
      boundary = coastline;
      const image = createRainfallTiles({buffer: raster, grid: manifest.grid, boundary, week, bounds: [[-12, 93], [8.1, 143.1]]});
      const fail = () => {
        if (token !== generation) return;
        cancelPending(); if (!openPanel && !layer) requested = false; write('Gambar prakiraan gagal dimuat.' + (layer ? ' Layer sebelumnya tetap ditampilkan.' : ' Coba muat ulang layer.'), true);
        if (activeWeek) select.value = activeWeek;
        updatePeriod();
      };
      pending = {image, timer: setTimeout(fail, 18000)};
      image.on('tileerror', fail);
      image.once('load', () => {
        if (token !== generation) { image.remove(); image.off(); return; }
        clearTimeout(pending?.timer); pending = null;
        layer?.remove(); layer?.off(); layer = image; activeWeek = week;
        image.setOpacity(Number(panel.querySelector('#rainfall-opacity').value) / 100); active(true);
        write(`${period.label} aktif · rerata mm/hari`);
        if (lastPoint) sample(lastPoint); else point.textContent = 'Klik lokasi di peta untuk membaca nilai dari sel sumber.';
      });
      image.addTo(map);
    } catch {
      if (token !== generation) return;
      if (!openPanel && !layer) requested = false;
      write('Prakiraan belum dapat dimuat.' + (layer ? ' Layer sebelumnya tetap ditampilkan.' : ' Coba muat ulang layer.'), true);
      if (activeWeek) select.value = activeWeek;
      updatePeriod();
    }
  }
  button.onclick = () => {
    if (requested) disable();
    else if (layer) { panel.classList.remove('hidden'); onOpen?.(); }
    else enable();
  };
  select.onchange = () => enable();
  panel.querySelector('#rainfall-retry').onclick = () => enable(true);
  panel.querySelector('#rainfall-off').onclick = disable;
  panel.querySelector('#rainfall-close').onclick = () => panel.classList.add('hidden');
  panel.querySelector('#rainfall-opacity').oninput = event => { panel.querySelector('#rainfall-opacity-value').textContent = event.target.value + '%'; layer?.setOpacity(Number(event.target.value) / 100); };
  map.on('click', event => { if (layer && !panel.classList.contains('hidden') && !document.querySelector('.map-frame').classList.contains('measuring')) sample(event.latlng); });
  refreshIcons();
  return {start() { if (!requested) enable(false, false); }, disable, sample, closePanel() { panel.classList.add('hidden'); }};
}
