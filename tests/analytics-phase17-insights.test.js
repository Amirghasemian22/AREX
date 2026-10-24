const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
test('Phase 17 adds evidence-first analytics insight panel without replacing existing analytics', () => {
  const ui = fs.readFileSync(path.join(root, 'js/ui/analytics.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(ui, /arexAnalyticsInsights/);
  assert.match(ui, /renderInsights\(lastTrades\)/);
  assert.match(ui, /g\.rSample >= 5/);
  assert.match(ui, /برتری آینده را ثابت نمی‌کند/);
  assert.match(html, /arex-insight-grid/);
  assert.match(html, /@media\(max-width:560px\)/);
  assert.match(html, /id="arexAnalyticsBreakdown"/);
});
test('Phase 17 insight rendering does not mutate trade records', () => {
  const analytics = require(path.join(root, 'js/core/analytics.js'));
  const trades = Array.from({length: 6}, (_, i) => ({id: String(i), symbol:'XAUUSD', setup:'A', sessions:['London'], date:`2026-10-${String(i+1).padStart(2,'0')}`, time:'10:00', r:i % 2 ? -1 : 2}));
  const before = JSON.stringify(trades);
  analytics.summarize(trades, {}); analytics.byStrategy(trades.filter(t => analytics.outcome(t).r !== null), {}); analytics.bySession(trades, {});
  assert.equal(JSON.stringify(trades), before);
});
