import sys, time
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright
HIDE = "#topbar,#timebar,.panel,#dock,#galBar,#galInfo,#banner,#toast,#mobnav,#guide,#hud{display:none!important}"
with sync_playwright() as p:
    b, ctx, page, logs = launch(p, w=1400, h=800)
    page.add_init_script("window.__noAdapt=true")
    page.goto("http://127.0.0.1:8765/index.html"); page.wait_for_function("window.__booted===true", timeout=60000); time.sleep(2.5)
    page.add_style_tag(content=HIDE)
    page.keyboard.press("5"); time.sleep(8)
    page.evaluate("(()=>{const a=window.__app;a.S.tg.labels=false;a.GV.tween=null;a.GV.yaw=0.5;a.GV.pitch=0.03;a.GV.dist=34;a.GV.tx=0;a.GV.ty=0;a.GV.tz=0;a.GV.art=true;})()"); time.sleep(1.2)
    page.screenshot(path="data/shots/mw_edge.png")
    page.evaluate("(()=>{const a=window.__app;a.GV.pitch=0.5;})()"); time.sleep(1.0); page.screenshot(path="data/shots/mw_oblique.png")
    page.evaluate("(()=>{const a=window.__app;a.GV.pitch=0.03;a.GV.dist=10;})()"); time.sleep(1.0); page.screenshot(path="data/shots/mw_edge_close.png")
    page.evaluate("(()=>{window.__app.galScaleTo('lg',10);})()"); time.sleep(2.0)
    page.evaluate("(()=>{const a=window.__app;a.GV.tween=null;a.GV.pitch=0.2;a.GV.dist=110;const m=a.FAR.m31;a.GV.tx=m.x;a.GV.ty=m.y;a.GV.tz=m.z;a.S.tg.labels=false;})()"); time.sleep(1.5); page.screenshot(path="data/shots/m31_3d.png")
    page.evaluate("(()=>{const a=window.__app;a.GV.dist=45;a.GV.pitch=0.7;})()"); time.sleep(1.2); page.screenshot(path="data/shots/m31_3d_close.png")
    page.evaluate("(()=>{window.__app.galScaleTo('near',10);})()"); time.sleep(2.5); page.screenshot(path="data/shots/near.png")
    print(logs[:5]); b.close()
