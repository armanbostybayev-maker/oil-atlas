import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { annualObservation, JODI_METRICS } from '../data/jodi.mjs';
import { createAnalytics, metricValue, metricYear } from '../analytics/atlas.mjs';
const year=(y,value=1)=>Array.from({length:12},(_,i)=>({period:`${y}-${String(i+1).padStart(2,'0')}`,value,assessment:'1'}));
test('JODI annual means weight leap-year days and convert KBD to bbl/day',()=>{
 const rows=year(2024,0);rows[1].value=1;
 assert.equal(annualObservation(rows).value,29000/366);
 assert.equal(annualObservation(year(2025,0)).value,0);
});
test('Partial, missing, invalid, mixed-year and under-verification JODI data cannot become annual totals',()=>{
 assert.equal(annualObservation(year(2025).slice(0,11)),null);
 for(const value of [null,-1,NaN,'1']) {const rows=year(2025);rows[0].value=value;assert.equal(annualObservation(rows),null);}
 const rows=year(2025);rows[0].assessment='4';assert.equal(annualObservation(rows),null);
 rows[0]={...rows[0],period:'2024-01',assessment:'1'};assert.equal(annualObservation(rows),null);
 assert.throws(()=>annualObservation([...year(2025),year(2025)[0]]),/Duplicate/);
});
test('Country analytics expose sourced trade metrics without refinery-filter dependence',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/data/atlas.json',import.meta.url)));
 const atlas=createAnalytics(data);
 const usa=atlas.stats.find(c=>c.name==='United States of America');
 assert.ok(usa.crudeExports>3000000 && usa.crudeExports<6000000);
 assert.equal(metricValue(usa,{mode:'trade',metric:'crudeExports'},[]),usa.crudeExports);
 for(const c of atlas.stats)for(const k of Object.keys(JODI_METRICS))if(Number.isFinite(c[k])){
   assert.equal(c.sources[k].year,c.years[k]);
   if(c.sources[k].source==='JODI-Oil') {assert.equal(c.sources[k].months,12);assert.match(c.sources[k].sourceUrl,/^https:\/\/www.jodidata.org\//);assert.ok(!c.sources[k].assessment.includes('4'));}
   else {assert.equal(c.sources[k].source,'OPEC ASB 2025');assert.equal(c.years[k],2024);}
 }
 assert.equal(metricYear({years:{}},'crudeExports'),'No complete year (2021–2025)');
});
