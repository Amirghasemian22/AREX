import json
from playwright.sync_api import sync_playwright
out={}; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':800}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    pg.add_init_script("localStorage.setItem('arex-auth-uid','pgtest')")
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(1500); pg.evaluate("startApp()"); pg.wait_for_timeout(1200); pg.evaluate("goView('propfirm')")
    for id,v in [('pfName','<i>FTMO</i> Step1'),('pfBalance','10000'),('pfTarget','800'),('pfDailyLoss','500'),('pfMaxLoss','1000'),('pfDaysLeft','30')]:
        pg.evaluate("([i,v])=>{document.getElementById(i).value=v}",[id,v])
    pg.evaluate("document.getElementById('addChallengeBtn').click()"); pg.wait_for_timeout(400)
    g=lambda: pg.evaluate("document.querySelector('.v9-guard').textContent")
    out['initial']=g()[:260]
    out['name_escaped']=pg.evaluate("!document.querySelector('.challenge-head i')")
    pg.evaluate("window.prompt=()=>'-400'"); pg.evaluate("document.querySelector('.ch-add-pnl').click()"); pg.wait_for_timeout(300)
    out['after_-400']=g()[:300]
    pg.evaluate("window.prompt=()=>'-150'"); pg.evaluate("document.querySelector('.ch-add-pnl').click()"); pg.wait_for_timeout(300)
    out['after_-550']=g()[:300]
    out['overflow']=pg.evaluate("[document.documentElement.scrollWidth,document.documentElement.clientWidth]")
    b.close()
print(json.dumps(out,ensure_ascii=False,indent=1)); print('page_errors',errs)
