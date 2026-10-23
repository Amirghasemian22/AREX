const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/core/ohlc-backtest.js');
function bars(closes){return closes.map((c,i)=>({time:`${String(i).padStart(6,'0')}`,open:c,high:c*1.01,low:c*.99,close:c}));}
test('OHLC validation rejects missing/invalid bars and non-ascending timestamps',()=>{
 assert.throws(()=>B.normalizeBars([{time:'1',open:1,high:1,low:1,close:1}]),/حداقل ۳/);
 assert.throws(()=>B.normalizeBars([{time:'1',open:2,high:1,low:1,close:2},{time:'2',open:2,high:2,low:1,close:2},{time:'3',open:2,high:2,low:1,close:2}]),/کندل 1 نامعتبر/);
 assert.throws(()=>B.normalizeBars([{time:'2',open:2,high:3,low:1,close:2},{time:'1',open:2,high:3,low:1,close:2},{time:'3',open:2,high:3,low:1,close:2}]),/ترتیب زمانی/);
});
test('OHLC backtest runs deterministically and returns finite metrics for oscillating prices',()=>{
 const c=[10,9,8,9,10,11,12,11,10,9,8,9,10,11,12,13,12,11,10,9,8,7,8,9,10,11,12,13,14,13,12,11,10,9,8,9,10,11,12,13,14,15,14,13,12,11];
 const r=B.run(bars(c),{fastPeriod:3,slowPeriod:6,stopPct:2,targetPct:3,feeBps:1,slippageBps:1});
 assert.equal(r.ok,true);assert.equal(r.bars,c.length);assert.ok(r.metrics.count>0);assert.ok(Number.isFinite(r.metrics.netR));assert.ok(r.trades.every(t=>Number.isFinite(t.netR)));assert.equal(r.parameters.fastPeriod,3);
});
test('OHLC backtest validates parameters and never accepts unsupported side',()=>{
 assert.throws(()=>B.run(bars([1,2,3,4,5,6,7,8,9,10]),{fastPeriod:5,slowPeriod:3}),/دوره میانگین/);
 assert.throws(()=>B.run(bars([1,2,3,4,5,6,7,8,9,10]),{fastPeriod:2,slowPeriod:4,side:'random'}),/جهت معامله/);
});
test('walk-forward creates multiple chronologically ordered test folds',()=>{
 const c=[];for(let i=0;i<260;i++)c.push(100+Math.sin(i/5)*8+i*.02);
 const r=B.walkForward(bars(c),{fastPeriod:5,slowPeriod:20,stopPct:1,targetPct:2,folds:3,minTrainBars:100});
 assert.equal(r.ok,true);assert.equal(r.folds.length,3);assert.ok(r.folds.every(f=>f.testBars>0));assert.ok(r.folds[0].testStart<r.folds[1].testStart);assert.match(r.method,/fixed parameters/);
});
test('walk-forward rejects too-short history',()=>assert.throws(()=>B.walkForward(bars([1,2,3,4,5,6,7,8,9,10,11,12]),{fastPeriod:2,slowPeriod:3,folds:3,minTrainBars:10}),/حداقل/));
