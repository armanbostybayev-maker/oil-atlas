import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
let failure=false;
await page.route('**/api/tankers',route=>{
  if(failure) return route.fulfill({status:502,contentType:'application/json',body:'{"error":"local test failure"}'});
  const timestamp=new Date().toISOString();
  const vessels=[
    {mmsi:'1',vesselTypeName:'LNG Tanker',owner:'BP'},
    {mmsi:'2',vesselTypeName:'Crude Oil Tanker',owner:'BP'},
    {mmsi:'3',vesselTypeName:'LNG Tanker',owner:'Shell'},
    {mmsi:'4'},
    {mmsi:'5',vesselTypeName:'Oil Products Tanker',owner:'BP'},
    {mmsi:'6',vesselType:70,vesselTypeName:'Cargo',owner:'BP'},
  ].map((v,i)=>({vesselType:80,...v,name:`Fixture ${v.mmsi}`,lat:5,lon:60+i*4,speed:0,heading:null,course:0,timestamp,receivedAt:Date.now(),history:[{lat:5,lon:59.99+i*4,timestamp:new Date(Date.now()-60000).toISOString()},{lat:5,lon:60+i*4,timestamp}]}));
  return route.fulfill({contentType:'application/json',body:JSON.stringify({vessels,stream:{ok:true,connected:true,lastPositionAt:timestamp}})});
});
const visible=async count=>page.waitForFunction(expected=>{
  const m=window.__oilAtlasMap;
  return m?.getLayer('tankers') && new Set(m.queryRenderedFeatures({layers:['tankers']}).map(f=>f.properties.mmsi)).size===expected;
},count,{timeout:15000});
const checkbox=label=>page.getByRole('checkbox',{name:new RegExp(label)});
try{
  await page.goto(process.env.OIL_ATLAS_TEST_URL || 'http://127.0.0.1:5180/',{waitUntil:'networkidle'});
  await page.locator('.world-map[data-ready="true"]').waitFor({timeout:30000});
  await visible(5);
  await page.evaluate(()=>{window.__fleetMap=window.__oilAtlasMap;window.__fleetSource=window.__oilAtlasMap.getSource('tankers');});
  assert.equal(await checkbox('All tankers').isChecked(),true);
  assert.equal(await page.locator('.vessel-types details').getAttribute('open'),null);
  await page.getByText('Filter by detailed type',{exact:true}).click();
  assert.equal(await checkbox('LNG Tanker').locator('..').locator('.vessel-type-count').innerText(),'2');
  checks.push('Five relevant vessels, cargo excluded; global counts before type selection');
  await checkbox('LNG Tanker').uncheck();await visible(3);
  assert.equal(await checkbox('All tankers').evaluate(e=>e.indeterminate),true);
  assert.equal(await checkbox('LNG Tanker').locator('..').locator('.vessel-type-count').innerText(),'2');
  await checkbox('LNG Tanker').check();await visible(5);
  await checkbox('All tankers').uncheck();await visible(0);
  await checkbox('All tankers').check();await visible(5);
  checks.push('Individual toggles, indeterminate parent, select all and deselect all');
  await page.locator('.owners-trigger').click();
  await page.locator('.owner-search').fill('BP');
  await page.locator('.owner-results button').filter({has:page.locator('.owner-name').filter({hasText:/^BP$/})}).click();
  await visible(3);
  await checkbox('LNG Tanker').uncheck();await visible(2);
  assert.equal(await checkbox('LNG Tanker').locator('..').locator('.vessel-type-count').innerText(),'1');
  assert.equal(await page.evaluate(()=>window.__oilAtlasMap===window.__fleetMap && window.__oilAtlasMap.getSource('tankers')===window.__fleetSource),true);
  const points=await page.evaluate(async()=>(await window.__oilAtlasMap.getSource('tankers').getData()).features.length);
  assert.equal(points,5);
  const filters=await page.evaluate(()=>['tankers','tanker-history'].map(id=>window.__oilAtlasMap.getFilter(id)));
  assert.deepEqual(filters[0],filters[1]);
  checks.push('Company AND type filters; counts follow company; map/source unchanged and routes filtered');
  failure=true;
  await page.locator('.ais-status[data-status="stale"]').waitFor({timeout:20000});
  assert.equal(await checkbox('LNG Tanker').isChecked(),false);await visible(2);
  failure=false;
  await page.locator('.ais-status[data-status="live"]').waitFor({timeout:20000});
  assert.equal(await checkbox('LNG Tanker').isChecked(),false);await visible(2);
  checks.push('Type and owner selection survive AIS outage and recovery');
  await page.screenshot({path:'artifacts/vessel-types-desktop.png'});
  const card=await page.evaluate(async()=>{
    const {createTankerCard}=await import('/map/TankerCard.mjs');
    return createTankerCard({mmsi:'1',name:'TEST',vesselType:80,vesselTypeName:'LNG Tanker',owner:'BP',speed:0,course:0,heading:null,draught:null,timestamp:'2026-09-17 16:06:10.908306668 +0000 UTC'}).textContent;
  });
  assert.match(card,/LNG Tanker/);assert.match(card,/BP/);assert.match(card,/0.0 kn/);assert.match(card,/Last AIS Position/);
  assert.doesNotMatch(card,/undefined|null|NaN|Draught|Heading/);
  checks.push('Vessel card shows normalized/source type, owner, real timestamp and zero speed without missing placeholders');
  await page.getByLabel('Language / Язык').selectOption('ru');
  assert.match(await page.locator('.vessel-types').innerText(),/Танкеры/);
  assert.match(await page.locator('.vessel-types').innerText(),/Газовоз LNG/);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/vessel-types-mobile.png'});
  const box=await page.locator('.vessel-type-options').boundingBox();
  assert.ok(box.x>=0 && box.x+box.width<=391 && box.y+box.height<=845);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.vessel-types-trigger').getAttribute('aria-expanded'),'false');
  checks.push('RU labels, mobile dropdown within viewport, keyboard close');
  assert.deepEqual(errors,[]);
  console.log(checks.map(s=>'PASS '+s).join('\n'));
}finally{
  fs.writeFileSync('artifacts/vessel-types-browser-report.json',JSON.stringify({checks,errors,mockedAIS:true},null,2));
  await browser.close();
}
