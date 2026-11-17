import L from 'leaflet';
import {interpolateRainfall, rainfallColor, rainfallTileCoordinate} from './rainfall-data.js';

export function createRainfallTiles({buffer, grid, boundary, week, bounds}) {
  const values = new Float32Array(buffer);
  const colors = new Uint8ClampedArray(8001 * 4);
  for (let n = 0; n <= 8000; n++) colors.set(rainfallColor(n / 100), n * 4);
  // Project coastline vertices once to zoom-zero world pixels, then scale per tile.
  const polygons = boundary.features.flatMap(feature => feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates]).map(polygon => {
    const rings = polygon.map(ring => ring.map(([lng, lat]) => { const p = L.CRS.EPSG3857.latLngToPoint(L.latLng(lat, lng), 0); return [p.x, p.y]; }));
    const outer = rings[0];
    return {rings, minX: Math.min(...outer.map(p => p[0])), maxX: Math.max(...outer.map(p => p[0])), minY: Math.min(...outer.map(p => p[1])), maxY: Math.max(...outer.map(p => p[1]))};
  });
  const Rainfall = L.GridLayer.extend({
    createTile(coords) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      canvas.dataset.week = week; canvas.dataset.tile = `${coords.z}/${coords.x}/${coords.y}`;
      const context = canvas.getContext('2d'), scale = 2 ** coords.z;
      const left = coords.x * 256, top = coords.y * 256;
      const visible = polygons.filter(p => p.maxX * scale >= left && p.minX * scale <= left + 256 && p.maxY * scale >= top && p.minY * scale <= top + 256);
      if (!visible.length) return canvas;
      const raster = document.createElement('canvas'); raster.width = raster.height = 256;
      const raw = raster.getContext('2d'), pixels = raw.createImageData(256, 256);
      const longitudes = Array.from({length: 256}, (_, column) => rainfallTileCoordinate(coords.z, coords.x, coords.y, column, 0).lng);
      for (let row = 0; row < 256; row++) {
        const lat = rainfallTileCoordinate(coords.z, coords.x, coords.y, 0, row).lat;
        for (let column = 0; column < 256; column++) {
          const value = interpolateRainfall(values, grid, lat, longitudes[column]);
          if (value === null) continue;
          const offset = (row * 256 + column) * 4, color = Math.min(8000, Math.max(0, Math.round(value * 100))) * 4;
          pixels.data[offset] = colors[color]; pixels.data[offset + 1] = colors[color + 1]; pixels.data[offset + 2] = colors[color + 2]; pixels.data[offset + 3] = 255;
        }
      }
      raw.putImageData(pixels, 0, 0);
      context.beginPath();
      for (const polygon of visible) for (const ring of polygon.rings) {
        ring.forEach(([x, y], index) => { const px = x * scale - left, py = y * scale - top; if (index) context.lineTo(px, py); else context.moveTo(px, py); });
        context.closePath();
      }
      context.clip('evenodd'); context.drawImage(raster, 0, 0);
      return canvas;
    },
  });
  return new Rainfall({pane: 'rainfallOverlay', bounds, noWrap: true, minZoom: 3, maxZoom: 19, tileSize: 256, keepBuffer: 1, updateWhenIdle: true, opacity: 0, attribution: 'CHIRPS3-GEFS · GeoTIFF pengguna'});
}
