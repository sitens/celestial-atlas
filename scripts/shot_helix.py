import sys, time
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b, ctx, page, logs = launch(p, w=1440, h=900)
    page.add_init_script("window.__noAdapt=true")
    page.goto("http://127.0.0.1:8765/index.html"); page.wait_for_function("window.__booted===true", timeout=60000); time.sleep(2.5)
    # 1. Moon-orbit bug: overview with orbits on
    page.evaluate("(()=>{const a=window.__app;a.S.tg.labels=true;a.setView('system');a.flyTo({focus:'Sun',dist:60,pitch:1.25,yaw:0.4,dur:10});})()"); time.sleep(2.5)
    page.screenshot(path="data/shots/moonfix_overview.png")
    page.evaluate("(()=>{const a=window.__app;a.flyTo({focus:'Earth',dist:6,pitch:0.9,yaw:0.4,dur:10});})()"); time.sleep(2.0)
    page.screenshot(path="data/shots/moonfix_earth.png")
    # 2. Helix
    page.evaluate("(()=>{const a=window.__app;a.setHelix(true);})()"); time.sleep(4.5)
    page.screenshot(path="data/shots/helix_1.png")
    page.evaluate("(()=>{const a=window.__app;a.flyTo({focus:'Sun',dist:70,pitch:0.25,yaw:a.CAM.yaw,dur:10});})()"); time.sleep(2)
    page.screenshot(path="data/shots/helix_2.png")
    print(page.evaluate("JSON.stringify({sp:window.__app.SPREAD, on:window.__app.HX.on, l:window.__app.HX.l, b:window.__app.HX.b, v:window.__app.HX.speedKms, prof:window.__prof()})"))
    print(logs[:5]); b.close()
