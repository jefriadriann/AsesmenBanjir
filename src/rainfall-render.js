import {interpolateRainfall, rainfallColor, rainfallTileCoordinate} from './rainfall-data.js';

export function createRainfallRenderer({buffer, grid}) {
  const values = new Float32Array(buffer);
  const colors = new Uint8ClampedArray(8001 * 4);
  for (let n = 0; n <= 8000; n++) colors.set(rainfallColor(n / 100), n * 4);
  return function drawTile(canvas, coords) {
    const context = canvas.getContext('2d'), pixels = context.createImageData(256, 256);
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
    context.putImageData(pixels, 0, 0);
    return canvas;
  };
}
