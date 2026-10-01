"""Galaxy view screenshots (needs server on :8765)."""
import sys, time, json
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b, ctx, page, logs = launch(p, w=1440, h=900)
    page.add_init_script("window.__noAdapt=true")
    page.goto("http://127.0.0.1:8765/index.html")
    page.wait_for_function("window.__booted===true", timeout=60000)
    time.sleep(2.5)
    page.keyboard.press("5")
    time.sleep(2.0); page.screenshot(path="data/shots/gal_0_intro.png")
    time.sleep(6.5); page.screenshot(path="data/shots/gal_1_top.png")
    page.evaluate("(()=>{const a=window.__app;a.GV.gt=-120;a.GV.vex=25;})()")
    page.click("#gEdge"); time.sleep(2.5); page.screenshot(path="data/shots/gal_2_edge.png")
    page.click("#gDrift"); time.sleep(4.0); page.screenshot(path="data/shots/gal_3_helix.png")
    print(page.evaluate("JSON.stringify(window.__app.GV.info)"))
    print(logs[:5])
    b.close()
