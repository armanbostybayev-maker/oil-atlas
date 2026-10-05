import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {publicationIssues} from '../scripts/infrastructure-publication-gate.mjs';
test('unknown-release approval is bound to exact published snapshots; changed data is blocked',()=>{
 const manifest=JSON.parse(readFileSync('public/data/infrastructure/import-manifest.json','utf8'));
 const datasets=manifest.datasets.map(d=>{const bytes=readFileSync('public/data/infrastructure/'+d.file);return {type:d.type,features:JSON.parse(bytes).features.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
 assert.deepEqual(publicationIssues(manifest,datasets),[]);
 assert.ok(publicationIssues(manifest,datasets.map(d=>({...d,sha256:'0'.repeat(64)}))).some(x=>x.includes('missing dataset release')));
 assert.ok(manifest.datasets.every(d=>d.source_release===null));
});
