import { readFileSync, writeFileSync } from 'node:fs';
import { spatialIndex, contains } from '../data/spatial.mjs';
import { decodeOilfields, validFieldCoordinates } from '../analytics/oilfields.mjs';

const file = new URL('../public/data/oilfields.json', import.meta.url);
const registry = JSON.parse(readFileSync(file, 'utf8'));
const countries = JSON.parse(readFileSync(new URL('../data/sources/countries.geojson', import.meta.url), 'utf8'));
const index = spatialIndex(countries.features);
registry.locationKinds = Object.fromEntries(decodeOilfields(registry).filter(validFieldCoordinates).map(field => {
  const point = [field.lon, field.lat];
  const land = index.some(({bbox:b, poly}) => point[0] >= b[0] && point[0] <= b[2] && point[1] >= b[1] && point[1] <= b[3] && contains(point, poly));
  return [field.id, land ? 'onshore' : 'offshore'];
}));
registry.locationKindMethod = 'Approximate coordinate overlay against data/sources/countries.geojson; not a source registry attribute. Coastal points and inland waters may be misclassified.';
writeFileSync(file, JSON.stringify(registry));
console.log('Location symbols:', Object.values(registry.locationKinds).reduce((counts, kind) => ({...counts, [kind]:(counts[kind] || 0) + 1}), {}));
