import json, re
from playwright.sync_api import sync_playwright
R=[2,-1,-1,3,-1,-1,-1,-1]
TR=[{'id':100+i,'date':'2026-03-0%d'%(i+2),'time':'%02d:30'%(9+i%3),'symbol':'XAUUSD','dir':'buy','entry':'2000','sl':'1990','tp':'2030','exit':'2010','r':str(r),'usd':str(r*100),'setup':'A','note':'n','mistakes':['انتقام‌ترید'] if i==6 else [],'ruleCompliance':100 if i<4 else 50,'sessions':['London'],'riskPct':2,'slOriginal':1995 if i==1 else None,'tags':[]} for i,r in enumerate(R)]
CSV="Date,Time,Symbol,Type,Price,SL,Price,Profit,Ticket\n2026-03-04,09:05,xauusd,buy,2000,1990,2020,200,T1\n2026-03-04,09:05,xauusd,buy,2000,1990,2020,200,T1\n03/04/2026,09:05,EURUSD,sell,1,1.1,0.9,5,T3\n"
open('/tmp/i18n.csv','w',encoding='utf-8').write(CSV)
RAW=re.compile(r'\b(?:a|e|rs|q|st|pg|pt|kb|imp|tf|emo|wd|conf|kind)\.[A-Za-z_:.0-9]{2,}\b')
out={}; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':800}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)[:250]))
    pg.add_init_script("localStorage.setItem('arex-auth-uid','i18ntest')")
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(1500); pg.evaluate("startApp()"); pg.wait_for_timeout(1200)
    pg.evaluate("window.__arexGuardCfg={maxRiskPct:1,minRR:2,maxTradesPerDay:3}")
    pg.evaluate("state.trades=%s; document.getElementById('arexAnalyticsPeriod').value='all'"%json.dumps(TR))
    # KB with one official + duplicate proposal so conflicts show
    pg.evaluate("""(async()=>{const K=AREXCore.strategykb;let kb=K.emptyKB();const n={date:'2026-03-01',time:'08:00',iso:'2026-03-01T08:00:00Z'};
      let r=K.propose(kb,{text:'Entry only after structure confirmation',kind:'mandatory',strategy:'A'},n,()=>'k1');kb=K.approve(r.kb,'k1','initial',n).kb;
      r=K.propose(kb,{text:'Entry only after structure confirmation',kind:'confirmed',strategy:'A'},n,()=>'k2');kb=r.kb;window.__arexKB=kb;await storage.set('strategyKB',JSON.stringify(kb));})()""")
    pg.wait_for_timeout(400)
    for lang in ('fa','en','de'):
        o={}
        pg.evaluate("applyLanguage('%s')"%lang); pg.wait_for_timeout(300)
        o['dir']=pg.evaluate("document.documentElement.dir")
        pg.evaluate("goView('analytics'); renderArexAnalytics()"); pg.wait_for_timeout(900)
        o['analytics_raw_keys']=sorted(set(RAW.findall(pg.evaluate("[...document.querySelectorAll('#arexAnalyticsKpis,#arexAnalyticsBreakdown,#arexV9Extra')].map(e=>e.textContent).join(' ')"))))
        o['analytics_sample']=pg.evaluate("document.getElementById('arexAnalyticsKpis').textContent")[:90]
        o['errors_sample']=pg.evaluate("document.getElementById('v9Errors').textContent")[:120]
        pg.evaluate("goView('strategy')"); pg.wait_for_timeout(700)
        o['kb_raw_keys']=sorted(set(RAW.findall(pg.evaluate("document.getElementById('v9KB').textContent"))))
        o['kb_sample']=pg.evaluate("document.getElementById('v9KB').textContent")[:110]
        pg.evaluate("goView('trades')"); pg.wait_for_timeout(300)
        pg.evaluate("trDir.value='buy'; trEntry.value='2000'; trSl.value='1990'; trTp.value='2030'; trRiskPct.value='2'; trSetup.value='A'; document.getElementById('ptBox').open=true; document.getElementById('ptRun').click()"); pg.wait_for_timeout(600)
        gt=pg.evaluate("document.getElementById('ptOut').textContent")
        o['gate_raw_keys']=sorted(set(RAW.findall(gt))); o['gate_sample']=gt[:140]
        o['form_labels']=pg.evaluate("[document.querySelector('[data-v9=\"tf.risk\"]').textContent, document.querySelector('#trEmoBefore option:nth-child(2)').textContent, document.getElementById('trTags').placeholder]")
        pg.evaluate("document.getElementById('openImportBtn').click()"); pg.wait_for_timeout(300)
        pg.set_input_files('#impFile','/tmp/i18n.csv'); pg.wait_for_timeout(600)
        it=pg.evaluate("document.getElementById('importOverlay').textContent")
        o['import_raw_keys']=sorted(set(RAW.findall(it))); o['import_sample']=pg.evaluate("document.getElementById('impSummary').textContent")[:110]; o['import_btn']=pg.evaluate("document.getElementById('openImportBtn').textContent")
        pg.evaluate("document.getElementById('impCancel').click()")
        out[lang]=o
    b.close()
print(json.dumps(out,ensure_ascii=False,indent=1)); print('page_errors',errs)
