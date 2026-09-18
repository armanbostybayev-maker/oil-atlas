import { ownerName } from '../data/normalize.mjs';

export const VESSEL_TYPES = [
  ['crude_oil_tanker','Crude Oil Tanker'],
  ['product_tanker','Oil Products Tanker'],
  ['oil_chemical_tanker','Oil/Chemical Tanker'],
  ['chemical_tanker','Chemical Tanker'],
  ['lpg_tanker','LPG Tanker'],
  ['lng_tanker','LNG Tanker'],
  ['bunkering_tanker','Bunkering Tanker'],
  ['bitumen_tanker','Asphalt / Bitumen Tanker'],
  ['floating_storage','Floating Storage / Production'],
  ['inland_tanker','Inland Tanker'],
  ['water_tanker','Water Tanker'],
  ['special_tanker','Special Tanker'],
  ['unknown_tanker','Other / Unknown Tanker'],
].map(([id,label]) => ({id,label}));
export const ALL_VESSEL_TYPES = VESSEL_TYPES.map(t => t.id);
const textKey = value => typeof value === 'string' ? value.trim().toLowerCase().replace(/[_–—-]/g,' ').replace(/\s+/g,' ') : '';
const aliases = new Map();
for (const [id, texts] of [
  ['crude_oil_tanker',['crude oil tanker','crude tanker']],
  ['product_tanker',['oil products tanker','oil product tanker','product tanker','products tanker','oil products tanker / product tanker']],
  ['oil_chemical_tanker',['oil/chemical tanker','oil / chemical tanker','chemical/oil products tanker','chemical / oil products tanker','oil and chemical tanker']],
  ['chemical_tanker',['chemical tanker']],
  ['lpg_tanker',['lpg tanker','lpg carrier','liquefied petroleum gas tanker']],
  ['lng_tanker',['lng tanker','lng carrier','liquefied natural gas tanker']],
  ['bunkering_tanker',['bunkering tanker','bunker tanker']],
  ['bitumen_tanker',['asphalt tanker','bitumen tanker','asphalt / bitumen tanker','asphalt/bitumen tanker']],
  ['floating_storage',['fpso','fso','floating storage / production','floating storage/production','floating storage and offloading','floating production storage and offloading']],
  ['inland_tanker',['inland tanker']],
  ['water_tanker',['water tanker']],
  ['special_tanker',['special tanker']],
]) for (const text of texts) aliases.set(textKey(text),id);

export function aisTypeCode(vessel) {
  const value = vessel?.aisShipType ?? vessel?.vesselType ?? vessel?.shipType;
  if (value == null || String(value).trim()==='') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 255 ? n : null;
}

// Standard AIS 80–89 describes a tanker/hazard class, NOT a cargo subtype.
// Legacy collector vesselSubtype was guessed from name/destination; ignore it
// unless an upstream adapter explicitly attributes it to provider/registry data.
export function normalizeVesselType(vessel) {
  if (!vessel || typeof vessel !== 'object') return null;
  const code = aisTypeCode(vessel);
  const tanker = code !== null && code >= 80 && code <= 89;
  if (code !== null && code > 0 && code < 80) return null;
  const texts = [];
  if (['provider','registry'].includes(vessel.subtypeSource)) texts.push(vessel.vesselSubtype);
  texts.push(vessel.vesselTypeName, vessel.typeName);
  if (code === null) texts.push(vessel.vesselType);
  let category = null;
  for (const text of texts) {
    const id = aliases.get(textKey(text));
    if (id) { category = id; break; }
  }
  if (!category && (tanker || texts.some(s => ['tanker','other tanker','unknown tanker','other / unknown tanker'].includes(textKey(s))))) category = 'unknown_tanker';
  if (!category) return null;
  return {
    vesselTypeId:category,
    vesselTypeLabel:VESSEL_TYPES.find(t => t.id===category).label,
    aisShipType:code,
    classificationSource:category==='unknown_tanker' ? 'AIS tanker class; subtype unknown' : 'Explicit source type',
  };
}

export function vesselCompany(vessel) {
  const value = [vessel.owner,vessel.company,vessel.operator].find(v => typeof v==='string' && v.trim());
  return value ? ownerName(value) || '' : '';
}
export function normalizeFleet(vessels) {
  return vessels.flatMap(v => {
    const type = normalizeVesselType(v);
    return type && v.mmsi ? [{...v,...type,companyName:vesselCompany(v)}] : [];
  });
}
export function matchesVesselCompany(vessel, company) {
  return !company || textKey(vesselCompany(vessel)) === textKey(ownerName(company));
}
// Counts are AFTER the company filter and BEFORE type selection; independent
// of the map viewport. Missing company never matches a selected company.
export function vesselTypeCounts(fleet, company='') {
  const counts = Object.fromEntries(ALL_VESSEL_TYPES.map(id => [id,0]));
  for (const v of fleet) if (matchesVesselCompany(v,company) && Object.hasOwn(counts,v.vesselTypeId)) counts[v.vesselTypeId]++;
  return counts;
}
export function toggleVesselType(selected,id,checked) {
  const next = new Set(selected);
  if (ALL_VESSEL_TYPES.includes(id)) checked ? next.add(id) : next.delete(id);
  return ALL_VESSEL_TYPES.filter(id => next.has(id));
}
export function vesselSelectionState(selected) {
  const count = ALL_VESSEL_TYPES.filter(id => selected.includes(id)).length;
  return {checked:count===ALL_VESSEL_TYPES.length,indeterminate:count>0 && count<ALL_VESSEL_TYPES.length};
}
export const selectAllVesselTypes = checked => checked ? [...ALL_VESSEL_TYPES] : [];
export function matchesVesselFilters(vessel,selected,company='') {
  return selected.includes(vessel.vesselTypeId) && matchesVesselCompany(vessel,company);
}
export function vesselMapFilter(selected,company='') {
  return ['all', ['in',['get','vesselTypeId'],['literal',selected]],
    ...(company ? [['==',['get','companyKey'],textKey(ownerName(company))]] : [])];
}
export const vesselCompanyKey = vessel => textKey(vesselCompany(vessel));
