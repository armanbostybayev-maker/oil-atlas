import assert from 'node:assert/strict';
export async function checkOwnersLayout(page,check,dir){
 await page.goto('http://127.0.0.1:5180/',{waitUntil:'networkidle'});
 await page.locator('.world-map[data-ready="true"]').waitFor();
 await page.getByLabel('Language / Язык').selectOption('ru');
 const data=await page.evaluate(async()=>await(await fetch('/data/atlas.json')).json());
 const count=new Set(data.refineries.map(r=>r.owner).filter(Boolean)).size;
 await check('All companies, search and selection beyond top ten',async()=>{
  assert.equal(await page.locator('.owners-dropdown').count(),0);
  await page.locator('.owners-trigger').click();assert.equal(await page.locator('.owner-results li').count(),count);
  const name=await page.locator('.owner-results .owner-name').nth(20).innerText();
  await page.getByLabel('Поиск компании').fill(name);assert.equal(await page.locator('.owner-results li').count(),1);
  await page.locator('.owner-results li button').click();assert.equal(new URL(page.url()).searchParams.get('owner'),name);
  assert.equal(await page.locator('.owners-dropdown').count(),0);
  await page.locator('.owners-trigger').click();await page.getByRole('button',{name:'Сбросить владельца'}).click();
  assert.equal(new URL(page.url()).searchParams.has('owner'),false);
  await page.getByLabel('Поиск компании').fill('');await page.screenshot({path:dir+'all-companies.png'});
  await page.keyboard.press('Escape');assert.equal(await page.locator('.owners-dropdown').count(),0);
 });
 await check('Legend never covered by burger on desktop, laptop or narrow screen',async()=>{
  for(const [width,height] of [[1440,1000],[1024,768],[390,844]]){
   await page.setViewportSize({width,height});await page.getByRole('button',{name:'Открыть меню анализа',exact:true}).click();
   const menu=await page.locator('.analytics-menu').boundingBox(),legend=await page.locator('.legend').boundingBox();
   assert.ok(menu.y+menu.height<=legend.y-5,`Overlap at ${width}x${height}`);assert.ok(legend.x<=12.1);
   await page.screenshot({path:dir+`menu-legend-${width}.png`});
   await page.getByRole('button',{name:'Закрыть меню анализа',exact:true}).click();
   await page.locator('.owners-trigger').click();const dropdown=await page.locator('.owners-dropdown').boundingBox();assert.ok(dropdown.x>=0&&dropdown.x+dropdown.width<=width+1);await page.keyboard.press('Escape');
  }
 });
}
