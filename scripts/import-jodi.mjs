import fs from 'node:fs';
import readline from 'node:readline';
import { createHash } from 'node:crypto';
import { JODI_METRICS, annualObservation } from '../data/jodi.mjs';
import { countryCode } from '../utils/country-display.mjs';
const years=[2025,2024,2023,2022,2021];
const base=JSON.parse(fs.readFileSync('data/sources/base.json','utf8'));
const enrichment=JSON.parse(fs.readFileSync('data/sources/enrichment.json','utf8'));
const opec=JSON.parse(fs.readFileSync('data/sources/opec-exports-2024.json','utf8'));
const aliases={"People's Republic of China":'CN','Myanmar':'MM','Bosnia and Herzegovina':'BA','Trinidad and Tobago':'TT','Hong Kong':'HK','Macau':'MO','The Gambia':'GM','The Bahamas':'BS','South Korea':'KR','North Korea':'KP','Czech Republic':'CZ','Democratic Republic of the Congo':'CD','Republic of the Congo':'CG','Ivory Coast':'CI','Laos':'LA','Swaziland':'SZ','Turkey':'TR','Turkiye':'TR','East Timor':'TL','Brunei':'BN','Palestine':'PS'};
const observations=new Map(), files=[];
for (const year of years) for (const kind of ['primary','secondary']) {
  const file=`data/sources/jodi/${kind}-${year}.csv`;
  const sourceUrl=`https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/${kind}/${year}.csv`;
  const digest=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  files.push({file,sourceUrl,sha256:digest});
  const series=new Map(); let header=true;
  const lookups=new Map(Object.entries(JODI_METRICS).filter(([,v])=>v[0]===kind).map(([key,v])=>[v[1]+'|'+v[2],key]));
  for await (const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})) {
    if(header){if(line.trim()!=='REF_AREA,TIME_PERIOD,ENERGY_PRODUCT,FLOW_BREAKDOWN,UNIT_MEASURE,OBS_VALUE,ASSESSMENT_CODE') throw Error('Unexpected JODI columns');header=false;continue;}
    const [code,period,product,flow,unit,raw,assessment]=line.trim().split(',');
    const key=lookups.get(product+'|'+flow);
    if(!key || unit!=='KBD') continue;
    const id=code+'|'+key;
    if(!series.has(id)) series.set(id,[]);
    series.get(id).push({period,value:/^\d+(\.\d+)?$/.test(raw)?Number(raw):null,assessment});
  }
  for(const [id,rows] of series){const annual=annualObservation(rows);if(annual&&!observations.has(id)) observations.set(id,{...annual,source:'JODI-Oil',sourceUrl,unit:'bbl/day'});}
}
const coverage=Object.fromEntries(Object.keys(JODI_METRICS).map(k=>[k,0])), unmatched=[];
for(const c of base.countries){
 const code=aliases[c.name] || countryCode(c.name);
 if(!code) unmatched.push(c.name);
 const patch=enrichment.countries[c.id] ||= {};
 patch.values ||= {};patch.years ||= {};patch.sources ||= {};
 for(const key of Object.keys(JODI_METRICS)){
   let observation=observations.get(code+'|'+key);
   if (Number.isFinite(opec[key]?.[code]) && (!observation || observation.year < opec.year)) observation={value:opec[key][code]*1000,year:opec.year,source:opec.source,sourceUrl:opec.sourceUrl,unit:'bbl/day',table:opec.tables[key],note:opec.note,retrievedAt:opec.retrievedAt};
   patch.values[key]=observation?.value ?? null;patch.years[key]=observation?.year ?? null;
   patch.sources[key]=observation ? {retrievedAt:'2026-09-23',...observation} : {source:'JODI-Oil / OPEC ASB 2025',missing:true,checkedYears:years};
   if(observation)coverage[key]++;
 }
}
fs.writeFileSync('data/sources/enrichment.json',JSON.stringify(enrichment,null,2));
fs.writeFileSync('data/sources/jodi/manifest.json',JSON.stringify({retrievedAt:'2026-09-23',years,files,coverage,unmatched},null,2));
console.log(JSON.stringify({coverage,unmatched},null,2));
