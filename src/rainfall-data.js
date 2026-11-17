export const RAINFALL_SOURCE = {
  name: 'CHIRPS3-GEFS',
  asset: 'projects/jefri-project-23/assets/chirps3_gefs_indonesia_20261117',
  runDate: '2026-11-17',
  startDate: '2026-11-18',
  resolution: '±5,6 km',
  unit: 'mm/hari',
  thresholds: [0, 2, 5, 10, 15, 20, 25, 35, 50, 80],
  palette: ['f4f1e8', 'ffe5a0', 'ffcb45', 'ee8a24', 'a3d64f', '00a487', '2587df', '2445a2', '6e369a', '2c114b'],
};
export function rainfallPeriods() {
  const start = Date.parse(RAINFALL_SOURCE.startDate + 'T00:00:00Z');
  const date = offset => new Date(start + offset * 86400000).toISOString().slice(0, 10);
  return [0, 7].map((offset, index) => ({id: `week${index + 1}`, label: `Pekan ${index + 1}`, start: date(offset), end: date(offset + 6), bands: Array.from({length: 7}, (_, day) => 'd' + (offset + day + 1))}));
}

export function rainfallCell(grid, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || grid.crs !== 'EPSG:4326') return null;
  const [a, b, c, d, e, f] = grid.transform;
  const determinant = a * e - b * d;
  if (!Number.isFinite(determinant) || determinant === 0) return null;
  const column = Math.floor((e * (lng - c) - b * (lat - f)) / determinant);
  const row = Math.floor((-d * (lng - c) + a * (lat - f)) / determinant);
  return row >= 0 && row < grid.height && column >= 0 && column < grid.width ? {row, column, index: row * grid.width + column} : null;
}
export function rainfallValue(buffer, grid, lat, lng) {
  const cell = rainfallCell(grid, lat, lng);
  if (!cell || buffer.byteLength !== grid.width * grid.height * 4) return null;
  const value = new DataView(buffer).getFloat32(cell.index * 4, true);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// Native grid values are located at pixel centres; north-up geographic affine.
export function interpolateRainfall(values, grid, lat, lng) {
  const [a, b, c, d, e, f] = grid.transform;
  if (b || d || !a || !e || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let x = (lng - c) / a - 0.5, y = (lat - f) / e - 0.5;
  if (x < -0.5 || y < -0.5 || x >= grid.width - 0.5 || y >= grid.height - 0.5) return null;
  x = Math.max(0, Math.min(grid.width - 1, x)); y = Math.max(0, Math.min(grid.height - 1, y));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, grid.width - 1), y1 = Math.min(y0 + 1, grid.height - 1);
  const fx = x - x0, fy = y - y0;
  const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  const offsets = [y0 * grid.width + x0, y0 * grid.width + x1, y1 * grid.width + x0, y1 * grid.width + x1];
  let result = 0;
  for (let n = 0; n < 4; n++) { if (!weights[n]) continue; const value = values[offsets[n]]; if (!Number.isFinite(value) || value < 0) return null; result += value * weights[n]; }
  return result;
}
export function rainfallColor(value) {
  const {thresholds, palette} = RAINFALL_SOURCE;
  if (!Number.isFinite(value) || value < 0) return [0, 0, 0, 0];
  let band = 0;
  while (band < thresholds.length - 2 && value > thresholds[band + 1]) band++;
  const ratio = Math.max(0, Math.min(1, (value - thresholds[band]) / (thresholds[band + 1] - thresholds[band])));
  return [0, 2, 4].map(offset => Math.round(parseInt(palette[band].slice(offset, offset + 2), 16) * (1 - ratio) + parseInt(palette[band + 1].slice(offset, offset + 2), 16) * ratio)).concat(255);
}
export function rainfallTileCoordinate(z, x, y, column, row) {
  const scale = 256 * 2 ** z;
  return {lng: (x * 256 + column + 0.5) / scale * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (y * 256 + row + 0.5) / scale))) * 180 / Math.PI};
}
