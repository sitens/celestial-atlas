import sys, time
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b, ctx, page, logs = launch(p, w=1200, h=900)
    page.add_init_script("window.__noAdapt=true")
    page.goto("http://127.0.0.1:8765/index.html"); page.wait_for_function("window.__booted===true", timeout=60000); time.sleep(2.5)
    page.add_style_tag(content="#topbar,#timebar,.panel,#dock,#galBar,#galInfo,#banner,#toast{display:none!important}")
    page.keyboard.press("5"); time.sleep(8.5)
    page.evaluate("(()=>{const a=window.__app;a.S.tg.labels=false;a.GV.tween=null;a.GV.yaw=0;a.GV.pitch=1.5707;a.GV.dist=36;a.GV.tx=0;a.GV.ty=0;a.GV.tz=0;a.GV.art=false;})()"); time.sleep(1.0)
    page.screenshot(path="data/shots/art_model.png")
    page.evaluate("(()=>{const a=window.__app;a.GV.art=true;})()"); time.sleep(0.8)
    page.screenshot(path="data/shots/art_both.png")
    b.close()
