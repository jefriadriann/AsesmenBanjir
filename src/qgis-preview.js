import L from 'leaflet';
import './qgis-preview.css';

let sibolgaExport;

export function mountSibolgaPreview(content, popup) {
  const section = document.createElement('section');
  section.className = 'qgis-preview';
  section.innerHTML = `
    <h4>Peta QGIS · Sibolga</h4>
    <label>Impor gambar hasil ekspor QGIS<input type="file" accept="image/png,image/jpeg,image/webp"></label>
    <p role="status"></p>
    <div class="qgis-viewport" aria-label="Pratinjau QGIS Sibolga" hidden></div>
    <button type="button" class="qgis-reset" hidden>Pas ke bingkai</button>
  `;
  content.querySelector('.popup-meta').after(section);
  L.DomEvent.disableClickPropagation(section);
  L.DomEvent.disableScrollPropagation(section.querySelector('.qgis-viewport'));
  const input = section.querySelector('input');
  const status = section.querySelector('[role=status]');
  const viewport = section.querySelector('.qgis-viewport');
  const reset = section.querySelector('.qgis-reset');
  let viewer, imageUrl, revision = 0;

  async function show(file) {
    const request = ++revision;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.alt = 'Hasil ekspor QGIS Sibolga';
    image.src = url;
    try {
      await image.decode();
      if (request !== revision) return;
      viewer?.remove();
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      imageUrl = url;
      sibolgaExport = file;
      viewport.hidden = false;
      reset.hidden = false;
      popup.update();
      const bounds = [[0, 0], [image.naturalHeight, image.naturalWidth]];
      viewer = L.map(viewport, {
        crs: L.CRS.Simple, scrollWheelZoom: false, attributionControl: false,
        minZoom: -20, zoomSnap: 0, zoomDelta: 1,
        maxBounds: L.latLngBounds(bounds).pad(.3), maxBoundsViscosity: 1,
      });
      viewer.fitBounds(bounds, {animate: false});
      const fitZoom = viewer.getZoom();
      viewer.setMinZoom(fitZoom).setMaxZoom(fitZoom + 5);
      L.imageOverlay(image, bounds).addTo(viewer);
      reset.onclick = () => {
        viewer.invalidateSize({pan: false});
        viewer.setView(L.latLngBounds(bounds).getCenter(), fitZoom, {animate: false});
      };
      status.textContent = 'Gunakan + dan − untuk zoom, lalu geser gambar.';
    } catch {
      if (request === revision) status.textContent = 'Gambar gagal dimuat. Pilih file PNG, JPG, atau WebP.';
    } finally {
      if (imageUrl !== url) URL.revokeObjectURL(url);
    }
  }

  input.onchange = () => {
    const file = input.files[0];
    if (file) show(file);
  };
  popup.on('add', () => {
    if (sibolgaExport) show(sibolgaExport);
    else status.textContent = 'Pilih file untuk melihat hasil QGIS di popup ini.';
  });
  popup.on('remove', () => {
    revision++;
    viewer?.remove();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  });
}
