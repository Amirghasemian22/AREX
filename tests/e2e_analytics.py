import json
from playwright.sync_api import sync_playwright
R=[2,-1,-1,3,-1,-1,-1,-1]
TR=[{'id':100+i,'date':'2026-03-0%d'%(i+2),'time':'%02d:30'%(9+i%3),'symbol':'XAUUSD' if i%2==0 else 'EURUSD','dir':'buy' if i%2==0 else 'sell','entry':'1','sl':'0.9','exit':'1.1','r':str(r),'usd':str(r*100),'setup':'A' if i<4 else 'B','note':'<b>n%d</b>'%i,'mistakes':['انتقام‌ترید'] if i==6 else [],'ruleCompliance':100 if i<4 else 50,'sessions':['London'],'riskPct':None,'tags':[]} for i,r in enumerate(R)]
out={}; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (320,390,1024):
        ctx=b.new_context(viewport={'width':w,'height':800}); pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
        pg.add_init_script("localStorage.setItem('arex-auth-uid','e2e%d')"%w)
        pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(1500); pg.evaluate("startApp()"); pg.wait_for_timeout(1500)
        pg.evaluate("window.__TR=%s; state.trades=window.__TR; goView('analytics'); document.getElementById('arexAnalyticsPeriod').value='all'; document.getElementById('arexAnalyticsPeriod').dispatchEvent(new Event('change'))"%json.dumps(TR)); pg.wait_for_timeout(900)
        o={}
        o['kpi_text']=pg.evaluate("document.querySelector('#arexAnalyticsKpis').textContent")[:330]
        o['expected']=pg.evaluate("(({winRate,expectancyR,profitFactor,totalR,counted,lowSample})=>({winRate,expectancyR,profitFactor,totalR,counted,lowSample}))(AREXCore.analytics.summarize(state.trades))")
        o['sections']=pg.evaluate("['v9Heat','v9Errors','v9RiskState','v9Quality','v9Cfg'].map(i=>!!document.getElementById(i)&&document.getElementById(i).textContent.length>10)")
        o['risk_alerts']=pg.evaluate("document.querySelector('#v9RiskState').textContent")[:140].replace('\n',' | ')
        o['errors']=pg.evaluate("document.querySelector('#v9Errors').textContent")[:200].replace('\n',' | ')
        o['quality']=pg.evaluate("document.querySelector('#v9Quality').textContent")[:120].replace('\n',' | ')
        o['overflow']=pg.evaluate("[document.documentElement.scrollWidth,document.documentElement.clientWidth]")
        if w==390:
            pg.evaluate("document.querySelector('[data-cell]').click()"); pg.wait_for_timeout(300)
            o['drill_rows']=pg.evaluate("document.querySelectorAll('#v9Drill [data-v9open]').length")
            pg.evaluate("document.querySelector('#v9Drill [data-v9open]').click()"); pg.wait_for_timeout(700)
            o['opened_journal']=pg.evaluate("document.getElementById('view-trades').classList.contains('active')")
            o['flash']=pg.evaluate("!!document.querySelector('#tradesList .v9-flash')")
            o['note_escaped']=pg.evaluate("!document.querySelector('#tradesList b') || !document.querySelector('#tradesList .entry-card b:not(:first-child)')")
            pg.screenshot(path='/tmp/an390.png', full_page=False)
        out[w]=o; ctx.close()
    b.close()
print(json.dumps(out,ensure_ascii=False,indent=1)); print('page_errors',errs)
