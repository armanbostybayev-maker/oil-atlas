import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVesselType,normalizeFleet,ALL_VESSEL_TYPES,ALL_DEADWEIGHT_CLASSES,deadweightClass,deadweightClassCounts,toggleDeadweightClass,toggleVesselType,selectAllVesselTypes,vesselSelectionState,vesselTypeCounts,matchesVesselFilters,vesselMapFilter} from '../map/vessel-types.mjs';
import {tankerFeatures, TankerLayer} from '../map/TankerLayer.mjs';
import {parseAisTimestamp} from '../map/ais-time.mjs';
import {createCollector} from '../server/ais-collector.mjs';
import {EventEmitter,once} from 'node:events';

test('Every AIS tanker code 80–89 remains unknown tanker without a reliable subtype',()=>{
  for(let code=80;code<=89;code++){
    const v=normalizeVesselType({vesselType:code});
    assert.equal(v.vesselTypeId,'unknown_tanker');
    assert.equal(v.aisShipType,code);
  }
  assert.equal(normalizeVesselType({vesselType:'Tanker'}).vesselTypeId,'unknown_tanker');
  assert.equal(normalizeVesselType({vesselType:'89'}).aisShipType,89);
});

for(const [label,id] of [
  ['Crude Oil Tanker','crude_oil_tanker'],['Oil Products Tanker','product_tanker'],
  ['Oil/Chemical Tanker','oil_chemical_tanker'],['Chemical Tanker','chemical_tanker'],
  ['LPG Tanker','lpg_tanker'],['LNG Tanker','lng_tanker'],['Bunkering Tanker','bunkering_tanker'],
  ['Asphalt / Bitumen Tanker','bitumen_tanker'],['FPSO','floating_storage'],
  ['Inland Tanker','inland_tanker'],['Water Tanker','water_tanker'],['Special Tanker','special_tanker'],
]) test(`Explicit source type: ${label}`,()=>{
  assert.equal(normalizeVesselType({vesselType:80,vesselTypeName:label}).vesselTypeId,id);
  assert.equal(normalizeVesselType({vesselType:null,vesselSubtype:label,subtypeSource:'registry'}).vesselTypeId,id);
});

test('Names/destination and legacy inferred subtypes cannot classify a vessel; cargo/passenger codes prevail',()=>{
  assert.equal(normalizeVesselType({name:'LNG FPSO OIL',destination:'BUNKER',vesselType:null}),null);
  assert.equal(normalizeVesselType({vesselType:80,name:'FPSO',vesselSubtype:'Floating Storage/Production'}).vesselTypeId,'unknown_tanker');
  for(const code of [30,52,60,69,70,79]) assert.equal(normalizeVesselType({vesselType:code,vesselTypeName:'LNG Tanker'}),null);
  for(const v of [null,{}, {vesselType:null},{vesselType:0},{vesselType:''},{vesselType:'Cargo'},{vesselType:90}]) assert.equal(normalizeVesselType(v),null);
  assert.equal(normalizeVesselType({vesselType:90,vesselTypeName:'FSO'}).vesselTypeId,'floating_storage');
});

test('Type selection supports toggle, select all, deselect all and partial state',()=>{
  const selected=toggleVesselType(ALL_VESSEL_TYPES,'lng_tanker',false);
  assert.equal(selected.includes('lng_tanker'),false);
  assert.deepEqual(vesselSelectionState(selected),{checked:false,indeterminate:true});
  assert.deepEqual(toggleVesselType(selected,'lng_tanker',true),ALL_VESSEL_TYPES);
  assert.deepEqual(selectAllVesselTypes(false),[]);
  assert.deepEqual(vesselSelectionState([]),{checked:false,indeterminate:false});
  assert.deepEqual(vesselSelectionState(selectAllVesselTypes(true)),{checked:true,indeterminate:false});
});

test('Deadweight classes use non-overlapping boundaries and combine with vessel filters',()=>{
  for (const [value,id] of [[6000,'gp'],[24999,'gp'],[25000,'mr'],[45000,'lr1'],[80000,'lr2'],[160000,'vlcc'],[320000,'vlcc'],[320001,'ulcc']]) {
    assert.equal(deadweightClass(value),id);
  }
  assert.equal(deadweightClass(5999),null);
  assert.equal(deadweightClass(null),null);
  const fleet=normalizeFleet([
    {mmsi:'gp',vesselType:80,deadweight:6000},
    {mmsi:'mr',vesselType:80,deadweight:25000},
    {mmsi:'unknown',vesselType:80},
  ]);
  assert.deepEqual(deadweightClassCounts(fleet),{gp:1,mr:1,lr1:0,lr2:0,vlcc:0,ulcc:0});
  assert.equal(matchesVesselFilters(fleet[2],ALL_VESSEL_TYPES,'',ALL_DEADWEIGHT_CLASSES),true);
  const onlyGp=toggleDeadweightClass(ALL_DEADWEIGHT_CLASSES,'mr',false).filter(id=>id==='gp');
  assert.deepEqual(fleet.filter(v=>matchesVesselFilters(v,ALL_VESSEL_TYPES,'',onlyGp)).map(v=>v.mmsi),['gp']);
  assert.deepEqual(vesselMapFilter(ALL_VESSEL_TYPES,'',onlyGp)[2],['in',['get','deadweightClassId'],['literal',['gp']]]);
});

test('Counts precede type filtering, follow company filtering and do not depend on geography',()=>{
  const fleet=normalizeFleet([
    {mmsi:'1',vesselType:80,vesselTypeName:'LNG Tanker',owner:'BP plc',lat:-35,lon:179},
    {mmsi:'2',vesselType:80,company:'BP',lat:55,lon:-179},
    {mmsi:'3',vesselType:80,vesselTypeName:'LNG Tanker',owner:'Shell'},
    {mmsi:'4',vesselType:80,vesselTypeName:'LNG Tanker'},
    {mmsi:'5',vesselType:70,owner:'BP'},
  ]);
  const before=vesselTypeCounts(fleet,'BP');
  assert.equal(before.lng_tanker,1);assert.equal(before.unknown_tanker,1);
  const selected=toggleVesselType(ALL_VESSEL_TYPES,'lng_tanker',false);
  assert.deepEqual(fleet.filter(v=>matchesVesselFilters(v,selected,'BP')).map(v=>v.mmsi),['2']);
  assert.deepEqual(vesselTypeCounts(fleet,'BP'),before);
  assert.equal(vesselTypeCounts(fleet).lng_tanker,3);
  assert.equal(fleet.length,4);
});

test('Point and history features carry matching type/company properties and share one map filter',()=>{
  const fleet=normalizeFleet([{mmsi:'1',vesselType:80,vesselTypeName:'LNG Tanker',owner:'BP',lat:20,lon:40,history:[
    {lat:20,lon:40,timestamp:'2026-09-17 16:00:00.908306668 +0000 UTC'},
    {lat:20,lon:40.01,timestamp:'2026-09-17 16:01:00.908306668 +0000 UTC'},
  ]}]);
  const {points,routes}=tankerFeatures(fleet);
  assert.equal(points.features[0].properties.vesselTypeId,'lng_tanker');
  assert.equal(points.features[0].properties.aisShipType,80);
  assert.equal(routes.features[0].properties.vesselTypeId,'lng_tanker');
  assert.equal(routes.features[0].properties.companyKey,'bp');
  const calls=[];
  TankerLayer.prototype.setFilter.call({map:{setFilter:(...args)=>calls.push(args)}},['lng_tanker'],'BP');
  assert.deepEqual(calls,[['tankers',vesselMapFilter(['lng_tanker'],'BP')],['tanker-history',vesselMapFilter(['lng_tanker'],'BP')]]);
});

test('AISStream nanosecond timestamp has a real UTC time; missing dates remain missing',()=>{
  assert.equal(parseAisTimestamp('2026-09-17 16:06:10.908306668 +0000 UTC'),Date.parse('2026-09-17T16:06:10.908Z'));
  assert.equal(parseAisTimestamp(null),null);assert.equal(parseAisTimestamp('invalid'),null);
});

test('Collector subscribes worldwide and returns every tanker class, with no cargo or name-based FPSO guesses',async()=>{
  let subscription;
  class Socket extends EventEmitter{
    constructor(){super();queueMicrotask(()=>this.emit('open'));}
    send(s){subscription=JSON.parse(s);}
    terminate(){this.emit('close');}
  }
  const collector=createCollector({apiKey:'test',port:0,host:'127.0.0.1',WebSocketImpl:Socket});
  collector.start();
  try{
    await once(collector.server,'listening');
    for(let code=70;code<=89;code++){
      collector.ingest({MessageType:'ShipStaticData',MetaData:{MMSI:code},Message:{ShipStaticData:{Type:code,Name:'FPSO TEST'}}});
      collector.ingest({MessageType:'PositionReport',MetaData:{MMSI:code},Message:{PositionReport:{Latitude:code%2 ? -35 : 35,Longitude:code%2 ? -170 : 170}}});
    }
    const fleet=collector.getTankers();
    assert.equal(fleet.length,10);
    assert.ok(fleet.every(v=>v.vesselTypeId==='unknown_tanker'));
    assert.deepEqual(subscription.BoundingBoxes,[[[-90,-180],[90,180]]]);
  }finally{collector.stop();}
});
