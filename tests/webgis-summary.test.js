import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validSummary} from '../lib/webgis-summary.js';
const recorded = JSON.parse(readFileSync(new URL('../src/webgis-reference.json',import.meta.url)));
test('national WebGIS snapshot counts each alert office once and potential independently',()=>{
 assert.equal(validSummary(recorded),true);
 const incomplete=structuredClone(recorded);
 incomplete.offices.pop();
 assert.equal(validSummary(incomplete),false);
 const duplicate=structuredClone(recorded);
 duplicate.offices[0].name=duplicate.offices[1].name;
 assert.equal(validSummary(duplicate),false);
 const loading=structuredClone(recorded);
 loading.counts.Normal=null;
 assert.equal(validSummary(loading),false);
});
