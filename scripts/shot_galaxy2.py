import sys, time
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b, ctx, page, logs = launch(p, w=1440, h=900)
    page.add_init_script("window.__noAdapt=true")
    page.goto("http://127.0.0.1:8765/index.html"); page.wait_for_function("window.__booted===true", timeout=60000); time.sleep(2.5)
    page.keyboard.press("5"); time.sleep(8); page.screenshot(path="data/shots/g2_mw.png")
    page.click('#gScales [data-s="sat"]'); time.sleep(4.5); page.screenshot(path="data/shots/g2_sat.png")
    page.click('#gScales [data-s="lg"]'); time.sleep(4.5); page.screenshot(path="data/shots/g2_lg.png")
    page.click('#gScales [data-s="lan"]'); time.sleep(4.5); page.screenshot(path="data/shots/g2_lan.png")
    print(logs[:6]); b.close()
