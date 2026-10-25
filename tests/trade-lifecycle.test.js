'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('../js/core/trade-lifecycle.js');
const A=require('../js/core/analytics.js');

test('deleting a trade removes only the requested row and does not mutate original array',()=>{
 const rows=[{id:1,date:'2026-10-20',r:1},{id:2,date:'2026-10-21',r:-1}];
 const result=L.removeTrade(rows,1);
 assert.deepEqual(result.trades,[rows[1]]);assert.equal(result.removed,rows[0]);assert.deepEqual(rows,[{id:1,date:'2026-10-20',r:1},{id:2,date:'2026-10-21',r:-1}]);
});
test('unknown trade id is a safe no-op',()=>{const rows=[{id:'a'}];const result=L.removeTrade(rows,'missing');assert.equal(result.index,-1);assert.equal(result.removed,null);assert.deepEqual(result.trades,rows);});
test('associated entry image, exit image and voice keys are enumerated for cleanup',()=>{assert.deepEqual(L.assetKeys(42),['tradeshot:42:entry','tradeshot:42:exit','voice:42']);});
test('daily log stays intact while another trade remains on the date',()=>{const log={date:'2026-10-23',status:'yes',journalDone:true,lesson:'keep'};assert.deepEqual(L.reconcileDailyLog(log,true),log);});
test('daily log no longer claims a trade exists after the last trade is deleted',()=>{const log={date:'2026-10-23',status:'yes',journalDone:true,lesson:'keep'};assert.deepEqual(L.reconcileDailyLog(log,false),{date:'2026-10-23',status:'',journalDone:false,lesson:'keep'});});
test('duplicate trade identifiers are detectable without changing trade data',()=>{const rows=[{id:1},{id:'1'},{id:2}];const before=JSON.stringify(rows);assert.deepEqual(L.assertUniqueTradeIds(rows),{ok:false,duplicates:['1']});assert.equal(JSON.stringify(rows),before);assert.deepEqual(L.assertUniqueTradeIds([{id:1},{id:2}]),{ok:true,duplicates:[]});});
test('analytics reflect create, edit and delete projections consistently',()=>{
 const initial=[{id:1,date:'2026-10-20',symbol:'XAUUSD',r:1,usd:100},{id:2,date:'2026-10-21',symbol:'XAUUSD',r:-0.5,usd:-50}];
 assert.equal(A.summarize(initial).totalR,0.5);
 const edited=initial.map(t=>t.id===2?{...t,r:-1,usd:-100}:t);
 assert.equal(A.summarize(edited).totalR,0);
 const deleted=L.removeTrade(edited,1).trades;
 const summary=A.summarize(deleted);assert.equal(summary.total,1);assert.equal(summary.totalR,-1);assert.equal(A.bySymbol(deleted)[0].tradeIds[0],2);
});
