'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const audit=require('../js/core/trade-audit.js');
const analytics=require('../js/core/analytics.js');
const errors=require('../js/core/errors.js');
const sample=()=>[
 {id:'ok-1',date:'2026-10-20',symbol:'XAUUSD',r:1,usd:100},
 {id:'ok-2',date:'2026-10-21',symbol:'EURUSD',r:-1,usd:-50}
];
test('diagnostic report is read-only and reports a clean sample without changing source',()=>{const trades=sample(),before=JSON.stringify(trades);const report=audit.buildDiagnosticReport(trades,analytics,errors.detect(trades,{}).findings);assert.equal(report.readOnly,true);assert.equal(report.summary.totalIssues,0);assert.equal(JSON.stringify(trades),before);});
test('diagnostic report classifies malformed journal records as critical',()=>{const trades=sample();trades.push({...trades[0]});const report=audit.buildDiagnosticReport(trades,analytics,[]);assert.ok(report.summary.critical>=1);assert.ok(report.items.some(x=>x.code==='duplicate_id'&&x.severity==='critical'));});
test('diagnostic report classifies inconsistent evidence as warning without rewriting records',()=>{const trades=sample(),before=JSON.stringify(trades);const report=audit.buildDiagnosticReport(trades,analytics,[{id:'finding-1',tradeIds:['deleted-trade']}]);assert.equal(report.summary.warning,1);assert.ok(report.items.some(x=>x.code==='orphan_finding_trade_id'));assert.equal(JSON.stringify(trades),before);});
test('diagnostic report includes timestamp, schema and stable severity totals',()=>{const report=audit.buildDiagnosticReport(sample(),analytics,[]);assert.equal(report.schemaVersion,1);assert.ok(Number.isFinite(Date.parse(report.generatedAt)));assert.equal(report.summary.critical+report.summary.warning+report.summary.info,report.summary.totalIssues);});
test('diagnostics UI is connected to analytics and provides explicit JSON export',()=>{const fs=require('node:fs'),path=require('node:path');const ui=fs.readFileSync(path.join(__dirname,'../js/ui/analytics.js'),'utf8');const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.match(ui,/renderDiagnostics\(lastTrades\)/);assert.match(ui,/v9DiagExport/);assert.match(ui,/buildDiagnosticReport/);assert.match(html,/src="js\/core\/trade-audit\.js"/);});
