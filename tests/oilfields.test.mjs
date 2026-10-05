import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeOilfields, filterOilfields, inFieldBounds, oilfieldAnalytics, oilfieldGeoJSON, fieldYear, EMPTY_FIELD_FILTERS, safeSourceUrl } from '../analytics/oilfields.mjs';
const registry = JSON.parse(readFileSync(new URL('../public/data/oilfields.json',import.meta.url),'utf8'));
const fields = decodeOilfields(registry);
const fixture = [
  {id:'zero',name:'Zero',localName:'Ноль',country:'A',operator:'One',status:'operating',fuelType:'oil',objectType:'field',lat:10,lon:179,coordinateAccuracy:'exact',oilReserves:0,oilProduction:0,discoveryYear:2000,productionStart:'2025 (expected)'},
  {id:'blank',name:'Blank',country:'B',operator:'Two',status:'discovered',fuelType:'oil and gas',objectType:'block',lat:10,lon:-179,coordinateAccuracy:'approximate',oilReserves:null,gasProduction:2,discoveryYear:null,productionStart:null},
  {id:'invalid',name:'Invalid',country:'A',status:null,lat:null,lon:0,oilProduction:null},
];
test('Registry preserves every record and reconciles valid coordinates and exact/approximate counts',() => {
  assert.equal(fields.length,7066);
  assert.equal(oilfieldGeoJSON(fields).features.length,6491);
  assert.equal(registry.quality.invalidCoordinateIds.length,575);
  const stats = oilfieldAnalytics(fields);
  assert.equal(stats.exact,5497); assert.equal(stats.approximate,994);
  assert.equal(stats.statuses.reduce((sum,s) => sum+s.count,0),stats.total);
  assert.equal(new Set(fields.map(f=>f.id)).size,7066);
  assert.equal(fields.find(f=>f.id==='OG0000001').oilProduction,null);
  assert.equal(fields.find(f=>f.id==='OG0000001').oilReserves,1501);
});
test('Filters distinguish missing and zero, combine criteria, and retain invalid records for search',() => {
  assert.deepEqual(filterOilfields(fixture,{query:'ноль'}).map(f=>f.id),['zero']);
  assert.equal(filterOilfields(fixture,{reserves:'yes'}).length,1);
  assert.equal(filterOilfields(fixture,{production:'yes'}).length,2);
  assert.equal(filterOilfields(fixture,{production:'no'}).length,1);
  assert.equal(filterOilfields(fixture,{country:'A',status:'operating',operator:'One',fuelType:'oil',objectType:'field',accuracy:'exact',discoveryFrom:'1990',discoveryTo:'2000',startFrom:'2025',startTo:'2025'}).length,1);
  assert.equal(filterOilfields(fixture,{discoveryFrom:'2001'}).length,0);
  assert.equal(filterOilfields(fixture,{query:'Invalid'}).length,1);
  assert.equal(oilfieldAnalytics(fixture).total,2);
  assert.equal(oilfieldAnalytics(fixture).withReserves,1);
  assert.equal(filterOilfields(fixture,EMPTY_FIELD_FILTERS).length,3);
});
test('Viewport filters handle antimeridian, global extent and invalid coordinates',() => {
  assert.equal(inFieldBounds(fixture[0],[170,-20,-170,20]),true);
  assert.equal(inFieldBounds(fixture[1],[170,-20,190,20]),true);
  assert.equal(inFieldBounds(fixture[0],[-20,-20,20,20]),false);
  assert.equal(inFieldBounds(fixture[0],[-220,-90,220,90]),true);
  assert.equal(inFieldBounds(fixture[2],null),false);
  assert.equal(filterOilfields(fixture,{bounds:[170,-20,190,20]}).length,2);
  assert.equal(oilfieldAnalytics(fixture,[-180,-20,-170,20]).total,1);
});
test('Years retain uncertainty text and source links cannot execute content',() => {
  assert.equal(fieldYear('2025 (expected)'),2025);
  assert.equal(fieldYear(null),null);
  assert.equal(fieldYear('unknown'),null);
  assert.equal(safeSourceUrl('javascript:alert(1)'),null);
  assert.equal(safeSourceUrl('https://example.com/field'),'https://example.com/field');
  assert.throws(()=>decodeOilfields({schemaVersion:1,columns:['id','name','lat','lon'],rows:[['a'],['a']]}),/Duplicate/);
});
