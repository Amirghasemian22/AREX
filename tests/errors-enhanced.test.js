const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/core/errors.js');

test('tagged repeated mistakes report recurrence and descriptive loss metrics', () => {
  const trades = [
    {id:'a',date:'2026-01-01',mistakes:['انتقام'],r:'-1'},
    {id:'b',date:'2026-01-02',mistakes:['انتقام'],r:'-0.5'},
    {id:'c',date:'2026-01-03',mistakes:['انتقام'],r:'1'},
    {id:'d',date:'2026-01-04',mistakes:[],r:'2'}
  ];
  const out = E.detect(trades, {});
  const f = out.findings.find(x => x.id === 'tag:revenge');
  assert.ok(f); assert.equal(f.count, 3); assert.equal(f.repeated, true);
  assert.equal(f.outcomeCount, 3); assert.equal(f.lossRate, 0.6667);
  assert.equal(f.avgR, -0.1667); assert.equal(f.estCostR, -1.5);
  assert.equal(out.summary.repeatedFindings >= 1, true);
});

test('emotion association is low confidence, requires at least three outcomes, and does not claim causality', () => {
  const trades = [
    {id:'a',date:'2026-01-01',emoBefore:'anxious',r:'-1'},
    {id:'b',date:'2026-01-02',emoBefore:'anxious',r:'-1'},
    {id:'c',date:'2026-01-03',emoBefore:'anxious',r:'1'},
    {id:'d',date:'2026-01-04',emoBefore:'anxious',r:'2'},
    {id:'e',date:'2026-01-05',emoBefore:'calm',r:'2'}
  ];
  const out = E.detect(trades, {});
  assert.equal(out.findings.some(x => x.id.startsWith('emotion:')), false);
  trades[2].r = '-0.25';
  const out2 = E.detect(trades, {}), f = out2.findings.find(x => x.id.startsWith('emotion:'));
  assert.ok(f); assert.equal(f.confidence, 'low'); assert.equal(f.associationOnly, true);
});

test('missing outcome and emotion data are surfaced as limitations, not zeroes', () => {
  const out = E.detect([{id:'x',date:'2026-01-01',mistakes:['خروج عجولانه']}], {});
  const f = out.findings.find(x => x.id === 'tag:hasty_exit');
  assert.equal(f.lossRate, null); assert.equal(f.avgR, null); assert.equal(f.estCostR, 0);
  assert.ok(out.needsInfo.some(x => x.id === 'emotion_data'));
});

test('all tagged trades remain drillable by their real ids', () => {
  const out = E.detect([{id:'real-1',date:'2026-01-01',mistakes:['خارج از پلن'],r:'-1'}], {});
  const f = out.findings.find(x => x.id === 'tag:off_plan');
  assert.deepEqual(f.tradeIds, ['real-1']);
});
