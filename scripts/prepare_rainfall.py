"""Build two weekly means and georeferenced web overlays from the supplied 15-band TIFF."""
import argparse
import hashlib
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.features import geometry_mask
from rasterio.warp import calculate_default_transform, reproject, Resampling, transform_geom, transform_bounds

ROOT = Path(__file__).resolve().parents[1]
THRESHOLDS = [0, 2, 5, 10, 15, 20, 25, 35, 50, 80]
PALETTE = ['f4f1e8', 'ffe5a0', 'ffcb45', 'ee8a24', 'a3d64f', '00a487', '2587df', '2445a2', '6e369a', '2c114b']

def main():
    args = argparse.ArgumentParser()
    args.add_argument('tif', type=Path)
    args.add_argument('--output', type=Path, default=ROOT / 'public/rainfall')
    args.add_argument('--run-date', default='2026-11-17')
    opts = args.parse_args()
    run = date.fromisoformat(opts.run_date)
    opts.output.mkdir(parents=True, exist_ok=True)
    boundary_path = ROOT / 'public/rainfall/boundary.geojson'
    geometries = [feature['geometry'] for feature in json.loads(boundary_path.read_text())['features']]
    with rasterio.open(opts.tif) as src:
        if src.count != 15 or src.crs.to_epsg() != 4326:
            raise ValueError('Expected the original 15-band EPSG:4326 forecast raster.')
        dates = [date.fromisoformat(value) for value in src.descriptions]
        if dates != [run + timedelta(days=offset + 1) for offset in range(15)]:
            raise ValueError('Band dates must be the 15 forecast dates immediately after the run.')
        data = src.read(masked=True)
        valid = ~np.ma.getmaskarray(data) & np.isfinite(data.data) & (data.data >= 0)
        native_land = geometry_mask(geometries, (src.height, src.width), src.transform, invert=True)
        dst_transform, width, height = calculate_default_transform(src.crs, 'EPSG:3857', src.width, src.height, *src.bounds, resolution=5500)
        projected_geometry = [transform_geom('EPSG:4326', 'EPSG:3857', geom) for geom in geometries]
        land = geometry_mask(projected_geometry, (height, width), dst_transform, invert=True)
        west, south, east, north = transform_bounds('EPSG:3857', 'EPSG:4326', *rasterio.transform.array_bounds(height, width, dst_transform))
        manifest = {
            'source': 'CHIRPS3-GEFS', 'runDate': run.isoformat(), 'resolution': '±5,6 km', 'unit': 'mm/hari',
            'sourceFile': opts.tif.name, 'sourceSha256': hashlib.sha256(opts.tif.read_bytes()).hexdigest(),
            'grid': {'crs': 'EPSG:4326', 'width': src.width, 'height': src.height, 'transform': list(src.transform)[:6], 'format': 'float32-le', 'nodata': 'NaN'},
            'imageBounds': [[south, west], [north, east]], 'imageProjection': 'EPSG:3857',
            'thresholds': THRESHOLDS, 'palette': PALETTE,
            'boundary': 'Natural Earth 1:10m Indonesia (datasets/geo-countries); differs from LSIB_SIMPLE/2017 in the Earth Engine script.',
            'boundarySha256': hashlib.sha256(boundary_path.read_bytes()).hexdigest(), 'periods': [],
        }
        for index, offset in enumerate([0, 7]):
            complete = valid[offset:offset + 7].all(axis=0)
            mean = np.mean(data.data[offset:offset + 7], axis=0, dtype=np.float64)
            mean[~complete] = np.nan
            projected = np.full((height, width), np.nan, dtype=np.float32)
            reproject(mean, projected, src_transform=src.transform, src_crs=src.crs, src_nodata=np.nan, dst_transform=dst_transform, dst_crs='EPSG:3857', dst_nodata=np.nan, resampling=Resampling.bilinear)
            finite = np.isfinite(projected) & land
            value = np.interp(np.nan_to_num(projected), THRESHOLDS, np.arange(len(THRESHOLDS)))
            colors = np.array([[int(color[n:n + 2], 16) for n in [0, 2, 4]] for color in PALETTE])
            rgba = np.zeros((height, width, 4), dtype=np.uint8)
            for channel in range(3):
                rgba[:, :, channel] = np.rint(np.interp(value, np.arange(10), colors[:, channel])).astype(np.uint8)
            rgba[:, :, 3] = finite.astype(np.uint8) * 255
            rgba[~finite, :3] = 0
            week = f'week{index + 1}'
            Image.fromarray(rgba).save(opts.output / f'{week}.png', optimize=True)
            mean.astype('<f4').tofile(opts.output / f'{week}-render.f32')
            mean[~native_land] = np.nan
            mean.astype('<f4').tofile(opts.output / f'{week}.f32')
            values = mean[np.isfinite(mean)]
            manifest['periods'].append({'id': week, 'label': f'Pekan {index + 1}', 'start': dates[offset].isoformat(), 'end': dates[offset + 6].isoformat(), 'bands': list(range(offset + 1, offset + 8)), 'image': f'/rainfall/{week}.png', 'grid': f'/rainfall/{week}.f32', 'renderGrid': f'/rainfall/{week}-render.f32', 'validCells': int(values.size), 'min': float(values.min()), 'max': float(values.max())})
        (opts.output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        print(json.dumps({'output': str(opts.output), 'imageSize': [width, height], 'periods': manifest['periods']}, indent=2))

if __name__ == '__main__':
    main()
