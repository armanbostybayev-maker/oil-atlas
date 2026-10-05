import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePipeline,pipelineRecords,normalizeFlow,filterPipelines,pipelineSummary,pipelineScenario,uniqueGeometryLength,PIPELINE_DEFAULTS,safePipelineUrl} from '../analytics/pipelines.mjs';
const feature=(properties={},coordinates=[[0,0],[1,0]])=>({type:'Feature',geometry:{type:'LineString',coordinates},properties:{source_id:'p',name:'Example',fuel:'Oil',status:'operating',countries:'A; B; A',...properties}});
const measured=(extra={})=>normalizePipeline(feature({capacity_value:100,capacity_unit:'kbbl/d',capacity_period:'2024',capacity_kind:'design',throughput_value:120,throughput_unit:'kbbl/d',throughput_period:'2024',throughput_kind:'actual',...extra}));
test('source properties are separate; absent is null while measured zero is retained',()=>{
 const f=feature({route_accuracy:'medium',custom:'retained'}),p=normalizePipeline(f);
 assert.equal(p.capacity_value,null);assert.equal(p.operator,null);assert.equal(p.utilization_pct,null);assert.equal(p.geometry_accuracy,'medium');assert.deepEqual(p.countries,['A','B']);assert.equal(p.original_properties[0].custom,'retained');assert.notEqual(p.original_properties[0],f.properties);
 assert.equal(measured({throughput_value:0}).utilization_pct,0);
 assert.equal(normalizePipeline(feature({fuel:'NGL'})).product,'other');
 assert.equal(normalizePipeline(feature({Owner:'Owner only'})).operator,null);
 assert.equal(normalizePipeline(feature({capacity_value:false})).capacity_value,null);
 assert.equal(measured({capacity_period:2024,throughput_period:'2024'}).utilization_pct,120);
});
test('units retain case and density conversions require documentation and a calendar year',()=>{
 assert.equal(normalizeFlow(1,'kbbl/d','2024',{product:'oil'}).value,1000);
 assert.equal(normalizeFlow(1,'Mbbl/d','2024',{product:'oil'}).value,1e6);
 assert.equal(normalizeFlow(1,'Mt/year','2024',{product:'oil'}).unit,'t/year');
 assert.equal(normalizeFlow(1,'Mt/year','2024',{product:'oil',density_kg_m3:850}).unit,'t/year');
 const converted=normalizeFlow(1,'Mt/year','2024',{product:'oil',density_kg_m3:850,density_source:'Lab measurement'});
 assert.ok(Math.abs(converted.value-1e9/850/0.158987294928/366)<1e-6);
 assert.equal(normalizeFlow(1,'bcm/year','2024',{product:'gas'}).value,1e9/366);
 assert.equal(normalizeFlow(1,'bcm/year',null,{product:'gas'}).value,null);
 assert.equal(normalizeFlow(null,'bbl/d','2024',{product:'oil'}).value,null);
});
test('observed utilization may exceed 100 and spare capacity may be negative',()=>{
 const p=measured();assert.equal(p.utilization_pct,120);assert.equal(p.spare_capacity,-20000);assert.deepEqual(p.data_quality.anomalies,['utilization_over_100']);
 assert.equal(measured({capacity_value:0}).utilization_pct,null);
 assert.ok(measured({capacity_value:0}).data_quality.anomalies.includes('flow_with_zero_capacity'));
});
test('period, dimension, product and measurement types must be comparable',()=>{
 for(const patch of [{throughput_period:'2023'},{throughput_unit:'t/year'},{throughput_kind:'estimated'},{capacity_kind:'forecast'},{capacity_kind:null},{throughput_product:'gas'},{throughput_value:null}])assert.equal(measured(patch).utilization_pct,null,JSON.stringify(patch));
 const p=measured({capacity_unit:'bbl/d',capacity_value:100,throughput_unit:'bbl/year',throughput_value:36600});assert.equal(p.utilization_pct,100);
});
test('gas comparison refuses unknown or incompatible standard conditions',()=>{
 const raw={fuel:'Gas',capacity_unit:'mcm/day',throughput_unit:'m3/day',capacity_value:1,throughput_value:500000};
 assert.equal(measured(raw).utilization_pct,null);
 assert.equal(measured({...raw,capacity_standard_conditions:'15C,101.325kPa',throughput_standard_conditions:'15C,101.325kPa'}).utilization_pct,50);
 assert.equal(measured({...raw,capacity_standard_conditions:'0C',throughput_standard_conditions:'15C'}).utilization_pct,null);
 assert.equal(pipelineSummary([measured({...raw,source_id:'gas-a'}),measured({...raw,source_id:'gas-b'})]).capacityGroups.length,2);
});
test('segments and countries deduplicate without summing project capacity',()=>{
 const fc={type:'FeatureCollection',features:[feature({capacity_value:1,capacity_unit:'kbbl/d'}),feature({capacity_value:1,capacity_unit:'kbbl/d'},[[1,0],[0,0]])]};
 const rows=pipelineRecords(fc,'oil');assert.equal(rows.length,1);assert.equal(rows[0].original_properties.length,2);assert.equal(rows[0].capacity_normalized,1000);
 assert.ok(Math.abs(uniqueGeometryLength(rows)-111.195)<.01);assert.equal(pipelineSummary([...rows,...rows]).total,1);assert.equal(pipelineSummary(rows).countries.length,2);
 fc.features[1].properties.capacity_value=2;assert.equal(pipelineRecords(fc,'oil')[0].capacity_normalized,null);
});
test('filters never compare dimensionless capacity thresholds, and null is not zero',()=>{
 const rows=[measured(),normalizePipeline(feature({source_id:'missing'}))];
 assert.equal(filterPipelines(rows,{...PIPELINE_DEFAULTS,capacityMin:'1'}).length,0);
 assert.equal(filterPipelines(rows,{...PIPELINE_DEFAULTS,capacityMin:'1',unit:'bbl/day'}).length,1);
 assert.equal(filterPipelines(rows,{...PIPELINE_DEFAULTS,utilizationMin:'0'}).length,1);
 assert.equal(filterPipelines(rows,{...PIPELINE_DEFAULTS,query:'example',country:'B'}).length,2);
 assert.equal(filterPipelines(rows,{...PIPELINE_DEFAULTS,yearMin:'2000'}).length,0);
});
test('coverage accompanies utilization; scenarios never mutate observed data',()=>{
 const p=measured({throughput_value:null});const s=pipelineScenario(p,70);assert.equal(s.flow,70000);assert.equal(p.utilization_pct,null);assert.equal(pipelineScenario(p,101),null);
 const stats=pipelineSummary([p,measured({source_id:'b'})]);assert.equal(stats.knownUtilization,1);assert.equal(stats.missingUtilization,1);assert.equal(stats.meanUtilization,120);assert.deepEqual(stats.utilizationBins,[0,0,0,0,1]);
 assert.equal(pipelineScenario(normalizePipeline(feature()),70),null);
});
test('invalid coordinates and executable source links are rejected',()=>{
 assert.throws(()=>pipelineRecords({type:'FeatureCollection',features:[feature({},[[181,0],[0,0]])]},'oil'),/Invalid/);
 assert.equal(safePipelineUrl('javascript:alert(1)'),null);assert.equal(safePipelineUrl('https://user:pass@example.org'),null);
});
