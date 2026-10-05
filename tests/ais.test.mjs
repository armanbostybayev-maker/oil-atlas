import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createCollector } from '../server/ais-collector.mjs';
import { startAisPolling, snapshotFreshness } from '../map/ais-polling.mjs';

const waitFor = async predicate => {
  const deadline = Date.now()+2000;
  while (!predicate()) { if (Date.now()>deadline) throw new Error('Condition timed out'); await delay(5); }
};

test('Freshness uses actual positions, never a newly generated HTTP response timestamp', () => {
  const now = Date.now();
  assert.equal(snapshotFreshness({generatedAt:new Date(now).toISOString(),vessels:[{receivedAt:now-120000}]},now).fresh,false);
  assert.equal(snapshotFreshness({vessels:[{receivedAt:now}]},now).fresh,true);
  assert.equal(snapshotFreshness({vessels:[],stream:{ok:false,connected:false,lastPositionAt:new Date(now).toISOString()}},now).fresh,false);
  assert.equal(snapshotFreshness({vessels:[]},now).fresh,false);
});

test('Sequential polling retains positions on failure and aborts on cleanup', async () => {
  const updates = [];
  let requests = 0, active = 0, maxActive = 0, aborted = false;
  const stop = startAisPolling({interval:5,timeout:100,onUpdate:s => updates.push(s),load:async ({signal}) => {
    requests++; active++; maxActive = Math.max(maxActive,active);
    signal.addEventListener('abort',() => { aborted=true; },{once:true});
    try { await delay(15,null,{signal}); if (requests>1) throw new Error('offline'); return {vessels:[{mmsi:'1',receivedAt:Date.now()}]}; }
    finally { active--; }
  }});
  try {
    await waitFor(() => updates.length>=2);
    assert.equal(updates[0].status,'live');
    assert.equal(updates[1].status,'stale');
    assert.equal(updates[1].vessels[0].mmsi,'1');
    assert.equal(updates[1].lastSuccessAt,updates[0].lastSuccessAt);
    assert.equal(maxActive,1);
  } finally { stop(); }
  const count = updates.length, requestCount = requests;
  await delay(30);
  assert.equal(updates.length,count);
  assert.equal(requests,requestCount);
  assert.equal(aborted,true);
});

test('Timeout aborts a stalled request; unmount does not publish or schedule more requests', async () => {
  const updates = [];
  let aborted=false, calls=0;
  const stop = startAisPolling({interval:50,timeout:15,onUpdate:s=>updates.push(s),load:({signal}) => {
    calls++;
    return new Promise((_,reject) => { signal.addEventListener('abort',() => {aborted=true;reject(new Error('aborted'));},{once:true}); });
  }});
  try { await waitFor(()=>updates.length===1); assert.equal(updates[0].status,'offline'); assert.equal(aborted,true); }
  finally { stop(); }
  await delay(65);
  assert.equal(calls,1);
  let resolve;
  const stopPending = startAisPolling({onUpdate:()=>assert.fail('Update after unmount'),load:()=>new Promise(r=>{resolve=r;})});
  stopPending();
  resolve({vessels:[]});
  await delay(5);
});

test('Collector health, independent TTL cleanup and shutdown work without an external AIS connection', async () => {
  let time = Date.now();
  let socket;
  class FakeSocket extends EventEmitter {
    constructor() { super(); socket=this; queueMicrotask(()=>this.emit('open')); }
    send() {}
    terminate() { this.emit('close'); }
  }
  const collector = createCollector({apiKey:'local-test',port:0,host:'127.0.0.1',WebSocketImpl:FakeSocket,now:()=>time,staleMs:100,streamStaleMs:50,cleanupMs:10,reconnectMs:5000});
  collector.start();
  try {
    await once(collector.server,'listening');
    assert.equal(collector.health().ok,false);
    collector.ingest({MessageType:'ShipStaticData',MetaData:{MMSI:1},Message:{ShipStaticData:{Type:80,Name:'Test'}}});
    collector.ingest({MessageType:'PositionReport',MetaData:{MMSI:1},Message:{PositionReport:{Latitude:20,Longitude:20}}});
    assert.equal(collector.health().ok,true);
    const url = `http://127.0.0.1:${collector.server.address().port}`;
    let response = await fetch(url+'/health');
    assert.equal(response.status,200);
    assert.equal((await response.json()).connected,true);
    const data = await (await fetch(url+'/tankers')).json();
    assert.equal(data.vessels.length,1);
    assert.equal(data.stream.ok,true);
    time += 60;
    response = await fetch(url+'/health');
    assert.equal(response.status,503);
    assert.equal((await response.json()).ok,false);
    time += 60;
    // No /tankers or /health request triggers this cleanup.
    await waitFor(()=>collector.health().staticRecords===0 && collector.health().vesselCount===0);
    socket.emit('close');
    assert.equal(collector.health().connected,false);
  } finally { collector.stop(); }
});
