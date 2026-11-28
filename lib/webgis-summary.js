export const webgisUrl = 'https://inarisk.bnpb.go.id/webgis-bi/';
export const levels = ['Awas', 'Siaga', 'Waspada', 'Normal', 'Potensi Tinggi'];

// All five cards and the attention list must belong to one national rendering.
export function validSummary(data) {
 if (!data || !Number.isFinite(Date.parse(data.asOf)) || !Number.isInteger(data.total) || data.total < 1) return false;
 const values = levels.map(label => data.counts?.[label]);
 if (!values.every(n => Number.isInteger(n) && n >= 0 && n <= data.total)) return false;
 const [awas, siaga, waspada, normal] = values;
 const attention = awas + siaga + waspada;
 const offices = data.offices;
 if (attention + normal > data.total || !Array.isArray(offices) || offices.length !== attention) return false;
 if (!offices.every(o => typeof o?.name === 'string' && o.name.trim() && levels.slice(0,3).includes(o.status))) return false;
 if (new Set(offices.map(o => o.name)).size !== offices.length) return false;
 if (!levels.slice(0,3).every(label => offices.filter(o => o.status === label).length === data.counts[label])) return false;
 return typeof data.context === 'string' && typeof data.climate?.oni === 'string' && typeof data.climate?.iod === 'string'
  && typeof data.climate?.oniPeriod === 'string' && typeof data.climate?.iodPeriod === 'string' && Array.isArray(data.feeds);
}
