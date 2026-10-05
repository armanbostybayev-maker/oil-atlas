import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

fs.mkdirSync('artifacts',{recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [], checks = [];
page.on('pageerror',e => errors.push(e.message));
let phase = 'live';
let requests = 0;
await page.route('**/api/tankers',async route => {
  requests++;
  if (phase === 'failure') return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'Test outage'})});
  const timestamp = new Date(Date.now()-(phase === 'stale' ? 120000 : 0)).toISOString();
  return route.fulfill({contentType:'application/json',body:JSON.stringify({vessels:[{mmsi:'123456789',name:'LOCAL TEST',vesselType:80,lat:20,lon:30,speed:8,course:90,heading:90,receivedAt:Date.parse(timestamp),timestamp,history:[]}],stream:{ok:phase==='live',connected:phase==='live',lastPositionAt:timestamp}})});
});
try {
  await page.goto(process.env.OIL_ATLAS_TEST_URL || 'http://127.0.0.1:5180/',{waitUntil:'networkidle'});
  await page.locator('.world-map[data-ready="true"]').waitFor({timeout:30000});
  await page.locator('.ais-status[data-status="live"]').waitFor();
  assert.ok(await page.evaluate(()=>Boolean(window.__oilAtlasMap.getSource('countries') && window.__oilAtlasMap.getLayer('refinery-circles'))));
  checks.push('Map and live AIS load with local mocked positions');
  await page.locator('.search input').fill('Kazakhstan');
  await page.locator('.search-results [role=option]').filter({hasText:'Kazakhstan'}).first().click();
  await page.locator('.details').waitFor();
  await page.locator('.burger').click();
  await page.locator('.mode-menu-row > button:first-child').filter({hasText:'Production'}).click();
  await page.locator('.analysis-workspace').waitFor();
  assert.match(page.url(),/mode=production/);
  checks.push('Country search/details and production mode preserve GIS interactions');
  phase = 'stale';
  await page.locator('.ais-status[data-status="stale"]').waitFor({timeout:20000});
  assert.match(await page.locator('.ais-status').innerText(),/Latest position:/);
  checks.push('Successful HTTP response with stale stream is shown as stale');
  const before = requests;
  phase = 'failure';
  await page.waitForFunction(() => document.querySelector('.ais-status')?.dataset.status==='stale');
  while (requests===before) await page.waitForTimeout(100);
  assert.equal(await page.evaluate(async ()=>(await window.__oilAtlasMap.getSource('tankers').getData()).features.length),1);
  checks.push('API outage retains the last known tanker with stale warning');
  await page.screenshot({path:'artifacts/reliability-desktop.png'});
  await page.getByLabel('Language / Язык').selectOption('ru');
  assert.match(await page.locator('.ais-status').innerText(),/позиции устарели/);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/reliability-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  checks.push('Russian AIS labels and narrow viewport without horizontal overflow');
  await page.reload({waitUntil:'networkidle'});
  await page.locator('.ais-status[data-status="offline"]').waitFor();
  checks.push('Initial API failure is shown as offline');
  assert.deepEqual(errors,[]);
  console.log(checks.map(s=>'PASS '+s).join('\n'));
} finally {
  fs.writeFileSync('artifacts/reliability-browser-report.json',JSON.stringify({checks,errors,mockedAIS:true},null,2));
  await browser.close();
}
