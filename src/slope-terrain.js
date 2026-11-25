import L from 'leaflet';

const size = 256;

export function colorTerrainSlope(data, coords, palette) {
  const {y, z} = coords;
  const pixelCount = size * 2 ** z;
  const elevation = new Float32Array(size * size);
  for (let i = 0; i < elevation.length; i++) {
    const p = i * 4;
    elevation[i] = data[p] * 256 + data[p + 1] + data[p + 2] / 256 - 32768;
  }
  for (let row = 0; row < size; row++) {
    const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y * size + row + .5) / pixelCount)));
    const meters = 2 * Math.PI * 6378137 * Math.cos(latitude) / pixelCount;
    const north = Math.max(0, row - 1), south = Math.min(size - 1, row + 1);
    for (let col = 0; col < size; col++) {
      const west = Math.max(0, col - 1), east = Math.min(size - 1, col + 1);
      const dx = (elevation[row * size + east] - elevation[row * size + west]) / ((east - west) * meters);
      const dy = (elevation[south * size + col] - elevation[north * size + col]) / ((south - north) * meters);
      const percent = 100 * Math.hypot(dx, dy);
      const level = Number(percent >= 8) + Number(percent >= 15) + Number(percent >= 25) + Number(percent >= 40);
      data.set(palette[level], (row * size + col) * 4);
    }
  }
}

export function createTerrainSlope({boundary, legend, bounds, opacity}) {
  const palette = legend.map(item => [1, 3, 5].map(offset => parseInt(item.color.slice(offset, offset + 2), 16)).concat(255));
  const polygons = boundary.features.flatMap(({geometry}) =>
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]).map(rings => {
    const projected = rings.map(ring => ring.map(([lng, lat]) => L.CRS.EPSG3857.latLngToPoint(L.latLng(lat, lng), 0)));
    return {rings: projected, bounds: L.bounds(projected[0])};
  });
  const requests = new WeakMap();
  const TerrainSlope = L.GridLayer.extend({
    createTile(coords, done) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = size;
      const scale = 2 ** coords.z;
      const origin = L.point(coords.x * size, coords.y * size);
      const extent = L.bounds(origin.divideBy(scale), origin.add([size, size]).divideBy(scale));
      const visible = polygons.filter(polygon => polygon.bounds.intersects(extent));
      if (!visible.length) {
        requestAnimationFrame(() => done(null, tile));
        return tile;
      }
      const controller = new AbortController();
      requests.set(tile, controller);
      const {z, x, y} = coords;
      fetch(`/api/slope?mode=dem&z=${z}&x=${x}&y=${y}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
      }).then(response => {
        if (!response.ok) throw Error('Tile elevasi belum tersedia');
        return response.blob();
      }).then(blob => createImageBitmap(blob)).then(bitmap => {
        try {
          if (controller.signal.aborted) return;
          if (bitmap.width !== size || bitmap.height !== size) throw Error('Ukuran tile elevasi tidak valid');
          const raster = document.createElement('canvas');
          raster.width = raster.height = size;
          const rasterContext = raster.getContext('2d', {willReadFrequently: true});
          rasterContext.drawImage(bitmap, 0, 0);
          const pixels = rasterContext.getImageData(0, 0, size, size);
          colorTerrainSlope(pixels.data, coords, palette);
          rasterContext.putImageData(pixels, 0, 0);
          const context = tile.getContext('2d');
          context.beginPath();
          for (const polygon of visible) for (const ring of polygon.rings) {
            ring.forEach((p, i) => {
              const pixel = p.multiplyBy(scale).subtract(origin);
              if (i) context.lineTo(pixel.x, pixel.y);
              else context.moveTo(pixel.x, pixel.y);
            });
            context.closePath();
          }
          context.clip('evenodd');
          context.drawImage(raster, 0, 0);
          tile.dataset.terrain = 'drawn';
          done(null, tile);
        } finally { bitmap.close(); }
      }).catch(error => {
        if (!controller.signal.aborted) done(error, tile);
      });
      return tile;
    },
  });
  return new TerrainSlope({pane: 'slopeOverlay', bounds, opacity, noWrap: true, maxZoom: 19, maxNativeZoom: 12,
    keepBuffer: 2, updateWhenIdle: true, updateWhenZooming: false, attribution: 'Elevasi Mapzen / AWS Terrain Tiles · lereng perkiraan'})
    .on('tileunload', ({tile}) => requests.get(tile)?.abort());
}
