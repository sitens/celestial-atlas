import sys, time
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b, ctx, page, logs = launch(p, w=1440, h=900)
    page.add_init_script("window.__noAdapt=true")
    page.goto("http://127.0.0.1:8765/index.html")
    page.wait_for_function("window.__booted===true", timeout=60000)
    time.sleep(2)
    page.evaluate("window.__app.TL.span = 500*365.2425*86400000")
    for i in range(6):
        time.sleep(0.5)
        print(i, page.evaluate("JSON.stringify({n:window.__app.TL.events.length,busy:window.__app.TL.busy,pending:window.__app.TL.pending,cover:!!window.__app.TL.cover,ecl:window.__app.ECL_LIST.length})"))
    print(logs[:5])
    b.close()
