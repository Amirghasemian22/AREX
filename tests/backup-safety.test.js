'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const B=require('../js/core/backup-safety.js');

test('backup validator accepts full and legacy object backups without mutating input',()=>{
 const full={app:'AREX',schemaVersion:5,data:{trades:'[]',notes:'keep'}};const before=JSON.stringify(full);
 assert.equal(B.validateEnvelope(full,Buffer.byteLength(before)).ok,true);
 assert.equal(JSON.stringify(full),before);
 assert.equal(B.validateEnvelope({trades:'[]',psych:'[]'},20).kind,'legacy');
});
test('backup validator rejects malformed root, array payload, dangerous keys, invalid schema and oversize',()=>{
 assert.equal(B.validateEnvelope([],2).ok,false);
 assert.equal(B.validateEnvelope({data:[]},2).ok,false);
 assert.equal(B.validateEnvelope({data:JSON.parse('{"__proto__":{"polluted":true}}')},40).ok,false);
 assert.equal(B.validateEnvelope({schemaVersion:-1,data:{}},10).ok,false);
 assert.ok(B.validateEnvelope({data:{}},B.MAX_BYTES+1).errors.includes('backup_too_large'));
});
test('pre-restore snapshot round-trips exactly and rejects invalid envelopes',()=>{
 const original={trades:'[{"id":1}]',notes:'non-empty',legacy:{x:1}};const snap=B.makeRestoreSnapshot(original,'2026-10-23T00:00:00.000Z');
 assert.deepEqual(B.rollbackSnapshot(snap),original);
 assert.throws(()=>B.rollbackSnapshot({kind:'other',data:{}}));
});
test('restore guard enforces key and size limits',()=>{
 const many={};for(let i=0;i<=B.MAX_KEYS;i++)many['k'+i]=1;
 assert.ok(B.validateEnvelope({data:many},100).errors.includes('too_many_keys'));
 const tooLong={data:{['x'.repeat(241)]:1}};assert.ok(B.validateEnvelope(tooLong,300).errors.includes('invalid_key'));
});
