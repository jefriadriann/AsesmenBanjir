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
