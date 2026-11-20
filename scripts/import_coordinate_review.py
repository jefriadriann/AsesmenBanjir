"""Apply corrections from the editable 133-location download."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

from openpyxl import load_workbook
from openpyxl.styles import PatternFill


def coordinates(latitude, longitude):
    if isinstance(latitude, str) and longitude is None:
        latitude, longitude = latitude.split(',')
    if latitude is None and longitude is None:
        return None
    lat, lng = float(latitude), float(longitude)
    if not (-12 <= lat <= 7 and 94 <= lng <= 142):
        raise ValueError('Coordinates outside the supported range')
    return [lat, lng]


def import_review(source, public_dir):
    locations_file = public_dir / 'locations.json'
    locations = json.loads(locations_file.read_text())
    by_id = {row['id']: row for row in locations}
    workbook = load_workbook(source)
    sheet = workbook['133 Lokasi']
    expected = ('Status koordinat', 'ID', 'Latitude baru', 'Longitude baru',
                'Alamat koreksi', 'Tautan / sumber konfirmasi', 'Catatan kamu')
    columns = (1, 2, 9, 10, 11, 12, 13)
    if tuple(sheet.cell(1, col).value for col in columns) != expected:
        raise ValueError('Unexpected review workbook header')
    seen, held = set(), []
    statuses = {'not_found': 'Belum ditemukan', 'ready_for_review': 'Siap ditinjau',
                'needs_confirmation': 'Perlu konfirmasi', 'verified': 'Terverifikasi'}
    fills = {'not_found': 'FCE4E4', 'ready_for_review': 'E5EDF5',
             'needs_confirmation': 'FFF0C2', 'verified': 'DCF1E3'}
    for cells in sheet.iter_rows(min_row=2):
        status, ident, latitude, longitude, address, source_link, notes = (
            cells[col - 1].value for col in columns
        )
        if ident not in by_id or ident in seen:
            raise ValueError(f'Unknown or duplicate location ID: {ident}')
        seen.add(ident)
        location = by_id[ident]
        try:
            coords = coordinates(latitude, longitude)
        except (TypeError, ValueError) as exc:
            raise ValueError(f'Invalid coordinates for {ident}: {exc}') from exc
        if coords:
            cells[8].value, cells[9].value = coords

        current = location.get('coords')
        changed = coords is not None and (
            current is None or any(abs(a - b) > 1e-12 for a, b in zip(current, coords))
        )
        if changed and ident == 'KPW-13' and not (-6.4 < coords[0] < -6.05 and 106.65 < coords[1] < 107.0):
            held.append(ident)
            message = 'Titik kiriman berada di luar Jakarta daratan. Konfirmasi pin gedung KPw DKI Jakarta sebelum dipakai di peta.'
            cells[12].value = f'{notes} {message}' if notes else message
            changed = False
        if address:
            location['address'] = str(address).strip()
        if changed:
            state = 'ready_for_review' if status == 'Siap ditinjau' else 'needs_confirmation'
            location.update(coords=coords, submittedOfficeCoords=coords, verifiedOfficeCoords=None,
                            status=state, coordinateAccuracy='submitted_office', source=source.name,
                            submissionStatus=statuses[state], submissionNotes=notes or '',
                            coordinateEvidence=[])
            location['coordinateReview'] = {
                'status': state,
                'reviewScope': 'Dikirim melalui lembar koreksi koordinat. Belum diverifikasi ulang oleh aplikasi.',
                'sourceStatus': statuses[state], 'notes': notes or '',
            }
            url = urlsplit(source_link or '')
            if url.scheme == 'https' and url.hostname and not (url.username or url.password):
                location['sourceUrl'] = source_link

        state = location['status']
        cells[0].value = statuses[state]
        for cell in cells[:2]:
            cell.fill = PatternFill('solid', fgColor=fills[state])
        cells[13].value, cells[14].value = location.get('coords') or (None, None)
    if seen != set(by_id):
        raise ValueError('Workbook is missing location IDs')

    counts = Counter(row['status'] for row in locations)
    with_coordinates = sum(row['coords'] is not None for row in locations)
    guide = workbook['Panduan']
    for row, state in enumerate(('not_found', 'needs_confirmation', 'ready_for_review', 'verified'), start=3):
        guide.cell(row, 2, counts[state])
    guide['B7'] = len(locations)
    guide['C9'] = (f'Isi kolom hijau di sheet 133 Lokasi. Prioritaskan {counts["not_found"]} lokasi belum ditemukan '
                   f'dan {counts["needs_confirmation"]} lokasi perlu konfirmasi.')
    meta = {'sourceFile':source.name, 'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'total':len(locations), 'withCoordinates':with_coordinates, 'statusCounts':dict(counts),
            'heldCoordinateIds':held, 'additionalRowsImported':0,
            'policy':'Submitted coordinates are candidates; questionable Jakarta coordinates are held for review.'}
    workbook.save(public_dir / 'Database-Koordinat-133-Lokasi.xlsx')
    locations_file.write_text(json.dumps(locations, ensure_ascii=False, indent=2)+'\n')
    (public_dir / 'coordinate-import.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('workbook', type=Path)
    import_review(parser.parse_args().workbook, Path(__file__).resolve().parents[1] / 'public')
