#!/usr/bin/env node
/* Builds private-kb/kb-pack.json (upload it to Cloudflare KV key "pack") from private-kb/*.md + optional private-kb/decisions.json. */
const fs = require('fs'), path = require('path'), kb = require('../js/core/kb.js');
const dir = path.join(__dirname, '..', 'private-kb'), files = fs.readdirSync(dir).filter(f => /\.md$/i.test(f) && !/^README/i.test(f)).sort();
let pack = null; files.forEach((f, n) => { const p = kb.parse(fs.readFileSync(path.join(dir, f), 'utf8'), { title: f, builtAt: new Date().toISOString().slice(0, 10) }); if (!pack) pack = p; else { p.chunks.forEach(c => { c.id = 'f' + n + '_' + c.id; if (c.conflictId) c.conflictId = 'F' + n + c.conflictId; pack.chunks.push(c); }); Object.assign(pack.images, p.images); } });
if (!pack) { console.error('no .md file in private-kb/'); process.exit(1); }
let dec = {}; try { dec = JSON.parse(fs.readFileSync(path.join(dir, 'decisions.json'), 'utf8')); } catch (e) {}
pack.decisions = {}; Object.keys(dec).forEach(k => { if (!k.startsWith('_') && String(dec[k]).trim()) pack.decisions[k] = { text: String(dec[k]).trim() }; });
fs.writeFileSync(path.join(dir, 'kb-pack.json'), JSON.stringify(pack));
console.log('files:', files.join(', '), '| chunks:', pack.chunks.length, '| conflicts:', pack.chunks.filter(c => c.conflictId).length, '| decisions:', Object.keys(pack.decisions).length);
