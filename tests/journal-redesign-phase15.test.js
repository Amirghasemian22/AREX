const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('Phase 15 journal filters are present and labelled accessibly', () => {
  for (const id of ['arexTradeSearch','arexTradeOutcome','arexTradeDirection','arexTradePeriod','arexTradeReset','arexTradeFilterSummary']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /role="search"/);
  assert.match(html, /aria-live="polite"/);
});

test('Phase 15 filtering is presentation-only and does not write trade data', () => {
  assert.match(html, /function getArexJournalVisibleTrades\(\)/);
  assert.match(html, /Journal filters are presentation-only and never mutate saved trade data/);
  const start = html.indexOf('function getArexJournalVisibleTrades()');
  const end = html.indexOf('function renderTrades()', start);
  assert.ok(start >= 0 && end > start);
  const filterFunction = html.slice(start, end);
  assert.doesNotMatch(filterFunction, /queueSave|state\.trades\s*=|\.splice\(|\.push\(/);
});

test('Phase 15 journal layout includes responsive and reduced-motion rules', () => {
  assert.match(html, /\.arex-journal-filters/);
  assert.match(html, /@media\(max-width:520px\)/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
});
