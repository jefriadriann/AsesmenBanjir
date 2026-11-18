// Rounded city centres for reading the map at regional scale. These are
// reference points only, independent of office and incident coordinates.
export const provinceCapitals = [
  ['Aceh', 'Banda Aceh', 5.55, 95.32, 'Sumatera'],
  ['Sumatera Utara|Sumatra Utara|Sumut', 'Medan', 3.59, 98.67, 'Sumatera'],
  ['Sumatera Barat|Sumatra Barat|Sumbar', 'Padang', -0.95, 100.36, 'Sumatera'],
  ['Riau', 'Pekanbaru', 0.51, 101.45, 'Sumatera'],
  ['Kepulauan Riau|Kepri', 'Tanjungpinang', 0.92, 104.45, 'Sumatera'],
  ['Jambi', 'Jambi', -1.61, 103.61, 'Sumatera'],
  ['Sumatera Selatan|Sumatra Selatan|Sumsel', 'Palembang', -2.99, 104.76, 'Sumatera'],
  ['Bengkulu', 'Bengkulu', -3.80, 102.26, 'Sumatera'],
  ['Lampung', 'Bandar Lampung', -5.43, 105.26, 'Sumatera'],
  ['Kepulauan Bangka Belitung|Bangka Belitung|Babel', 'Pangkalpinang', -2.13, 106.11, 'Sumatera'],
  ['DKI Jakarta', 'Jakarta', -6.18, 106.83, 'Jawa'],
  ['Banten', 'Serang', -6.12, 106.15, 'Jawa'],
  ['Jawa Barat|Jabar', 'Bandung', -6.91, 107.61, 'Jawa'],
  ['Jawa Tengah|Jateng', 'Semarang', -6.99, 110.42, 'Jawa'],
  ['DI Yogyakarta|Daerah Istimewa Yogyakarta|DIY', 'Yogyakarta', -7.80, 110.37, 'Jawa'],
  ['Jawa Timur|Jatim', 'Surabaya', -7.25, 112.75, 'Jawa'],
  ['Bali', 'Denpasar', -8.65, 115.22, 'Balinusra'],
  ['Nusa Tenggara Barat|NTB', 'Mataram', -8.58, 116.11, 'Balinusra'],
  ['Nusa Tenggara Timur|NTT', 'Kupang', -10.17, 123.61, 'Balinusra'],
  ['Kalimantan Barat|Kalbar', 'Pontianak', -0.03, 109.34, 'Kalimantan'],
  ['Kalimantan Tengah|Kalteng', 'Palangka Raya', -2.21, 113.92, 'Kalimantan'],
  ['Kalimantan Selatan|Kalsel', 'Banjarbaru', -3.44, 114.83, 'Kalimantan'],
  ['Kalimantan Timur|Kaltim', 'Samarinda', -0.50, 117.15, 'Kalimantan'],
  ['Kalimantan Utara|Kaltara', 'Tanjung Selor', 2.84, 117.37, 'Kalimantan'],
  ['Sulawesi Utara|Sulut', 'Manado', 1.48, 124.84, 'Sulampua'],
  ['Gorontalo', 'Gorontalo', 0.54, 123.06, 'Sulampua'],
  ['Sulawesi Tengah|Sulteng', 'Palu', -0.90, 119.87, 'Sulampua'],
  ['Sulawesi Barat|Sulbar', 'Mamuju', -2.68, 118.89, 'Sulampua'],
  ['Sulawesi Selatan|Sulsel', 'Makassar', -5.14, 119.41, 'Sulampua'],
  ['Sulawesi Tenggara|Sultra', 'Kendari', -3.99, 122.52, 'Sulampua'],
  ['Maluku', 'Ambon', -3.70, 128.18, 'Sulampua'],
  ['Maluku Utara|Malut', 'Sofifi', 0.74, 127.57, 'Sulampua'],
  ['Papua', 'Jayapura', -2.54, 140.72, 'Sulampua'],
  ['Papua Barat', 'Manokwari', -0.86, 134.06, 'Sulampua'],
  ['Papua Barat Daya', 'Sorong', -0.88, 131.25, 'Sulampua'],
  ['Papua Tengah', 'Nabire', -3.36, 135.50, 'Sulampua'],
  ['Papua Selatan', 'Merauke', -8.49, 140.40, 'Sulampua'],
  ['Papua Pegunungan', 'Wamena', -4.10, 138.95, 'Sulampua'],
];

export const extraCities = [
  ['Bogor', -6.60, 106.80], ['Depok', -6.40, 106.82],
  ['Bekasi', -6.24, 106.99], ['Tangerang', -6.18, 106.63],
  ['Tangerang Selatan|Tangsel', -6.29, 106.72],
  ['Sukabumi', -6.92, 106.93], ['Cianjur', -6.82, 107.14],
  ['Garut', -7.22, 107.90], ['Sumedang', -6.86, 107.92],
  ['Purwakarta', -6.56, 107.44], ['Subang', -6.57, 107.76],
  ['Karawang', -6.31, 107.30], ['Indramayu', -6.33, 108.32],
  ['Demak', -6.89, 110.64], ['Kudus', -6.80, 110.84],
  ['Pekalongan', -6.89, 109.67], ['Pemalang', -6.89, 109.38],
  ['Banjarnegara', -7.40, 109.68], ['Magelang', -7.48, 110.22],
  ['Gresik', -7.16, 112.65], ['Sidoarjo', -7.45, 112.72],
  ['Lumajang', -8.13, 113.22], ['Banyuwangi', -8.22, 114.37],
  ['Padang Pariaman', -0.62, 100.12], ['Pariaman', -0.63, 100.12],
  ['Langkat', 3.76, 98.46], ['Deli Serdang', 3.56, 98.88],
];

export function newsRegionReferences(locations) {
  return [
    ...locations.filter(item => item.region && item.legacyCityCoords).map(item => [item.legacyCityCoords, item.region]),
    ...provinceCapitals.map(([, , lat, lng, region]) => [[lat, lng], region]),
    ...extraCities.map(([name, lat, lng]) => [[lat, lng], extraCityRegion(name)]),
  ];
}

export function extraCityRegion(name) {
  return ['Padang Pariaman', 'Pariaman', 'Langkat', 'Deli Serdang'].includes(name) ? 'Sumatera' : 'Jawa';
}

export function nearbyNewsRegion([lat, lng], references) {
  const distances = new Map();
  for (const [[otherLat, otherLng], region] of references) {
    const distance = 111 * Math.hypot(otherLat - lat, (otherLng - lng) * Math.cos(lat * Math.PI / 180));
    distances.set(region, Math.min(distance, distances.get(region) ?? Infinity));
  }
  const [nearest, next] = [...distances].sort((a, b) => a[1] - b[1]);
  // During regional filtering, keep uncertain or remote RSS points in the
  // national view rather than assign them to an unrelated Korwil.
  return nearest && nearest[1] <= 100 && (!next || next[1] - nearest[1] >= 25) ? nearest[0] : null;
}
