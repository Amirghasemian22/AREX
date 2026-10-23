import json
exec(open('tests/e2e_i18n.py',encoding='utf-8').read().split("RAW=re.compile")[0])
from playwright.sync_api import sync_playwright
out={}
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (320,390):
        pg=b.new_context(viewport={'width':w,'height':800}).new_page()
        pg.add_init_script("localStorage.setItem('arex-auth-uid','ovf%d')"%w)
        pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(1500); pg.evaluate("startApp()"); pg.wait_for_timeout(1200)
        pg.evaluate("window.__arexGuardCfg={maxRiskPct:1,minRR:2,maxTradesPerDay:3}; state.trades=%s; document.getElementById('arexAnalyticsPeriod').value='all'"%json.dumps(TR))
        for lang in ('fa','en','de'):
            pg.evaluate("applyLanguage('%s')"%lang); pg.wait_for_timeout(250)
            r={}
            for v in ('analytics','strategy','trades','propfirm'):
                pg.evaluate("goView('%s')"%v); pg.wait_for_timeout(500)
                if v=='trades': pg.evaluate("document.getElementById('trAdvanced').open=true; document.getElementById('ptBox').open=true; document.getElementById('ptRun').click()"); pg.wait_for_timeout(400)
                r[v]=pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
            pg.evaluate("document.getElementById('openImportBtn').click()"); pg.set_input_files('#impFile','/tmp/i18n.csv'); pg.wait_for_timeout(500)
            r['import_modal']=pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth"); pg.evaluate("document.getElementById('impCancel').click()")
            out['%d/%s'%(w,lang)]=r
    b.close()
print(json.dumps(out)); 
