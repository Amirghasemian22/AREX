'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const sw = fs.readFileSync('sw.js','utf8');

test('V9.8.0 exposes directly editable and explicitly saved risk limits on the risk page',()=>{
  for(const id of ['riskBalanceInput','riskDailyPctInput','riskWeeklyPctInput','riskPerTradePctInput','riskMaxTradesInput','riskMaxLossesInput','riskSettingsSaveBtn']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/function saveRiskLimitsFromUi\(\)/);
  assert.match(html,/applyRiskLimitsToState\(\{balance:nums\.balance,dailyPct:nums\.dailyPct,weeklyPct:nums\.weeklyPct,riskPerTradePct:nums\.riskPerTradePct,maxTradesPerDay:nums\.maxTradesPerDay,maxLossesPerDay:nums\.maxLossesPerDay\}\)/);
  assert.match(html,/queueSave\('riskLimits'\)/);
});

test('V9.8.0 evaluates daily loss, per-trade risk and trade caps against configured limits',()=>{
  assert.match(html,/const maxLosses=Math\.max\(1,Number\(\(state\.riskLimits\|\|\{\}\)\.maxLossesPerDay\)\|\|3\)/);
  assert.match(html,/const dailyLimitPct=Number\(lim\.dailyPct\)\|\|3/);
  assert.match(html,/const maxRiskPct=Number\(lim\.riskPerTradePct\)\|\|1/);
  assert.match(html,/const maxTrades=Math\.max\(1,Number\(lim\.maxTradesPerDay\)\|\|4\)/);
});

test('V9.8.0 adds a topbar sync shortcut and drives a concrete next-step recommendation',()=>{
  assert.match(html,/id="driveQuickSyncBtn"/);
  assert.match(html,/function setDriveQuickSyncState\(/);
  assert.match(html,/function getArexNextTradingStep\(/);
  assert.match(html,/function renderArexNextStepNudge\(/);
  assert.match(html,/arexNextStepTimer=setTimeout\(/);
  assert.match(sw,/v9-8-0-brain-mobile-2026-10-29/);
});
