const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('phase 29 adds cross-navigation to the goals workflow without replacing existing sections', () => {
  assert.match(html, /id="view-goals"/);
  assert.match(html, /id="view-roadmap"/);
  assert.match(html, /id="view-daily"/);
  assert.match(html, /id="view-analytics"/);
  assert.match(html, /class="card phase29-workflow-card"/);
  for (const view of ['roadmap', 'trades', 'daily', 'analytics', 'path']) {
    assert.match(html, new RegExp(`data-arex-go="${view}"`));
  }
});

test('phase 29 links daily evidence review back to planning and goals', () => {
  const dailySection = html.split('id="view-daily"')[1].split('<!-- PSYCH -->')[0];
  assert.match(dailySection, /data-arex-go="roadmap"/);
  assert.match(dailySection, /data-arex-go="goals"/);
  assert.match(dailySection, /data-arex-go="analytics"/);
  assert.match(dailySection, /data-arex-go="psych"/);
});

test('phase 29 keeps the workflow navigational and preserves existing data structures', () => {
  assert.match(html, /state\.dailyLogs\[date\]=log/);
  assert.match(html, /state\.correctiveActionHistory/);
  assert.match(html, /state\.goals/);
  assert.match(html, /document\.querySelectorAll\('\[data-arex-go\]'\)/);
  assert.match(sw, /workflows-phase29-48/);
});
