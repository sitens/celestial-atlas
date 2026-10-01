"""Terminator close-up over the Himalaya (normal-map relief check)."""
import sys, time
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b, ctx, page, logs = launch(p, w=1440, h=900)
    page.add_init_script("window.__noAdapt=true")
    page.goto("http://127.0.0.1:8765/index.html")
    page.wait_for_function("window.__booted===true", timeout=60000)
    time.sleep(3)
    page.evaluate("(()=>{const a=window.__app;a.setLocation({name:'Kathmandu, Nepal',lat:27.7,lon:85.3,elev:1400,tz:'Asia/Kathmandu'},{silent:true});a.setTime(Date.UTC(2026,9,1,0,10,0));a.setView('planet');a.focusBody('Earth',{dur:10});})()")
    time.sleep(2)
    page.evaluate("window.__app.flyToLocation()")
    time.sleep(3.5)
    page.evaluate("(()=>{const a=window.__app;a.S.tg.labels=false;a.flyTo({focus:'Earth',dist:a.rVis('Earth')*2.1,pitch:0.55,yaw:a.CAM.yaw+0.75,dur:10});})()")
    time.sleep(2.5)
    page.screenshot(path="data/shots/relief.png")
    print(logs[:3])
    b.close()
