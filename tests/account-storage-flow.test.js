'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const policy=require('../js/core/account-storage-policy.js');
const root=path.resolve(__dirname,'..');

test('account database names are stable and safely scoped',()=>{
  assert.equal(policy.databaseNameForUid('user-123'),'forexBootcampDB__user-123');
  assert.equal(policy.databaseNameForUid('uid /with spaces'),'forexBootcampDB__uidwithspaces');
  assert.throws(()=>policy.databaseNameForUid('///'),/invalid_account_uid/);
  assert.ok(policy.databaseNameForUid('x'.repeat(120)).length <= 'forexBootcampDB__'.length+80);
});

test('first account may migrate legacy data only into an empty target',()=>{
  assert.deepEqual(policy.migrationSource({uid:'A',ownerUid:'',currentCount:0,legacyCount:4}),{allowed:true,source:'legacy',reason:'first_account_migration'});
  assert.equal(policy.migrationSource({uid:'A',ownerUid:'',currentCount:2,legacyCount:4}).reason,'target_not_empty');
});

test('compatibility source has priority but never overwrites existing canonical data',()=>{
  assert.equal(policy.migrationSource({uid:'A',ownerUid:'A',currentCount:0,doubleScopedCount:2,legacyCount:9}).source,'double_scoped');
  assert.equal(policy.migrationSource({uid:'A',ownerUid:'A',currentCount:1,doubleScopedCount:2,legacyCount:9}).allowed,false);
});

test('another account cannot claim the legacy database',()=>{
  const result=policy.migrationSource({uid:'B',ownerUid:'A',currentCount:0,doubleScopedCount:7,legacyCount:10});
  assert.equal(result.allowed,false);
  assert.equal(result.reason,'owned_by_another_account');
});

test('invalid migration counts fail closed',()=>{
  assert.equal(policy.migrationSource({uid:'A',currentCount:-1,legacyCount:2}).allowed,false);
  assert.equal(policy.migrationSource({uid:'A',currentCount:NaN,legacyCount:2}).reason,'invalid_counts');
  assert.equal(policy.migrationSource({uid:'',legacyCount:2}).reason,'missing_uid');
});

test('authenticated account flow uses the policy and preserves IndexedDB errors',()=>{
  const auth=fs.readFileSync(path.join(root,'auth-client.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.match(auth,/AREXAccountStoragePolicy/);
  assert.match(auth,/if \(migration\.allowed\) await writeDb/);
  assert.doesNotMatch(auth,/catch \{ return \{\}; \}/);
  assert.match(html,/src="js\/core\/account-storage-policy\.js"/);
  assert.match(sw,/\.\/js\/core\/account-storage-policy\.js/);
});
