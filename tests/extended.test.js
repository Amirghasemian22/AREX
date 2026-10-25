const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
require('../js/core/extended.js');
const E = global.AREXExtended;

test('walk-forward is chronological, subtracts costs and rejects insufficient/invalid data',()=>{
 const r=E.walkForward([1,-1,2,-.5,1,1,-1,2,.5],{trainPct:75,costR:.1});
 assert.equal(r.ok,true); assert.equal(r.trainCount,6); assert.equal(r.testCount,3);
 assert.ok(Math.abs(r.train.netR-(1-.1-1-.1+2-.1-.5-.1+1-.1+1-.1))<1e-9);
 assert.equal(E.walkForward([1,2,3]).ok,false);
 assert.equal(E.walkForward([1,2,3,4,5,6,7,NaN]).ok,false);
});
test('natural journal query returns only real matching trades and transparent filters',()=>{
 const ts=[
  {id:1,symbol:'XAUUSD',date:'2026-10-01',r:1,setup:'SMC',note:'gold'},
  {id:2,symbol:'EURUSD',date:'2026-10-02',r:-1,setup:'breakout'},
  {id:3,symbol:'XAUUSD',date:'2026-10-03',r:-1,setup:'SMC'}
 ];
 const q=E.parseNaturalQuery('معاملات طلا سودده',ts);
 assert.deepEqual(q.trades.map(t=>t.id),[1]); assert.equal(q.filters.length,2);
});
test('psychology alerts require recorded evidence',()=>{
 const no=E.psychologySignals([{id:1,date:'2026-10-01',r:-1}],{});
 assert.equal(no.signals.length,0);
 const yes=E.psychologySignals([
  {id:1,date:'2026-10-01',r:-1},{id:2,date:'2026-10-02',r:-1},{id:3,date:'2026-10-03',r:-1}
 ],{});
 assert.ok(yes.signals.some(s=>s.code==='loss_streak'));
});
test('portfolio risk exposes missing data and does not invent correlations',()=>{
 const r=E.portfolioRisk([{symbol:'XAUUSD',riskPct:1},{symbol:'EURUSD',riskPct:0.5},{symbol:'GBPUSD'}]);
 assert.equal(r.totalRiskPct,1.5);assert.equal(r.missingCount,1);assert.equal(r.correlationStatus,'unknown');assert.equal(r.pairs[0].correlation,null);
});
test('weekly report uses recorded date range and records only',()=>{
 const r=E.weeklyReport([{date:'2026-10-01',r:1,mistakes:['FOMO']},{date:'2026-10-10',r:-1}],{'2026-10-01':{date:'2026-10-01',journalDone:true}},'2026-10-01','2026-10-07');
 assert.equal(r.tradeCount,1);assert.equal(r.performance.netR,1);assert.equal(r.completedJournal,1);assert.equal(r.topMistakes[0][0],'FOMO');
});

test('ranked journal search uses multilingual aliases and ranks relevant real records',()=>{
 const ts=[
  {id:'a',symbol:'XAUUSD',date:'2026-10-01',setup:'SMC',note:'ترس بعد از ضرر و ورود زودهنگام',tags:['FOMO'],r:-1},
  {id:'b',symbol:'EURUSD',date:'2026-10-02',setup:'breakout',note:'برنامه رعایت شد',r:1},
  {id:'c',symbol:'XAUUSD',date:'2026-10-03',setup:'SMC',note:'gold trend continuation',r:2}
 ];
 const r=E.semanticSearch('طلا ترس',ts);
 assert.equal(r.mode,'local-ranked-search'); assert.ok(r.trades.length>=1); assert.ok(r.trades.some(t=>t.id==='a')); assert.ok(r.ranking.find(x=>x.id==='a').score>0);
 assert.equal(r.scored,true); assert.ok(r.explanation.includes('embedding'));
});
test('ranked journal search preserves explicit natural filters and does not invent records',()=>{
 const ts=[{id:1,symbol:'XAUUSD',date:'2026-10-01',r:1,note:'طلا سودده'},{id:2,symbol:'EURUSD',date:'2026-10-02',r:-1,note:'زیان'}];
 const r=E.semanticSearch('معاملات طلا سودده',ts);
 assert.deepEqual(r.trades.map(t=>t.id),[1]); assert.equal(r.totalMatches,1); assert.ok(r.ranking[0].score>=0);
 const miss=E.semanticSearch('qzxv_nonexistent',ts); assert.equal(miss.trades.length,0);
});
