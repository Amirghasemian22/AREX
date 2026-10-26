'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../js/core/account-local-storage.js');
function memoryStore(initial={}){const m=new Map(Object.entries(initial));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)};}
test('account-local keys preserve normal IDs and prevent collisions for unusual IDs',()=>{
 assert.equal(A.keyFor('history','123-ABC'),'history-123-ABC');
 assert.notEqual(A.keyFor('history','123'),A.keyFor('history','456'));
 assert.notEqual(A.keyFor('history','a.b'),A.keyFor('history','ab'));
 assert.notEqual(A.keyFor('history','/../'),A.keyFor('history','..'));
 assert.equal(A.accountId(memoryStore({'arex-auth-uid':'a.b'})),'a.b');
});
test('legacy records migrate only to their declared owner',()=>{
 const store=memoryStore({'arex-auth-uid':'accountA','arex-legacy-owner':'accountA','history':'["old"]'});
 assert.deepEqual(A.read(store,'history',[]),['old']);
 assert.equal(store.getItem('history-accountA'),'["old"]');
 store.setItem('arex-auth-uid','accountB');
 assert.deepEqual(A.read(store,'history',[]),[]);
});
test('legacy local preview remains local only when no owner is declared',()=>{
 const store=memoryStore({'history':'[1]'});
 assert.deepEqual(A.read(store,'history',[]),[1]);
 store.setItem('arex-auth-uid','accountA');
 assert.deepEqual(A.read(store,'history',[]),[]);
});
test('writes always use the active account namespace',()=>{
 const store=memoryStore({'arex-auth-uid':'userA'});
 assert.equal(A.write(store,'roadmap',{done:true}),true);
 store.setItem('arex-auth-uid','userB');
 assert.deepEqual(A.read(store,'roadmap',{}),{});
 assert.deepEqual(JSON.parse(store.getItem('roadmap-userA')), {done:true});
});
test('legacy migration policy is explicit and fail-closed for another account',()=>{
 assert.equal(A.mayReadLegacy('A','A'),true);
 assert.equal(A.mayReadLegacy('B','A'),false);
 assert.equal(A.mayReadLegacy('local',''),true);
 assert.equal(A.mayReadLegacy('A',''),false);
});
test('strategy history, daily roadmap, and AI endpoint are wired through account-scoped storage',()=>{
 const fs=require('node:fs');
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/function getArexRoadmapState\(\)\{return AREXCore\.accountLocalStorage\.read/);
 assert.match(html,/function saveArexRoadmapState\(v\)\{return AREXCore\.accountLocalStorage\.write/);
 assert.match(html,/function getArexAnalysisHistory\(\)\{const value=AREXCore\.accountLocalStorage\.read/);
 assert.match(html,/const readEndpoint=\(\)=>String\(AREXCore\.accountLocalStorage\.read/);
 assert.match(html,/const saveEndpoint=value=>AREXCore\.accountLocalStorage\.write/);
 assert.match(html,/<script src="js\/core\/account-local-storage\.js"><\/script>/);
 const sw=fs.readFileSync('sw.js','utf8');assert.match(sw,/\.\/js\/core\/account-local-storage\.js/);
});

test('calendar feed and manually entered event fields are HTML-escaped before rendering',()=>{
 const fs=require('node:fs');const html=fs.readFileSync('index.html','utf8');
 for(const fragment of [
  "escapeHtml(nextHigh.country)","escapeHtml(nextHigh.title)","escapeHtml(e.country)","escapeHtml(e.title)","escapeHtml(e.forecast||'—')","escapeHtml(e.previous||'—')",
  "escapeHtml(ev.country)","escapeHtml(ev.title)","escapeHtml(ev.date)","escapeHtml(ev.time||'—')","escapeHtml(ev.id)"
 ]) assert.ok(html.includes(fragment),`missing safe rendering for ${fragment}`);
});

test('distinct account IDs cannot collide after namespace encoding',()=>{
 const store=memoryStore({'arex-auth-uid':'a.b'});
 assert.equal(A.write(store,'history',['first']),true);
 store.setItem('arex-auth-uid','ab');
 assert.deepEqual(A.read(store,'history',[]),[]);
 store.setItem('arex-auth-uid','a.b');
 assert.deepEqual(A.read(store,'history',[]),['first']);
});
