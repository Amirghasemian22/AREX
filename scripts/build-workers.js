#!/usr/bin/env node
/* Embeds js/core/kb.js (the knowledge engine) into arex-edge-worker.js between the KB_ENGINE markers. Run after changing kb.js. */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/core/kb.js'), 'utf8'), wp = path.join(root, 'arex-edge-worker.js'); let w = fs.readFileSync(wp, 'utf8');
const block = '/*KB_ENGINE_START*/\nconst KB = (() => { const module = { exports: {} };\n' + src + '\nreturn module.exports; })();\n/*KB_ENGINE_END*/';
if (!/\/\*KB_ENGINE_START\*\/[\s\S]*\/\*KB_ENGINE_END\*\//.test(w)) { console.error('markers missing in arex-edge-worker.js'); process.exit(1); }
w = w.replace(/\/\*KB_ENGINE_START\*\/[\s\S]*\/\*KB_ENGINE_END\*\//, () => block); fs.writeFileSync(wp, w); console.log('kb engine embedded:', src.length, 'bytes');
