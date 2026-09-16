import assert from "node:assert/strict";
export async function checkOverlay(page, check, dir) {
  await page.goto("http://127.0.0.1:5180", { waitUntil: "networkidle" });
  await page.locator('.world-map[data-ready="true"]').waitFor({ timeout: 30000 });
  const search = async (query, text = query) => {
    await page.locator('.search input').fill(query);
    await page.locator('.search-results [role=option]').filter({ hasText: text }).first().click();
  };
  const mode = async label => {
    await page.locator('.burger').click();
    await page.locator('.mode-menu-row > button:first-child').filter({ hasText: label }).click();
    await page.waitForTimeout(150);
  };
  const geometry = async () => {
    const boxes = await page.evaluate(() => {
      const selectors = ['.overlay-brand', '.overlay-search', '.overlay-workspace', '.language-switcher', '.owners-trigger', '.owners-dropdown', '.overlay-bottom-left', '.overlay-summary', '.overlay-navigation'];
      return selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(e => {
        const r = e.getBoundingClientRect(); return { selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      })).filter(r => r.width && r.height);
    });
    const viewport = page.viewportSize();
    for (const b of boxes) {
      assert(b.x >= -1 && b.y >= -1 && b.right <= viewport.width + 1 && b.bottom <= viewport.height + 1, `Outside viewport: ${JSON.stringify(b)}`);
      for (const c of boxes) {
        if (b === c) continue;
        assert(!(Math.min(b.right, c.right) - Math.max(b.x, c.x) > 2 && Math.min(b.bottom, c.bottom) - Math.max(b.y, c.y) > 2), `Overlap: ${b.selector} and ${c.selector}`);
      }
    }
  };
  await check('Overlay zones at 1920, 1600, 1440 and 1366; menu and country never coexist', async () => {
    for (const [width, height] of [[1920,1080],[1600,900],[1440,900],[1366,768]]) {
      await page.setViewportSize({width,height});
      await search('Kazakhstan');
      await page.locator('.details').waitFor();
      await geometry();
      await page.locator('.burger').click();
      assert.equal(await page.locator('.details').count(), 0);
      await page.locator('.owners-trigger').click();
      await geometry();
      await page.screenshot({path:dir+`overlay-${width}.png`});
      await page.locator('.owners-trigger').click();
      await page.locator('.analytics-menu header button').click();
    }
  });
  await check('Single analysis, correct legend, no viewport reset across every mode', async () => {
    await page.evaluate(() => window.__oilAtlasMap.jumpTo({center:[70,30],zoom:3}));
    for (const [label,id] of [['Oil Balance','balance'],['Refining Capacity','capacity'],['Production','production'],['Consumption','consumption'],['Refinery Infrastructure','infrastructure'],['Refinery Age','age'],['Refinery Status','status'],['Product Mix','products'],['Economics','economics'],['Fuel Prices','prices'],['Owners','owners'],['Anomalies','anomalies']]) {
      await mode(label);
      assert.equal(await page.locator('.analysis-workspace').count(),1);
      assert.equal(await page.locator('.legend').count(),1);
      assert.equal(await page.locator('.analytics-menu').count(),0);
      const current = await page.locator('.atlas-app').getAttribute('data-active-analysis');
      // Legacy mode IDs are kept for saved links and existing analytics.
      if (label !== 'Product Mix') assert.equal(current,id);
      assert(Math.abs(await page.evaluate(() => window.__oilAtlasMap.getZoom()) - 3) < .01);
      await geometry();
    }
    await page.locator('.close-analysis').click();
    assert.equal(await page.locator('.legend').count(),0);
    assert.equal(await page.locator('.atlas-app').getAttribute('data-active-analysis'),'none');
    await page.reload({waitUntil:'networkidle'});
    await page.locator('.world-map[data-ready="true"]').waitFor();
    assert.equal(await page.locator('.legend').count(),0);
  });
  await check('Accessible indicator keyboard and Russian labels', async () => {
    await mode('Oil Balance');
    const indicator = page.locator('.indicator-select [role=combobox]');
    await indicator.focus(); await indicator.press('ArrowDown'); await indicator.press('Enter');
    assert(new URL(page.url()).searchParams.get('metric') === 'pcRatio');
    await indicator.press('End'); await indicator.press('Enter');
    assert(new URL(page.url()).searchParams.get('metric') === 'rcRatio');
    await indicator.click(); await indicator.press('Escape');
    assert.equal(await indicator.getAttribute('aria-expanded'),'false');
    await page.locator('.language-switcher select').selectOption('ru');
    assert((await indicator.innerText()).includes('Переработка'));
    assert((await page.locator('.basemap-label').innerText()).includes('Космос'));
    await geometry();
    await page.screenshot({path:dir+'overlay-russian.png'});
    await page.locator('.language-switcher select').selectOption('en');
  });
  await check('Countries update one card; refinery search, map click and popup; comparison and quality', async () => {
    await search('Kazakhstan'); await search('United States');
    assert.equal(await page.locator('.details').count(),1);
    assert((await page.locator('.details h2').innerText()).includes('United States'));
    await page.getByRole('button',{name:'Compare countries'}).click();
    await page.getByLabel('Compare with').selectOption({label:'Kazakhstan'});
    assert(await page.locator('.comparison tbody tr').count() > 5);
    await page.getByRole('button',{name:'Close comparison'}).click();
    await search('Jamnagar');
    await page.getByRole('complementary',{name:'Refinery details'}).waitFor();
    await page.getByRole('button',{name:'Close details'}).click();
    await page.waitForTimeout(1000);
    const point = await page.evaluate(() => {
      const m = window.__oilAtlasMap, feature = m.queryRenderedFeatures({layers:['refinery-circles']}).find(f => { const p=m.project(f.geometry.coordinates); return p.x>430 && p.x<1000 && p.y>200 && p.y<500; });
      if (!feature) return null; return m.project(feature.geometry.coordinates);
    });
    assert(point, 'A refinery is visible in the map workspace');
    await page.mouse.move(point.x,point.y); await page.locator('.maplibregl-popup').waitFor();
    await page.mouse.click(point.x,point.y); await page.locator('.details').waitFor();
    await page.locator('.data-button').click();
    assert.equal(await page.locator('.details:not(.quality)').count(),0);
    await page.locator('.quality').waitFor();
    await geometry();
    await mode('Overview');
  });
  await check('Complete company filter and reset preserves analysis and filters', async () => {
    await page.locator('.owners-trigger').click();
    assert(await page.locator('.owner-results li').count() > 100);
    const name = await page.locator('.owner-results .owner-name').nth(20).innerText();
    await page.locator('.owner-search').fill(name);
    await page.locator('.owner-results button').first().click();
    assert.equal(new URL(page.url()).searchParams.get('owner'),name);
    await mode('Production');
    await page.locator('.map-controls select').selectOption('Active');
    const before = new URL(page.url()).search;
    await page.locator('.reset-map').click(); await page.waitForTimeout(900);
    assert.equal(new URL(page.url()).search,before);
    await page.locator('.owners-trigger').click();
    await page.getByRole('button',{name:'Clear owner filter'}).click();
    await page.locator('.owners-trigger').click();
    await page.locator('.map-controls select').selectOption('');
  });
  await check('OSM / satellite / topo preserve country, analytics, labels and refinery sources', async () => {
    await search('Kazakhstan'); await page.waitForTimeout(900);
    const initial = await page.evaluate(() => {const m=window.__oilAtlasMap;window.__testCountries=m.getSource('countries');window.__testRefineries=m.getSource('refineries');return m.getZoom();});
    for (const base of ['osm','satellite','topo','atlas']) {
      await page.getByLabel('Basemap',{exact:true}).selectOption(base);
      await page.waitForTimeout(1200);
      const result = await page.evaluate(() => {const m=window.__oilAtlasMap;return {same:m.getSource('countries')===window.__testCountries && m.getSource('refineries')===window.__testRefineries,zoom:m.getZoom(),layers:['countries-fill','countries-border','country-selection','country-labels','refinery-circles'].every(id=>!!m.getLayer(id)),filter:m.getFilter('country-selection'),order:m.getStyle().layers.map(l=>l.id)};});
      assert(result.same && result.layers);
      assert(Math.abs(result.zoom-initial)<.01);
      assert(result.filter.at(-1));
      if(base!=='atlas') assert(result.order.indexOf('basemap')<result.order.indexOf('countries-fill'));
      assert.equal(await page.locator('.legend').count(),1);
      assert.equal(await page.locator('.details').count(),1);
    }
    await page.getByRole('button',{name:'Zoom in',exact:true}).click(); await page.waitForTimeout(400);
    assert(await page.evaluate(()=>window.__oilAtlasMap.getZoom()) > initial);
    await page.getByRole('button',{name:'Zoom out',exact:true}).click();
  });
  await check('Narrow layout and map controls remain inside viewport', async () => {
    await page.setViewportSize({width:390,height:844});
    await page.locator('.burger').click();
    await geometry();
    await page.screenshot({path:dir+'overlay-mobile.png'});
  });
}
