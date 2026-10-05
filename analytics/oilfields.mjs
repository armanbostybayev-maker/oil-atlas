export const FIELD_STATUSES = {
  operating: { label: 'Operating', color: '#268363' },
  'in development': { label: 'In development', color: '#d28322' },
  discovered: { label: 'Discovered', color: '#377ebd' },
  'shut in': { label: 'Shut in', color: '#829097' },
  decommissioned: { label: 'Decommissioned', color: '#47545d' },
  abandoned: { label: 'Abandoned', color: '#39464e' },
  unknown: { label: 'Unknown status', color: '#929b9f' },
};
export const EMPTY_FIELD_FILTERS = Object.freeze({ query: '', country: '', status: '', objectType: '', fuelType: '', operator: '', discoveryFrom: '', discoveryTo: '', startFrom: '', startTo: '', reserves: '', production: '', accuracy: '', bounds: null });
export const present = value => value !== null && value !== undefined && value !== '';
export const validFieldCoordinates = field => typeof field.lat === 'number' && typeof field.lon === 'number' && Number.isFinite(field.lat) && Number.isFinite(field.lon) && Math.abs(field.lat) <= 90 && Math.abs(field.lon) <= 180;
export const hasReserves = field => present(field.oilReserves) || present(field.gasReserves);
export const hasProduction = field => present(field.oilProduction) || present(field.gasProduction);
export const fieldStatus = field => String(field.status || 'unknown').trim().toLowerCase();
export const statusStyle = status => FIELD_STATUSES[status] || FIELD_STATUSES.unknown;
export function decodeOilfields(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.rows) || !Array.isArray(data.columns) || !['id','name','lat','lon'].every(key => data.columns.includes(key))) throw new Error('Invalid oilfield registry');
  const ids = new Set();
  return data.rows.map(row => {
    const field = Object.fromEntries(data.columns.map((key, i) => [key, row[i] ?? null]));
    if (!field.id || ids.has(field.id)) throw new Error('Duplicate or missing oilfield ID');
    ids.add(field.id);
    field.locationKind = data.locationKinds?.[field.id] || 'unknown';
    return field;
  });
}
export function inFieldBounds(field, bounds) {
  if (!validFieldCoordinates(field)) return false;
  if (!bounds) return true;
  const [west, south, east, north] = bounds;
  if (field.lat < south || field.lat > north) return false;
  if (east - west >= 360) return true;
  const normalize = lon => ((lon + 180) % 360 + 360) % 360 - 180;
  const w = normalize(west), e = normalize(east), lon = normalize(field.lon);
  return w <= e ? lon >= w && lon <= e : lon >= w || lon <= e;
}
export function fieldYear(value) {
  if (!present(value)) return null;
  const match = String(value).match(/^\s*(\d{4})(?:\s|$|\()/);
  return match ? Number(match[1]) : null;
}
function withinYear(value, from, to) {
  if (!from && !to) return true;
  const year = fieldYear(value);
  return year !== null && (!from || year >= Number(from)) && (!to || year <= Number(to));
}
export function filterOilfields(fields, filters = EMPTY_FIELD_FILTERS) {
  const query = (filters.query || '').trim().toLocaleLowerCase();
  return fields.filter(field => {
    if (query && !`${field.name || ''} ${field.localName || ''} ${field.id}`.toLocaleLowerCase().includes(query)) return false;
    for (const key of ['country','objectType','fuelType','operator']) if (filters[key] && field[key] !== filters[key]) return false;
    if (filters.status && fieldStatus(field) !== filters.status) return false;
    if (filters.accuracy && (field.coordinateAccuracy || 'unknown') !== filters.accuracy) return false;
    if (filters.reserves && hasReserves(field) !== (filters.reserves === 'yes')) return false;
    if (filters.production && hasProduction(field) !== (filters.production === 'yes')) return false;
    return withinYear(field.discoveryYear, filters.discoveryFrom, filters.discoveryTo) && withinYear(field.productionStart, filters.startFrom, filters.startTo) && (!filters.bounds || inFieldBounds(field, filters.bounds));
  });
}
function counts(fields, key, fallback = 'Not supplied') {
  const map = new Map();
  for (const field of fields) {
    const value = typeof key === 'function' ? key(field) : field[key];
    map.set(value || fallback, (map.get(value || fallback) || 0) + 1);
  }
  return [...map].map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
}
export function oilfieldAnalytics(fields, bounds) {
  const visible = fields.filter(field => inFieldBounds(field, bounds));
  return { total: visible.length, countries: new Set(visible.map(f => f.country).filter(Boolean)).size,
    statuses: counts(visible, fieldStatus), topCountries: counts(visible.filter(f => f.country), 'country').slice(0,5),
    topOperators: counts(visible.filter(f => f.operator), 'operator').slice(0,5),
    withReserves: visible.filter(hasReserves).length, withProduction: visible.filter(hasProduction).length,
    exact: visible.filter(f => f.coordinateAccuracy === 'exact').length,
    approximate: visible.filter(f => f.coordinateAccuracy === 'approximate').length,
    unknownAccuracy: visible.filter(f => !['exact','approximate'].includes(f.coordinateAccuracy)).length,
  };
}
export function oilfieldGeoJSON(fields) {
  return { type: 'FeatureCollection', features: fields.filter(validFieldCoordinates).map(field => ({
    type: 'Feature', id: field.id, geometry: { type: 'Point', coordinates: [field.lon,field.lat] },
    properties: { id: field.id, status: fieldStatus(field), locationKind: field.locationKind || 'unknown' },
  })) };
}
export function safeSourceUrl(value) {
  try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
