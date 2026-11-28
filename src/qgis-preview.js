import L from 'leaflet';
import './qgis-preview.css';

const exports = import.meta.glob('./qgis-exports/sibolga.{png,webp}', {
  eager: true, query: '?url', import: 'default',
});
const sibolgaExport = Object.values(exports)[0];
export const hasSibolgaExport = Boolean(sibolgaExport);
const title = 'Peta QGIS · Sibolga';

export function mountSibolgaPreview(content, popup) {
  const section = document.createElement('section');
  section.className = 'qgis-preview';
  section.innerHTML = `
    <h4>${title}</h4>
    <p role="status"></p>
    <div class="qgis-viewport" aria-label="${title}" hidden></div>
    <button type="button" class="qgis-reset" hidden>Pas ke bingkai</button>
    <a class="qgis-download" download="Peta-QGIS-Sibolga.webp" hidden>Unduh gambar QGIS</a>
  `;
  content.querySelector('.popup-meta').after(section);
  const status = section.querySelector('[role=status]');
  const viewport = section.querySelector('.qgis-viewport');
  const reset = section.querySelector('.qgis-reset');
  const download = section.querySelector('.qgis-download');
  L.DomEvent.disableClickPropagation(viewport);
  L.DomEvent.disableScrollPropagation(viewport);
  let viewer;

  popup.on('add', async () => {
    status.textContent = 'Memuat pratinjau peta…';
    const image = new Image();
    image.alt = title;
    image.src = sibolgaExport;
    try {
      await image.decode();
    } catch {
      status.textContent = 'Pratinjau peta gagal dimuat.';
      return;
    }
    if (!viewport.isConnected) return;
    viewport.hidden = false;
    reset.hidden = false;
    download.href = sibolgaExport;
    download.download = 'Peta-QGIS-Sibolga.' + (sibolgaExport.split('.').pop()==='png' ? 'png' : 'webp');
    download.hidden = false;
    status.textContent = 'Gulir untuk zoom, lalu geser gambar untuk melihat detail.';
    popup.update();
    const bounds = L.latLngBounds([[0, 0], [image.naturalHeight, image.naturalWidth]]);
    viewer = L.map(viewport, {
      crs: L.CRS.Simple, scrollWheelZoom: true, zoomAnimation: false, attributionControl: false,
      minZoom: -20, zoomSnap: 0, zoomDelta: 0.5,
      maxBounds: bounds.pad(.3), maxBoundsViscosity: 1,
    });
    viewer.fitBounds(bounds, {animate: false});
    const fitZoom = viewer.getZoom();
    viewer.setMinZoom(fitZoom).setMaxZoom(fitZoom + 5);
    L.imageOverlay(image, bounds).addTo(viewer);
    reset.onclick = () => {
      viewer.invalidateSize({pan: false});
      viewer.setView(bounds.getCenter(), fitZoom, {animate: false});
    };
  });
  popup.on('remove', () => viewer?.remove());
}
