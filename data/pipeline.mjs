import fs from 'node:fs';
import path from 'node:path';
import { countryModel, refineryModel, FIELDS, YEAR_FIELDS, ownerName } from './normalize.mjs';
import { number } from '../utils/numbers.mjs';
import { spatialIndex, joinPoint, labelPoint, bounds, polygons } from './spatial.mjs';
import { calculateQuality } from './quality.mjs';

export const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const clean = value => value == null ? null : String(value).trim() || null;
const countryKey = value => {
  const key = String(value ?? '').trim().toLowerCase();
  return ({'united states of america':'united states',usa:'united states','u.s.a.':'united states',uk:'united kingdom',czechia:'czech republic'})[key] || key;
};

export function readGIS(source) {
  const files = ['country world.geojsonl', 'refinary world.geojsonl'];
  for (const file of files) if (!fs.existsSync(path.join(source, file)))
    throw new Error(`Missing GIS source: ${file}. Use npm run data:update -- --source <directory containing both .geojsonl files>, or omit --source to regenerate the checked-in dataset.`);
  const read = file => fs.readFileSync(path.join(source, file), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const features = read(files[0]);
  features.forEach(f => { f.id = String(f.properties.fid); });
  const countries = features.map(f => ({...countryModel(f), center:labelPoint(f.geometry), bounds:bounds(polygons(f.geometry).flatMap(p => p[0]))}));
  const index = spatialIndex(features);
  const refineries = read(files[1]).map(refineryModel).map(r => {
    const p = r.coordinates;
    const valid = Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
    return {...r, ...(valid ? joinPoint(p,index) : {country:null, method:'invalid coordinates'})};
  });
  return {base:{countries,refineries}, geometry:{type:'FeatureCollection',features:features.map(f => ({...f,properties:{id:f.id,name:f.properties.NAME_EN}}))}};
}

export function mergeEnrichment(base, enrichment) {
  const result = structuredClone(base);
  const ids = new Set(result.countries.map(c => c.id));
  for (const id of Object.keys(enrichment.countries)) if (!ids.has(id)) throw new Error(`Country enrichment references missing country ${id}`);
  for (const c of result.countries) {
    const patch = enrichment.countries[c.id];
    if (!patch) continue;
    for (const key of ['name','nameRu','priceDate','priceUnit']) if (Object.hasOwn(patch,key)) c[key] = patch[key];
    for (const key of ['raw','values','years','sources']) c[key] = {...c[key],...patch[key]};
  }
  for (const [id, rows] of Object.entries(enrichment.refineryRegistries)) {
    if (!ids.has(id) || !Array.isArray(rows) || !rows.length) throw new Error(`Invalid refinery registry for country ${id}`);
    result.refineries = result.refineries.filter(r => r.country !== id);
    result.refineries.push(...structuredClone(rows));
    const raw = result.countries.find(c => c.id === id).raw;
    const active = rows.filter(r => r.status === 'Active');
    const known = active.filter(r => Number.isFinite(r.capacityBpd));
    raw['НПЗ Oilmap, шт.'] = active.length;
    raw['Известная мощность Oilmap, барр./сут.'] = known.length ? known.reduce((s,r) => s+r.capacityBpd,0) : null;
    raw['НПЗ Oilmap без мощности, шт.'] = active.length-known.length;
    raw['НПЗ: статус свежей проверки'] = 'Обновлено из листа «НПЗ свежие реестры»';
  }
  return result;
}

// Blank Excel cells do not erase previously known normalized values.
export function importCountries(rows, base, enrichment) {
  if (!rows.length) throw new Error('Country worksheet has no records');
  const updated = structuredClone(enrichment);
  const current = mergeEnrichment(base, updated);
  const years = {...YEAR_FIELDS, crude:'Год сырой нефти / конденсата', ngpl:'Год NGPL', ...Object.fromEntries(['diesel','gasoline','lpg','jet','residual'].map(k => [k,'Год продуктовых долей']))};
  for (const row of rows) {
    const c = current.countries.find(c => c.id === String(row.fid)) || current.countries.find(c => countryKey(c.name) === countryKey(row.NAME_EN));
    if (!c) throw new Error(`Unmatched Excel country: ${row.fid} / ${row.NAME_EN}`);
    const p = updated.countries[c.id] ||= {};
    p.raw = {...p.raw,...row};
    for (const [key, field] of [['name','NAME_EN'],['nameRu','NAME_RU'],['priceUnit','Единица/тип цены'],['priceDate','Дата цены']]) if (clean(row[field])) p[key] = row[field];
    for (const [group, fields] of [['values',FIELDS],['years',years]]) {
      p[group] ||= {};
      for (const [key,field] of Object.entries(fields)) {
        const value = number(row[field]);
        if (value !== null) p[group][key] = value;
      }
    }
  }
  return updated;
}

export function importRefineries(rows, base, enrichment) {
  if (!rows.length) throw new Error('Refinery worksheet has no records');
  const updated = structuredClone(enrichment);
  const countries = mergeEnrichment(base, enrichment).countries;
  const groups = {};
  for (const [i,row] of rows.entries()) {
    const c = countries.find(c => [c.name,c.nameRu,c.raw.NAME_EN,c.raw.NAME_RU].some(n => n && countryKey(n) === countryKey(row['Страна'])));
    if (!c) throw new Error(`Unmatched refinery country: ${row['Страна']}`);
    const name = clean(row['НПЗ / площадка']);
    if (!name) throw new Error(`Missing refinery name at row ${i+2}`);
    const capacityMt = number(row['Мощность, млн т/год']);
    const bpd = number(row['Мощность, барр./сут.']);
    if (capacityMt < 0 || bpd < 0) throw new Error(`Negative refinery capacity: ${name}`);
    const rawStatus = clean(row['Статус источника']);
    const statusKey = String(rawStatus || '').toLowerCase();
    const status = ['open','operable','operating','installed','capacity augmentation'].includes(statusKey) ? 'Active' : statusKey === 'closed' ? 'Closed' : 'Unknown';
    const capacity = capacityMt === null ? null : capacityMt * 1e6;
    const raw = {...row, 'Официальное название':name,'Владелец завода':clean(row['Компания']),'Статус':rawStatus,'Статус на 2026 г.':rawStatus};
    if (capacity !== null) raw['Мощность переработки, т/год'] = capacity;
    if (clean(row.URL)) raw['Источники (URL)'] = clean(row.URL);
    const group = groups[c.id] ||= [];
    group.push({id:`registry-${c.id}-${group.length+1}`,name,originalName:name,coordinates:[number(row.x),number(row.y)],capacity,capacityBpd:bpd,owner:ownerName(clean(row['Компания'])),status,rawStatus,age:null,statusConflict:false,raw,country:c.id,method:'fresh_registry',distanceKm:0});
  }
  Object.assign(updated.refineryRegistries,groups);
  return updated;
}

export function generate(base, geometry, enrichment) {
  const atlas = mergeEnrichment(base,enrichment);
  for (const key of ['countries','refineries']) {
    if (!Array.isArray(atlas[key]) || !atlas[key].length) throw new Error(`Empty or missing ${key}`);
    const ids = new Set();
    for (const item of atlas[key]) {
      if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error(`Invalid/duplicate ${key} ID: ${item.id}`);
      ids.add(item.id);
    }
  }
  const countryIds = new Set(atlas.countries.map(c => c.id));
  if (geometry.type !== 'FeatureCollection' || geometry.features.length !== countryIds.size || new Set(geometry.features.map(f => String(f.id))).size !== countryIds.size || geometry.features.some(f => !countryIds.has(String(f.id)))) throw new Error('Geometry/country IDs do not match');
  for (const c of atlas.countries) {
    if (!c.name || !c.raw || !c.values || !c.years) throw new Error(`Invalid country ${c.id}`);
    for (const value of [...Object.values(c.values),...Object.values(c.years)]) if (value !== null && !Number.isFinite(value)) throw new Error(`Invalid numeric country value: ${c.id}`);
  }
  for (const r of atlas.refineries) {
    if (!r.name || !r.raw || (r.country && !countryIds.has(r.country))) throw new Error(`Invalid refinery ${r.id}`);
    for (const key of ['capacity','capacityBpd','age']) if (r[key] !== null && (!Number.isFinite(r[key]) || r[key] < 0)) throw new Error(`Invalid ${key} for refinery ${r.id}`);
    if (!['Active','Closed','Modernization','Unknown'].includes(r.status)) throw new Error(`Invalid status for ${r.id}`);
  }
  atlas.quality = calculateQuality(atlas.countries,atlas.refineries);
  return atlas;
}

// Prepare all files before publication; replace each file atomically and roll
// back already replaced files on an I/O failure. The caller holds the writer lock.
export function publish(files) {
  const pending = [], applied = [];
  try {
    for (const [file, content] of files) {
      fs.mkdirSync(path.dirname(file),{recursive:true});
      const temp = `${file}.${process.pid}.tmp`;
      pending.push({file,temp,previous:fs.existsSync(file) ? fs.readFileSync(file) : null});
      fs.writeFileSync(temp,content,{flag:'wx'});
    }
    for (const item of pending) { fs.renameSync(item.temp,item.file); applied.push(item); }
  } catch (error) {
    for (const item of applied.reverse()) {
      if (item.previous === null) fs.rmSync(item.file);
      else { fs.writeFileSync(item.temp,item.previous); fs.renameSync(item.temp,item.file); }
    }
    throw error;
  } finally {
    for (const {temp} of pending) if (fs.existsSync(temp)) fs.rmSync(temp);
  }
}
