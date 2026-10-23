import json, os
from playwright.sync_api import sync_playwright
CSV = "Date,Time,Symbol,Type,Price,SL,Price,Profit,Ticket,Comment\n2026-03-04,09:05,xauusd,buy,2000,1990,2020,200,T1,<img src=x onerror=window.__xss=1>\n2026-03-04,10:00,EURUSD,sell,1.1000,1.1050,1.0900,50,T2,\n2026-03-04,10:00,EURUSD,sell,1.1000,1.1050,1.0900,50,T2,\n2026-03-05,,GBPUSD,hold,1.3,,,,T3,\n"
open('/tmp/t.csv','w',encoding='utf-8').write(CSV)
out={}; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    pg.add_init_script("localStorage.setItem('arex-auth-uid','e2etest1')")
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("goView('trades')"); pg.wait_for_timeout(500)
    out['trades_before']=pg.evaluate("state.trades.length")
    pg.evaluate("document.getElementById('openImportBtn').click()"); pg.wait_for_timeout(300)
    out['modal_open']=pg.evaluate("document.getElementById('importOverlay').classList.contains('open')")
    pg.set_input_files('#impFile','/tmp/t.csv'); pg.wait_for_timeout(600)
    out['summary']=pg.inner_text('#impSummary')
    out['commit_label']=pg.inner_text('#impCommit'); out['commit_disabled']=pg.evaluate("document.getElementById('impCommit').disabled")
    out['xss']=pg.evaluate("window.__xss===1")
    out['overflow_modal']=pg.evaluate("(()=>{const m=document.querySelector('#importOverlay .modal');return [m.scrollWidth,m.clientWidth, document.documentElement.scrollWidth, document.documentElement.clientWidth]})()")
    pg.screenshot(path='/tmp/imp390.png')
    pg.evaluate("document.getElementById('impCommit').click()"); pg.wait_for_timeout(600)
    out['trades_after']=pg.evaluate("state.trades.length")
    out['sample']=pg.evaluate("(({id,date,time,symbol,dir,r,usd,importBatch,riskPct,tags,sessions})=>({date,time,symbol,dir,r,usd,hasBatch:!!importBatch,riskPct,tags,sessions}))(state.trades[0])")
    out['list_has_row']=pg.evaluate("document.getElementById('tradesList').textContent.includes('XAUUSD')")
    out['xss_after_commit']=pg.evaluate("window.__xss===1")
    out['note_rendered_as_text']=pg.evaluate("document.getElementById('tradesList').textContent.includes('<img src=x')")
    out['list_cards']=pg.evaluate("document.querySelectorAll('#tradesList .entry-card').length")
    pg.wait_for_timeout(800)
    # persistence across reload
    pg.reload(); pg.wait_for_timeout(1500); pg.evaluate("startApp()"); pg.wait_for_timeout(1500); pg.evaluate("goView('trades')")
    out['after_reload']=pg.evaluate("state.trades.length")
    # re-import same file => all duplicates
    out['reload_list_cards']=pg.evaluate("document.querySelectorAll('#tradesList .entry-card').length")
    pg.evaluate("document.getElementById('openImportBtn').click()"); pg.wait_for_timeout(500)
    out['undo_visible']=pg.evaluate("getComputedStyle(document.getElementById('impUndo')).display!=='none'")
    pg.set_input_files('#impFile','/tmp/t.csv'); pg.wait_for_timeout(600)
    out['reimport_summary']=pg.inner_text('#impCommit')
    pg.evaluate("document.getElementById('impCancel').click()")
    # undo
    pg.evaluate("window.confirm=()=>true"); pg.evaluate("document.getElementById('openImportBtn').click()"); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('impUndo').click()"); pg.wait_for_timeout(700)
    out['after_undo']=pg.evaluate("state.trades.length")
    b.close()
print(json.dumps(out,ensure_ascii=False,indent=1)); print('page_errors',errs)
