import L from 'leaflet';
import {createRainfallRenderer} from './rainfall-render.js';

export function createRainfallTiles({buffer, grid, boundary, week, bounds}) {
  // Project coastline vertices once to zoom-zero world pixels, then scale per tile.
  const polygons = boundary.features.flatMap(feature => feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates]).map(polygon => {
    const rings = polygon.map(ring => ring.map(([lng, lat]) => { const p = L.CRS.EPSG3857.latLngToPoint(L.latLng(lat, lng), 0); return [p.x, p.y]; }));
    const outer = rings[0];
    return {rings, minX: Math.min(...outer.map(p => p[0])), maxX: Math.max(...outer.map(p => p[0])), minY: Math.min(...outer.map(p => p[1])), maxY: Math.max(...outer.map(p => p[1]))};
  });
  const input = {buffer, grid};
  function drawClipped(tile, raster, coords, visible) {
    const context = tile.getContext('2d'), scale = 2 ** coords.z;
    const left = coords.x * 256, top = coords.y * 256;
    context.save();
    context.beginPath();
    for (const polygon of visible) for (const ring of polygon.rings) {
      ring.forEach(([x, y], index) => {
        const px = x * scale - left, py = y * scale - top;
        if (index) context.lineTo(px, py); else context.moveTo(px, py);
      });
      context.closePath();
    }
    context.clip('evenodd');
    context.drawImage(raster, 0, 0);
    context.restore();
  }
  let worker, fallback, nextId = 0;
  const pending = new Map(), tileIds = new WeakMap();
  function drawOnMain(tile, coords, visible, done) {
    window.setTimeout(() => {
      if (!tileIds.has(tile)) return;
      try {
        fallback ??= createRainfallRenderer(input);
        const raster = document.createElement('canvas'); raster.width = raster.height = 256;
        drawClipped(tile, fallback(raster, coords), coords, visible);
        done(null, tile);
      } catch (error) { done(error, tile); }
    });
  }
  function switchToMainThread() {
    worker?.terminate();
    worker = null;
    for (const {tile, coords, visible, done} of pending.values()) drawOnMain(tile, coords, visible, done);
    pending.clear();
  }
  const Rainfall = L.GridLayer.extend({
    onAdd(map) {
      if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
        try {
          worker = new Worker(new URL('./rainfall-worker.js', import.meta.url), {type: 'module'});
          worker.onmessage = ({data: {id, bitmap, error}}) => {
            const job = pending.get(id);
            if (job) {
              pending.delete(id);
              if (error) drawOnMain(job.tile, job.coords, job.visible, job.done);
              else {
                drawClipped(job.tile, bitmap, job.coords, job.visible);
                job.done(null, job.tile);
              }
            }
            bitmap?.close();
          };
          worker.onerror = switchToMainThread;
          worker.postMessage({input});
        } catch { switchToMainThread(); }
      }
      L.GridLayer.prototype.onAdd.call(this, map);
    },
    onRemove(map) {
      L.GridLayer.prototype.onRemove.call(this, map);
      worker?.terminate();
      worker = null;
      pending.clear();
    },
    createTile(coords, done) {
      const tile = document.createElement('canvas'); tile.width = tile.height = 256;
      tile.dataset.week = week; tile.dataset.tile = `${coords.z}/${coords.x}/${coords.y}`;
      const scale = 2 ** coords.z, left = coords.x * 256, top = coords.y * 256;
      const visible = polygons.filter(p => p.maxX * scale >= left && p.minX * scale <= left + 256
        && p.maxY * scale >= top && p.minY * scale <= top + 256);
      const id = ++nextId;
      const point = {x: coords.x, y: coords.y, z: coords.z};
      tileIds.set(tile, id);
      if (!visible.length) {
        requestAnimationFrame(() => { if (tileIds.has(tile)) done(null, tile); });
      } else if (worker) {
        pending.set(id, {tile, coords: point, visible, done});
        worker.postMessage({id, coords: point});
      } else drawOnMain(tile, point, visible, done);
      return tile;
    },
  });
  const layer = new Rainfall({pane: 'rainfallOverlay', bounds, noWrap: true, minZoom: 3, maxZoom: 19, tileSize: 256,
    keepBuffer: 2, updateWhenIdle: true, updateWhenZooming: false, opacity: 0, attribution: 'CHIRPS3-GEFS · GeoTIFF pengguna'});
  layer.on('tileunload', ({tile}) => {
    pending.delete(tileIds.get(tile));
    tileIds.delete(tile);
  });
  return layer;
}
