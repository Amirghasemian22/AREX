const test=require('node:test'),assert=require('node:assert/strict');
const K=require('../js/core/strategykb.js'), R=require('../js/core/ruleaudit.js');
test('audit attributes only to the historical version valid at trade date/time',()=>{
 const kb={versions:[{id:'v1',n:1,date:'2026-01-01',time:'09:00',snapshot:[{strategy:'SMC'}]},{id:'v2',n:2,date:'2026-01-03',time:'12:00',snapshot:[{strategy:'SMC'},{strategy:'SMC'}]}]};
 const out=R.audit(kb,[{id:'a',date:'2026-01-02',time:'10:00',setup:'SMC',ruleCompliance:80,r:'-1'},{id:'b',date:'2026-01-03',time:'13:00',setup:'SMC',ruleCompliance:100,r:'2'},{id:'c',date:'2025-12-01',setup:'SMC'}]);
 assert.equal(out.attributed,2);assert.equal(out.unknown.length,1);assert.equal(out.rows[0].versionN,1);assert.equal(out.rows[1].versionN,2);assert.equal(out.groups[0].belowThreshold,1);assert.equal(out.groups[1].netR,2);
});
test('audit reports same-day no-time ambiguity and never invents compliance',()=>{
 const out=R.audit({versions:[{id:'v1',n:1,date:'2026-02-01',time:'11:00',snapshot:[]}]},[{id:1,date:'2026-02-01',setup:'gold'},{id:2,date:'2026-02-02'}]);
 assert.equal(out.rows[0].ambiguous,true);assert.equal(out.rows[0].ruleCompliance,null);assert.equal(out.attributed,2);assert.equal(out.unknown.length,0);
});
test('audit with no official version marks all trades unattributed',()=>{const out=R.audit({versions:[]},[{id:1,date:'2026-01-01'}]);assert.equal(out.attributed,0);assert.equal(out.unknown.length,1);});
