import json, os
from playwright.sync_api import sync_playwright
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH','/opt/pw-browsers')
res={'console_errors':[], 'page_errors':[], 'failed':[]}
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (320,390,560,768,1024,1440):
        ctx=b.new_context(viewport={'width':w,'height':800}); pg=ctx.new_page()
        if w==320:
            pg.on('console',lambda m: res['console_errors'].append(m.text[:200]) if m.type=='error' else None)
            pg.on('pageerror',lambda e: res['page_errors'].append(str(e)[:300]))
            pg.on('requestfailed',lambda r: res['failed'].append(r.url[-80:]))
        pg.goto('http://localhost:8765/index.html',wait_until='load'); pg.wait_for_timeout(1500)
        info=pg.evaluate("""()=>({title:document.title,core:Object.keys(window.AREXCore||{}),
          sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth,
          brand:(document.querySelector('[data-i18n="brand.sub"]')||{}).textContent})""")
        print(w, json.dumps(info,ensure_ascii=False))
        if w==390: pg.screenshot(path='/tmp/s390.png')
        ctx.close()
    b.close()
print(json.dumps(res,ensure_ascii=False,indent=1))
