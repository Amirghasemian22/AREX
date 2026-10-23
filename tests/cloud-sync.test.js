'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const C=require('../js/core/cloud-sync.js');
test('stable snapshot accepts identical consecutive reads independent of object key order',async()=>{let n=0;const r=await C.readStableSnapshot({readAll:async()=>++n===1?{b:2,a:1}:{a:1,b:2}});assert.deepEqual(r.data,{a:1,b:2});assert.equal(r.attempts,1);});
test('stable snapshot retries when local data changes between reads',async()=>{let n=0;const r=await C.readStableSnapshot({readAll:async()=>({value:++n===1?'old':'new'}),wait:async()=>{}});assert.equal(r.data.value,'new');assert.equal(r.attempts,2);});
test('stable snapshot refuses to back up while local writes are pending',async()=>{await assert.rejects(()=>C.readStableSnapshot({flush:async()=>false,readAll:async()=>({})}),/local_save_pending/);});
test('stable snapshot stops after repeated concurrent changes',async()=>{let n=0;await assert.rejects(()=>C.readStableSnapshot({readAll:async()=>({n:++n}),maxAttempts:2,wait:async()=>{}}),/local_data_changing_during_backup/);});
test('cloud manifest verifies snapshot identity and exact item count',()=>{assert.equal(C.validateCloudManifest({currentSnapshotId:'snap-1',itemCount:2},2).ok,true);assert.deepEqual(C.validateCloudManifest({currentSnapshotId:'snap-1',itemCount:3},2).errors,['item_count_mismatch']);});
test('manifest creation counts keys without mutating data',()=>{const d={a:1,b:2};const before=JSON.stringify(d);assert.equal(C.createManifest(d,'2026-10-23T00:00:00Z').itemCount,2);assert.equal(JSON.stringify(d),before);});
