export const PIPELINE_STATUSES=['operating','construction','proposed','idle','retired','unknown'];
export const PIPELINE_PRODUCTS=['oil','gas','condensate','products','other'];
export const PIPELINE_DEFAULTS={query:'',product:'',status:'',country:'',capacityMin:'',capacityMax:'',unit:'',utilizationMin:'',utilizationMax:'',yearMin:'',yearMax:''};
export const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const first=(p,...keys)=>keys.map(k=>p[k]).find(v=>v!==null&&v!==undefined&&v!=='')??null;
const list=v=>[...new Set((Array.isArray(v)?v:String(v??'').split(';')).map(x=>String(x).trim()).filter(Boolean))];
export function safePipelineUrl(v){try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function yearDays(period){return /^\d{4}$/.test(String(period))?new Date(Date.UTC(Number(period),2,0)).getUTCDate()===29?366:365:null;}
export function normalizeFlow(value,unit,period,{product,density_kg_m3,density_source,standard_conditions}={}){
 const n=numeric(value);if(n===null||!unit)return {value:null,unit:null,conditions:null};
 const u=String(unit).trim().replaceAll('³','3'), days=yearDays(period);
 let v=null,target=null;
 const oil={ 'bbl/d':1,'bbl/day':1,'kbbl/d':1000,'Mbbl/d':1000000 };
 const gas={'m3/day':1,'m³/day':1,'mcm/day':1e6};
 if(product==='gas'){
   if(Object.hasOwn(gas,u)){v=n*gas[u];target='m³/day';}
   if(u==='bcm/year'&&days){v=n*1e9/days;target='m³/day';}
   if(u==='m3/year'&&days){v=n/days;target='m³/day';}
 }else{
   if(Object.hasOwn(oil,u)){v=n*oil[u];target='bbl/day';}
   if(u==='bbl/year'&&days){v=n/days;target='bbl/day';}
   if(['t/year','Mt/year'].includes(u)){
     v=n*(u==='Mt/year'?1e6:1);target='t/year';
     if(numeric(density_kg_m3)>0&&density_source&&days){v=v*1000/Number(density_kg_m3)/0.158987294928/days;target='bbl/day';}
   }
 }
 return {value:v,unit:target,conditions:product==='gas'?standard_conditions||null:null};
}
export function derivePipeline(p){
 const c=normalizeFlow(p.capacity_value,p.capacity_unit,p.capacity_period,{...p,standard_conditions:p.capacity_standard_conditions});
 const q=normalizeFlow(p.throughput_value,p.throughput_unit,p.throughput_period,{...p,standard_conditions:p.throughput_standard_conditions});
 const knownProduct=p.product!=='other';
 const reasons=[];
 if(c.value===null||q.value===null)reasons.push('missing_or_unsupported_measurement');
 if(!p.capacity_period||p.capacity_period!==p.throughput_period)reasons.push('incompatible_period');
 if(!knownProduct||(p.capacity_product||p.product)!==(p.throughput_product||p.product))reasons.push('incompatible_product');
 if(!c.unit||c.unit!==q.unit)reasons.push('incompatible_units');
 if(!['design','available','technical'].includes(p.capacity_kind)||p.throughput_kind!=='actual')reasons.push('not_observed_comparable');
 if(p.product==='gas'&&(!c.conditions||c.conditions!==q.conditions))reasons.push('gas_conditions_unknown_or_different');
 if(p.attribute_conflicts?.length)reasons.push('conflicting_segments');
 const comparable=!reasons.length;
 const utilization=comparable&&c.value>0?q.value/c.value*100:null;
 return {...p,capacity_normalized:c.value,capacity_normalized_unit:c.unit,throughput_normalized:q.value,throughput_normalized_unit:q.unit,
 utilization_pct:utilization,spare_capacity:comparable?c.value-q.value:null,comparison_issues:reasons,
 data_quality:{missing:['operator','length_km','capacity_value','throughput_value','commissioning_year','source_release'].filter(k=>p[k]===null||p[k]===undefined),anomalies:[...(utilization>100?['utilization_over_100']:[]),...(comparable&&c.value===0&&q.value>0?['flow_with_zero_capacity']:[])],conflicts:p.attribute_conflicts||[]}};
}
export function normalizePipeline(feature,type='oil',index=0){
 const p=feature.properties||{}, product=String(first(p,'product','fuel','Product','Fuel')||type).toLowerCase();
 const status=String(first(p,'status','Status')||'unknown').toLowerCase();
 const id=String(first(p,'source_id','id','GEM ID','GEM_ID')??`record-${index}`);
 const r={id:`${type}:${id}`,source_id:id,name:first(p,'name','Pipeline Name','Project Name')||id,
 product:PIPELINE_PRODUCTS.includes(product)?product:'other',status:PIPELINE_STATUSES.includes(status)?status:status==='mothballed'?'idle':'unknown',
 operator:first(p,'operator','Operator'),owners:first(p,'owners','Owners','Owner')===null?null:list(first(p,'owners','Owners','Owner')),
 countries:list(first(p,'countries','Countries')),length_km:numeric(first(p,'length_km','Length (km)')),
 commissioning_year:numeric(first(p,'commissioning_year','Start year')),source:first(p,'source'),source_url:safePipelineUrl(first(p,'source_url')),
 source_release:first(p,'source_release'),source_date:first(p,'source_date'),geometry_accuracy:first(p,'geometry_accuracy','route_accuracy')||'unknown',
 capacity_value:numeric(first(p,'capacity_value')),capacity_unit:first(p,'capacity_unit'),capacity_period:first(p,'capacity_period'),capacity_kind:first(p,'capacity_kind'),
 throughput_value:numeric(first(p,'throughput_value')),throughput_unit:first(p,'throughput_unit'),throughput_period:first(p,'throughput_period'),throughput_kind:first(p,'throughput_kind'),
 capacity_source:first(p,'capacity_source'),throughput_source:first(p,'throughput_source'),capacity_product:first(p,'capacity_product'),throughput_product:first(p,'throughput_product'),
 capacity_standard_conditions:first(p,'capacity_standard_conditions'),throughput_standard_conditions:first(p,'throughput_standard_conditions'),
 density_kg_m3:numeric(first(p,'density_kg_m3')),density_source:first(p,'density_source'),
 geometry:feature.geometry,original_properties:[structuredClone(p)],attribute_conflicts:[]};
 return derivePipeline(r);
}
export function geometryLines(g){return g?.type==='LineString'?[g.coordinates]:g?.type==='MultiLineString'?g.coordinates:[];}
export function validatePipelineGeometry(g){
 const lines=geometryLines(g);if(!lines.length)throw Error('Pipeline geometry must contain lines');
 for(const line of lines){if(line.length<2)throw Error('Pipeline line needs two points');for(const p of line)if(!Array.isArray(p)||p.length<2||!p.slice(0,2).every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)throw Error('Invalid WGS84 coordinate');}
}
const radians=x=>x*Math.PI/180;
function distance(a,b){const dlat=radians(b[1]-a[1]),dlon=radians(b[0]-a[0]),h=Math.sin(dlat/2)**2+Math.cos(radians(a[1]))*Math.cos(radians(b[1]))*Math.sin(dlon/2)**2;return 6371.0088*2*Math.asin(Math.min(1,Math.sqrt(h)));}
export function uniqueGeometryLength(records){
 const edges=new Set();let sum=0;
 for(const p of records)for(const line of geometryLines(p.geometry))for(let i=1;i<line.length;i++){
   const a=line[i-1].slice(0,2),b=line[i].slice(0,2),key=[JSON.stringify(a),JSON.stringify(b)].sort().join('|');
   if(!edges.has(key)){edges.add(key);sum+=distance(a,b);}
 }
 return sum;
}
export function pipelineRecords(collection,type){
 if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))throw Error('Expected FeatureCollection');
 const records=new Map();
 collection.features.forEach((f,i)=>{
   validatePipelineGeometry(f.geometry);const p=normalizePipeline(f,type,i),previous=records.get(p.id);
   if(!previous){records.set(p.id,p);return;}
   previous.geometry={type:'MultiLineString',coordinates:[...geometryLines(previous.geometry),...geometryLines(p.geometry)]};
   previous.countries=[...new Set([...previous.countries,...p.countries])];previous.original_properties.push(...p.original_properties);
   for(const key of ['length_km','product','status','capacity_value','capacity_unit','capacity_period','capacity_kind','throughput_value','throughput_unit','throughput_period','throughput_kind','capacity_standard_conditions','throughput_standard_conditions'])if(previous[key]!==p[key]){
     previous.attribute_conflicts.push(key);previous[key]=['product','status'].includes(key)?'unknown':null;
   }
 });
 return [...records.values()].map(p=>derivePipeline({...p,geometry_length_estimate_km:uniqueGeometryLength([p])}));
}
export function filterPipelines(records,f=PIPELINE_DEFAULTS){
 const query=(f.query||'').toLowerCase().trim();
 const range=(v,a,b)=>(a===''||a===undefined||v!==null&&v>=Number(a))&&(b===''||b===undefined||v!==null&&v<=Number(b));
 return records.filter(p=>(!query||`${p.name} ${p.operator||''} ${p.countries.join(' ')}`.toLowerCase().includes(query))&&(!f.product||p.product===f.product)&&(!f.status||p.status===f.status)&&(!f.country||p.countries.includes(f.country))&&(!f.unit||p.capacity_normalized_unit===f.unit)&&
  // A numeric capacity threshold without a unit would compare unrelated dimensions.
  ((f.capacityMin===''&&f.capacityMax==='')||!!f.unit)&&range(p.capacity_normalized,f.capacityMin,f.capacityMax)&&range(p.utilization_pct,f.utilizationMin,f.utilizationMax)&&range(p.commissioning_year,f.yearMin,f.yearMax));
}
export function pipelineGroupKey(p){return [p.product,p.capacity_normalized_unit||p.capacity_unit||'unknown',p.capacity_period||'unknown',p.capacity_kind||'unknown',p.capacity_standard_conditions||''].join(' · ');}
export function pipelineSummary(records){
 const unique=[...new Map(records.map(p=>[p.id,p])).values()],known=unique.filter(p=>p.capacity_normalized!==null),observed=unique.filter(p=>p.utilization_pct!==null);
 const counts=key=>Object.fromEntries([...new Set(unique.map(p=>p[key]||'unknown'))].map(v=>[v,unique.filter(p=>(p[key]||'unknown')===v).length]));
 const countries=[...new Set(unique.flatMap(p=>p.countries))].map(country=>{const rows=unique.filter(p=>p.countries.includes(country));return {country,count:rows.length,lengthEstimate:uniqueGeometryLength(rows),capacity:rows.filter(p=>p.capacity_normalized!==null).length,flow:rows.filter(p=>p.throughput_kind==='actual'&&p.throughput_value!==null).length};});
 return {total:unique.length,lengthEstimate:uniqueGeometryLength(unique),operating:unique.filter(p=>p.status==='operating').length,construction:unique.filter(p=>p.status==='construction').length,knownCapacity:known.length,knownFlow:unique.filter(p=>p.throughput_kind==='actual'&&p.throughput_value!==null).length,knownUtilization:observed.length,
 meanUtilization:observed.length?observed.reduce((s,p)=>s+p.utilization_pct,0)/observed.length:null,missingUtilization:unique.length-observed.length,
 utilizationBins:[observed.filter(p=>p.utilization_pct<=25).length,observed.filter(p=>p.utilization_pct>25&&p.utilization_pct<=50).length,observed.filter(p=>p.utilization_pct>50&&p.utilization_pct<=75).length,observed.filter(p=>p.utilization_pct>75&&p.utilization_pct<=100).length,observed.filter(p=>p.utilization_pct>100).length],
 statuses:counts('status'),products:counts('product'),dates:counts('source_date'),countries,
 missing:Object.fromEntries(['capacity_value','throughput_value','operator','commissioning_year','source_release'].map(k=>[k,unique.filter(p=>p[k]===null).length])),
 capacityGroups:[...new Set(known.map(pipelineGroupKey))].map(key=>{const rows=known.filter(p=>pipelineGroupKey(p)===key),max=Math.max(...rows.map(p=>p.capacity_normalized));return {key,max,count:rows.length,bins:[0,1,2,3].map(i=>rows.filter(p=>max===0?i===0:p.capacity_normalized/max>(i===0?-1:i/4)&&p.capacity_normalized/max<=(i+1)/4).length)};})};
}
export function pipelineScenario(p,percent){const n=numeric(percent);return p.capacity_normalized===null||n===null||n>100?null:{label:'Scenario, not observed data',percent:n,flow:p.capacity_normalized*n/100,unit:p.capacity_normalized_unit};}
export function pipelineGeoJSON(records){return {type:'FeatureCollection',features:records.map(p=>({type:'Feature',id:p.id,geometry:p.geometry,properties:{id:p.id,product:p.product,status:p.status,capacity:p.capacity_normalized,unit:p.capacity_normalized_unit,utilization:p.utilization_pct}}))};}
