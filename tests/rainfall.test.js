import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RAINFALL_SOURCE, rainfallPeriods, rainfallCell, rainfallValue} from '../src/rainfall-data.js';
const root = new URL('../public/rainfall/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
const bytes = week => { const b = readFileSync(new URL(week + '.f32', root)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

test('forecast periods use days 1–7 and 8–14 of the provided 15-day run', () => {
  const [one, two] = rainfallPeriods();
  assert.deepEqual([one.start, one.end, two.start, two.end], ['2026-11-18', '2026-11-24', '2026-11-25', '2026-12-01']);
  assert.deepEqual(one.bands, ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7']);
  assert.deepEqual(two.bands, ['d8', 'd9', 'd10', 'd11', 'd12', 'd13', 'd14']);
  assert.deepEqual(manifest.palette, RAINFALL_SOURCE.palette);
  assert.deepEqual(manifest.thresholds, [0, 2, 5, 10, 15, 20, 25, 35, 50, 80]);
  assert.equal(manifest.runDate, RAINFALL_SOURCE.runDate);
  assert.equal(manifest.unit, 'mm/hari');
  assert.equal(manifest.imageProjection, 'EPSG:3857');
  assert.match(manifest.boundary, /differs from LSIB/);
});
test('native-grid readings match independent seven-band means from original GeoTIFF', () => {
  const week1 = bytes('week1'), week2 = bytes('week2');
  const references = [
    [3.59, 98.67, 12.905555997576032, 9.342512198856898],
    [-6.2, 106.8, 7.815439769199917, 5.798994949885777],
    [-0.5, 117.15, 7.782627173832485, 8.59053931917463],
    [-2.6, 140.6, 9.284191540309362, 9.73294380732945],
  ];
  for (const [lat, lng, one, two] of references) {
    assert.ok(Math.abs(rainfallValue(week1, manifest.grid, lat, lng) - one) < 2e-6);
    assert.ok(Math.abs(rainfallValue(week2, manifest.grid, lat, lng) - two) < 2e-6);
  }
});
test('out-of-bounds, ocean, malformed buffer and invalid coordinates never return made-up rain', () => {
  const data = bytes('week1');
  assert.equal(rainfallCell(manifest.grid, 90, 0), null);
  assert.equal(rainfallCell(manifest.grid, NaN, 100), null);
  assert.equal(rainfallValue(data, manifest.grid, -5, 95), null);
  assert.equal(rainfallValue(new ArrayBuffer(4), manifest.grid, 3.59, 98.67), null);
  for (const period of manifest.periods) {
    const buffer = bytes(period.id);
    assert.equal(buffer.byteLength, manifest.grid.width * manifest.grid.height * 4);
    const view = new DataView(buffer); let count = 0;
    for (let offset = 0; offset < buffer.byteLength; offset += 4) { const n = view.getFloat32(offset, true); if (Number.isFinite(n)) { assert.ok(n >= 0); count++; } }
    assert.equal(count, period.validCells);
    assert.ok(count > 60000);
    assert.equal(readFileSync(new URL(period.id + '.png', root)).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
});
