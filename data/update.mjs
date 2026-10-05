import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readJSON, readGIS, importCountries, importRefineries, generate, publish } from './pipeline.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const args = process.argv.slice(2);
const options = {};
let lock;
const lockPath = path.join(root,'data/.update.lock');
try {
  for (let i=0;i<args.length;i++) {
    const arg = args[i];
    if (['--dry-run','--refineries','--refineries-only'].includes(arg)) options[arg] = true;
    else if (['--source','--excel','--out','--python'].includes(arg) && args[i+1] && !args[i+1].startsWith('--')) options[arg] = args[++i];
    else throw new Error(`Unknown or incomplete option: ${arg}. See data/README.md.`);
  }
  if ((options['--refineries'] || options['--refineries-only']) && !options['--excel']) throw new Error('--refineries requires --excel <workbook.xlsx>');
  try { lock = fs.openSync(lockPath,'wx'); } catch { throw new Error('Dataset update is already running (data/.update.lock). If a previous process crashed, remove the lock only after confirming it has stopped.'); }
  const sourceDir = path.join(root,'data/sources');
  let base = readJSON(path.join(sourceDir,'base.json'));
  let geometry = readJSON(path.join(sourceDir,'countries.geojson'));
  let enrichment = readJSON(path.join(sourceDir,'enrichment.json'));
  const source = options['--source'] || process.env.OIL_ATLAS_SOURCE;
  if (source) ({base,geometry} = readGIS(path.resolve(source)));
  if (options['--excel']) {
    const workbook = path.resolve(options['--excel']);
    if (!fs.existsSync(workbook)) throw new Error(`Excel workbook not found: ${workbook}`);
    const sheets = options['--refineries-only'] ? ['НПЗ свежие реестры'] : ['country_world_globalpetrolprice',...(options['--refineries'] ? ['НПЗ свежие реестры'] : [])];
    let extracted;
    try {
      extracted = JSON.parse(execFileSync(options['--python'] || process.env.PYTHON || (process.platform === 'win32' ? 'py' : 'python3'),['-X','utf8',path.join(root,'scripts/read_excel.py'),workbook,...sheets],{encoding:'utf8',maxBuffer:50*1024*1024,stdio:['ignore','pipe','pipe']}));
    } catch (error) { throw new Error(`Excel import failed. Configure --python <executable> with openpyxl installed. ${error.stderr?.toString() || error.message}`); }
    if (extracted.country_world_globalpetrolprice) enrichment = importCountries(extracted.country_world_globalpetrolprice,base,enrichment);
    if (extracted['НПЗ свежие реестры']) enrichment = importRefineries(extracted['НПЗ свежие реестры'],base,enrichment);
  }
  const atlas = generate(base,geometry,enrichment);
  const fingerprint = createHash('sha256').update(JSON.stringify({base,geometry,enrichment})).digest('hex');
  const manifest = {version:2,fingerprint,sources:['data/sources/base.json','data/sources/countries.geojson','data/sources/enrichment.json'],crs:'EPSG:4326',joinToleranceKm:5,ambiguityMarginKm:1};
  if (!options['--dry-run']) {
    const out = path.resolve(options['--out'] || path.join(root,'public/data'));
    if (out === sourceDir || out.startsWith(sourceDir+path.sep)) throw new Error('--out must not point into canonical sources');
    const files = [];
    // --out is an isolated preview: never modify checked-in sources.
    if (!options['--out']) {
      if (source) files.push([path.join(sourceDir,'base.json'),JSON.stringify(base)],[path.join(sourceDir,'countries.geojson'),JSON.stringify(geometry)]);
      if (options['--excel']) files.push([path.join(sourceDir,'enrichment.json'),JSON.stringify(enrichment,null,2)]);
    }
    files.push([path.join(out,'atlas.json'),JSON.stringify(atlas)],[path.join(out,'countries.geojson'),JSON.stringify(geometry)],[path.join(out,'quality.json'),JSON.stringify(atlas.quality,null,2)],[path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)]);
    publish(files);
  }
  console.log(`${options['--dry-run'] ? 'Validated' : 'Generated'}: ${atlas.countries.length} countries, ${atlas.refineries.length} refineries, ${atlas.quality.priceRecords} price records. SHA-256 ${fingerprint}`);
} catch (error) {
  console.error(`Oil Atlas data update: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(lockPath); }
}
