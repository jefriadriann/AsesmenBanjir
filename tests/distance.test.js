import test from 'node:test';
import assert from 'node:assert/strict';
import {measureLocations,locationCoords,isVerified} from '../src/distance.js';
const point=coords=>({coords,status:'approximate',verifiedOfficeCoords:null});
test('WGS84 equatorial degree matches reference distance in meters',()=>{
 const result=measureLocations(point([0,0]),point([0,1]));
 assert.ok(Math.abs(result.meters-111319.49079327357)<0.001);
 assert.equal(result.verified,false);assert.equal(result.line.length,65);
});
test('near-antipodal reference remains stable',()=>{
 const result=measureLocations(point([-41.32,174.81]),point([40.96,-5.5]));
 assert.ok(Math.abs(result.meters-19959679.26735382)<0.001);
});
test('same location is zero and reversing endpoints is symmetric',()=>{
 const a=point([3.59,98.67]),b=point([3.74,96.85]);
 assert.equal(measureLocations(a,a).meters,0);
 assert.ok(Math.abs(measureLocations(a,b).meters-measureLocations(b,a).meters)<0.000001);
});
test('uses verified office coordinates when present; both endpoints must be verified',()=>{
 const a={coords:[1,1],verifiedOfficeCoords:[0,0],status:'verified'};
 const b={coords:[2,2],verifiedOfficeCoords:[0,1],status:'verified'};
 assert.deepEqual(locationCoords(a),[0,0]);assert.equal(isVerified(a),true);
 assert.ok(Math.abs(measureLocations(a,b).meters-111319.49079327357)<0.001);
 assert.equal(measureLocations(a,b).verified,true);
 assert.equal(measureLocations(a,point([0,1])).verified,false);
});
test('invalid coordinates do not produce a plausible distance',()=>{
 assert.throws(()=>measureLocations(point([91,100]),point([0,0])),/tidak valid/);
 assert.throws(()=>measureLocations(point([NaN,100]),point([0,0])),/tidak valid/);
});
