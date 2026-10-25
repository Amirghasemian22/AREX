'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const audit=require('../js/core/trade-audit.js');const analytics=require('../js/core/analytics.js');const errors=require('../js/core/errors.js');
const trades=()=>[
 {id:'a',date:'2026-10-20',symbol:'XAUUSD',r:'-1',usd:'-100',mistakes:['off-plan']},
 {id:'b',date:'2026-10-21',symbol:'US30',r:'2',usd:'200',mistakes:[]},
 {id:'c',date:'2026-10-22',symbol:'EURUSD',usd:'0',mistakes:[]}
];
test('trade audit accepts valid journal and handles numeric strings without inventing values',()=>{const r=audit.auditTrades(trades());assert.equal(r.ok,true);assert.equal(r.total,3);assert.equal(r.warnings.length,0);});
test('trade audit detects duplicate/missing IDs and malformed dates',()=>{const t=trades();t.push({...t[0]});t[1]={date:'2026-02-30',symbol:'X'};const r=audit.auditTrades(t);assert.equal(r.ok,false);assert.ok(r.errors.some(x=>x.code==='duplicate_id'));assert.ok(r.errors.some(x=>x.code==='missing_id'));assert.ok(r.errors.some(x=>x.code==='invalid_date'));});
test('trade audit warns on invalid numbers and conflicting R/USD outcome but never rewrites source',()=>{const t=trades();t[0].r='bad';t[1].r='-2';const before=JSON.stringify(t);const r=audit.auditTrades(t);assert.ok(r.warnings.some(x=>x.code==='invalid_numeric'));assert.ok(r.warnings.some(x=>x.code==='r_usd_sign_mismatch'));assert.equal(JSON.stringify(t),before);});
test('analytics audit verifies outcome partition and curve metrics on mixed R/USD rows',()=>{const r=audit.auditAnalytics(trades(),analytics);assert.equal(r.ok,true);assert.equal(r.summary.total,3);assert.equal(r.summary.counted,3);});
test('evidence audit detects deleted trade references in findings',()=>{const f=errors.detect(trades(),{}).findings;const result=audit.auditEvidence(f,trades().slice(1));assert.equal(result.ok,false);assert.ok(result.errors.some(x=>x.code==='orphan_finding_trade_id'));});
test('analytics audit reports unavailable analytics rather than pretending success',()=>{assert.equal(audit.auditAnalytics([],null).ok,false);});
