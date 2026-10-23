import json
from playwright.sync_api import sync_playwright
out={}; errs=[]
def setv(pg,pairs): pg.evaluate("(ps)=>ps.forEach(([i,v])=>{document.getElementById(i).value=v})",pairs)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':800}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)[:250]))
    pg.add_init_script("localStorage.setItem('arex-auth-uid','kbtest')")
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(1500); pg.evaluate("startApp()"); pg.wait_for_timeout(1200); pg.evaluate("applyLanguage('fa')"); pg.wait_for_timeout(300)   # default language follows the browser locale (en in CI)
    # --- trade form new fields
    pg.evaluate("goView('trades')")
    setv(pg,[('trSymbol','XAUUSD'),('trDir','buy'),('trEntry','2000'),('trSl','1990'),('trTp','2030'),('trExit','2020'),('trR','2'),('trUsd','200'),('trSetup','اردربلاک'),('trRiskPct','2'),('trSlOrig','1995'),('trEmoBefore','عجول'),('trEmoAfter','آرام'),('trTags','خبر، لندن, خبر'),('trNote','<b>x</b>')])
    pg.evaluate("document.getElementById('addTradeBtn').click()"); pg.wait_for_timeout(600)
    out['trade']=pg.evaluate("(({riskPct,slOriginal,tp,emotionBefore,emotionAfter,tags})=>({riskPct,slOriginal,tp,emotionBefore,emotionAfter,tags}))(state.trades[0])")
    out['card_meta']=pg.evaluate("[...document.querySelectorAll('#tradesList .entry-card')][0].textContent.includes('ریسک 2%')")
    pg.evaluate("document.querySelector('#tradesList .trade-edit-btn').click()"); pg.wait_for_timeout(300)
    out['edit_populates']=pg.evaluate("[trRiskPct.value,trSlOrig.value,trTp.value,trEmoBefore.value,trTags.value]")
    pg.evaluate("document.getElementById('cancelTradeEditBtn').click()")
    # --- analytics: cfg + errors using the new fields
    pg.evaluate("window.__arexGuardCfg={maxRiskPct:1,minRR:2,maxTradesPerDay:3}; storage.set('guardCfg',JSON.stringify(window.__arexGuardCfg)); goView('analytics'); document.getElementById('arexAnalyticsPeriod').value='all'; renderArexAnalytics()"); pg.wait_for_timeout(900)
    et=pg.evaluate("document.getElementById('v9Errors').textContent"); out['over_risk_found']='ریسک بیش از سقف مجاز' in et; out['sl_widened_found']='دورکردن SL' in et; out['needs_info_no_longer_lists_overrisk']=not pg.evaluate("document.getElementById('v9Errors').textContent.includes('سقف ریسک هر معامله (maxRiskPct) تعریف نشده')")
    # --- strategy KB
    pg.evaluate("goView('strategy')"); pg.wait_for_timeout(700)
    pg.evaluate("document.getElementById('kbNewBox').open=true")
    setv(pg,[('kbText','ورود فقط پس از تأیید ساختار'),('kbKind','mandatory'),('kbStrategy','اردربلاک')])
    pg.evaluate("document.getElementById('kbAdd').click()"); pg.wait_for_timeout(500)
    out['after_propose']=pg.evaluate("(()=>{const k=window.__arexKB;return {rules:k.rules.length,status:k.rules[0].status,versions:k.versions.length}})()")
    pg.evaluate("window.prompt=()=>'تأیید اولیه'"); pg.evaluate("document.querySelector('[data-kb=approve]').click()"); pg.wait_for_timeout(500)
    out['after_approve']=pg.evaluate("(()=>{const k=window.__arexKB;return {status:k.rules[0].status,versions:k.versions.length}})()")
    # duplicate proposal -> conflict warning
    pg.evaluate("document.getElementById('kbNewBox').open=true")
    setv(pg,[('kbText','ورود فقط پس از تأیید ساختار'),('kbKind','confirmed'),('kbStrategy','اردربلاک')]); pg.evaluate("document.getElementById('kbAdd').click()"); pg.wait_for_timeout(500)
    out['conflict_shown']=pg.evaluate("document.getElementById('v9KB').textContent.includes('متن دو قانون یکسان است')")
    pg.evaluate("document.querySelector('[data-kb=reject]').click()"); pg.wait_for_timeout(400)
    # revise
    pg.evaluate("(()=>{let n=0;window.prompt=()=>(++n===1?'ورود پس از تأیید ساختار و کندل بسته':'سخت‌گیری بیشتر')})()")
    pg.evaluate("document.querySelector('[data-kb=revise]').click()"); pg.wait_for_timeout(500)
    out['after_revise']=pg.evaluate("(()=>{const k=window.__arexKB;return {versions:k.versions.length,v1snap:k.versions[0].snapshot[0].text,v2snap:k.versions[1].snapshot[0].text,statuses:k.rules.map(r=>r.status)}})()")
    out['evolution_has_2']=pg.evaluate("document.getElementById('v9KB').textContent.includes('نسخه ۲')||document.getElementById('v9KB').textContent.includes('نسخه 2')")
    out['kb_overflow']=pg.evaluate("[document.documentElement.scrollWidth,document.documentElement.clientWidth]")
    # --- gate
    pg.evaluate("goView('trades')"); pg.wait_for_timeout(300)
    setv(pg,[('trDir','buy'),('trEntry','2000'),('trSl','1990'),('trTp','2030'),('trRiskPct','0.5'),('trSetup','اردربلاک')])
    pg.evaluate("document.getElementById('ptBox').open=true; document.getElementById('ptRun').click()"); pg.wait_for_timeout(600)
    gt=lambda: pg.evaluate("document.getElementById('ptOut').textContent")
    out['gate_unticked']=gt()[:200]
    pg.evaluate("document.querySelector('[data-pt]').click()"); pg.wait_for_timeout(600)
    out['gate_ticked']=gt()[:160]
    setv(pg,[('trRiskPct','2')]); pg.evaluate("document.getElementById('ptRun').click()"); pg.wait_for_timeout(500)
    out['gate_overrisk']=gt()[:120]
    out['trades_overflow']=pg.evaluate("[document.documentElement.scrollWidth,document.documentElement.clientWidth]")
    # persistence
    pg.reload(); pg.wait_for_timeout(1500); pg.evaluate("startApp()"); pg.wait_for_timeout(1200); pg.evaluate("goView('strategy')"); pg.wait_for_timeout(800)
    out['persisted']=pg.evaluate("(()=>{const k=window.__arexKB;return k?{versions:k.versions.length,rules:k.rules.length}:null})()")
    b.close()
print(json.dumps(out,ensure_ascii=False,indent=1)); print('page_errors',errs)
