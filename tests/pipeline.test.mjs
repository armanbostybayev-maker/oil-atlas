import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJSON, generate, importCountries, importRefineries, publish } from '../data/pipeline.mjs';
import { metricValue } from '../analytics/atlas.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const base = readJSON(path.join(root,'data/sources/base.json'));
const geometry = readJSON(path.join(root,'data/sources/countries.geojson'));
const enrichment = readJSON(path.join(root,'data/sources/enrichment.json'));

test('Canonical sources reproduce the current country/refinery data and quality rules', () => {
  const result = generate(base,geometry,enrichment);
  const current = readJSON(path.join(root,'public/data/atlas.json'));
  assert.deepEqual(result.countries,current.countries);
  assert.deepEqual(result.refineries,current.refineries);
  assert.equal(result.quality.matched+result.quality.unmatched.length,result.refineries.length);
  assert.deepEqual(result.quality.duplicateCandidates,current.quality.duplicateCandidates);
  assert.deepEqual(result.quality.possibleSharedCapacity,current.quality.possibleSharedCapacity);
});

test('Country enrichment persists through regeneration; zero, missing, date and unit semantics survive', () => {
  const id = base.countries[0].id;
  const patches = importCountries([{fid:id,'Цена бензина, USD':0,'ВВП, млрд USD':null,'Единица/тип цены':'USD/l','Дата цены':'2026-01-01'}],base,enrichment);
  const updatedBase = structuredClone(base);
  updatedBase.countries[0].values.gasolinePrice = 99;
  const result = generate(updatedBase,geometry,patches);
  const c = result.countries[0];
  assert.equal(c.values.gasolinePrice,0);
  assert.equal(c.values.gdp,generate(base,geometry,enrichment).countries[0].values.gdp);
  const state = {mode:'prices',metric:'gasolinePrice',priceUnit:'USD/l'};
  assert.equal(metricValue({...c,...c.values},state,[]),0);
  assert.equal(metricValue({...c,...c.values,gasolinePrice:null},state,[]),null);
  assert.equal(metricValue({...c,...c.values,priceDate:null},state,[]),null);
  assert.equal(metricValue({...c,...c.values},{...state,priceUnit:'USD/gal'},[]),null);
  assert.deepEqual(generate(updatedBase,geometry,JSON.parse(JSON.stringify(patches))),result);
});

test('Explicit refinery registry replacement is persistent and duplicate checks run after merge', () => {
  const c = base.countries[0];
  const row = {'Страна':c.name,'НПЗ / площадка':'Test plant','Компания':'Test owner','Статус источника':'open','Мощность, млн т/год':0,'Мощность, барр./сут.':0,x:20,y:20};
  const patches = importRefineries([row,{...row,'НПЗ / площадка':'Test plant 2'}],base,enrichment);
  const result = generate(base,geometry,patches);
  const rows = result.refineries.filter(r => r.country === c.id);
  assert.equal(rows.length,2);
  assert.equal(rows[0].capacity,0);
  assert.ok(rows.every(r => r.duplicateWarning));
  assert.equal(result.quality.missingCapacity,result.refineries.filter(r => r.capacity===null).length);
  assert.deepEqual(generate(base,geometry,patches),result);
  assert.throws(() => importRefineries([{...row,'Страна':'not a country'}],base,enrichment),/Unmatched/);
});

test('Pipeline CLI is deterministic, isolated output leaves sources untouched, failures leave runtime intact', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'oil-pipeline-'));
  const sourceBefore = fs.readFileSync(path.join(root,'data/sources/enrichment.json'));
  const runtimeBefore = fs.readFileSync(path.join(root,'public/data/atlas.json'));
  const run = args => spawnSync(process.execPath,['data/update.mjs',...args],{cwd:root,encoding:'utf8',env:{...process.env,OIL_ATLAS_SOURCE:''}});
  try {
    const first = run(['--out',path.join(dir,'first')]);
    assert.equal(first.status,0,first.stderr);
    const second = run(['--out',path.join(dir,'second')]);
    assert.equal(second.status,0,second.stderr);
    for (const file of ['atlas.json','countries.geojson','quality.json','manifest.json']) assert.deepEqual(fs.readFileSync(path.join(dir,'first',file)),fs.readFileSync(path.join(dir,'second',file)));
    const failure = run(['--source',path.join(dir,'missing')]);
    assert.equal(failure.status,1);
    assert.match(failure.stderr,/Missing GIS source.*npm run data:update/);
    assert.deepEqual(fs.readFileSync(path.join(root,'data/sources/enrichment.json')),sourceBefore);
    assert.deepEqual(fs.readFileSync(path.join(root,'public/data/atlas.json')),runtimeBefore);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('Validation failures and publication staging failures do not overwrite existing data', () => {
  const invalid = structuredClone(base);
  invalid.refineries[0].capacity = -1;
  assert.throws(() => generate(invalid,geometry,enrichment),/Invalid capacity/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'oil-publish-'));
  try {
    const file = path.join(dir,'atlas.json');
    fs.writeFileSync(file,'original');
    const blocker = path.join(dir,'blocker');
    fs.writeFileSync(blocker,'not a directory');
    assert.throws(() => publish([[file,'updated'],[path.join(blocker,'file'),'fail']]));
    assert.equal(fs.readFileSync(file,'utf8'),'original');
    assert.ok(!fs.readdirSync(dir).some(n => n.endsWith('.tmp')));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
