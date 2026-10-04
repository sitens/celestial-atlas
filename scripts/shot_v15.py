import sys, time
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright
def run(w, h, tag, p):
    b, ctx, page, logs = launch(p, w=w, h=h)
    page.add_init_script("window.__noAdapt=true")
    page.goto("http://127.0.0.1:8765/index.html"); page.wait_for_function("window.__booted===true", timeout=60000); time.sleep(3)
    S = lambda n: page.screenshot(path=f"data/shots/v15_{tag}_{n}.png")
    ev = lambda js: page.evaluate(js)
    # collision
    ev("window.__app.setView('galaxy',{noIntro:true})"); time.sleep(3)
    t0 = time.time(); page.click('#gScales button[data-s="merge"]')
    page.wait_for_function("window.__app.MG.ready", timeout=90000); print(tag, "merge build s", round(time.time() - t0, 1))
    time.sleep(2.5); S("1_merge_now")
    for name, sel in [("2_first", "#mgFirst"), ("3_second", "#mgSecond"), ("4_merged", "#mgMerged"), ("5_final", "#mgFinal")]:
        page.click(sel); time.sleep(3.5); S(name)
        print(tag, name, ev("document.getElementById('gdText').innerText.slice(0,200)").replace("\n", " "), "| catching", ev("window.__app.MG.catching"))
    page.click("#btnPlay"); time.sleep(0.5); page.click("#btnRev"); time.sleep(2); print(tag, "reverse gt", ev("window.__app.GV.mt")); page.click("#btnPlay")
    # pan
    ev("window.__app.GV.tx=0"); x0 = ev("window.__app.GV.tx"); page.click("#btnPan"); page.mouse.move(w/2, h/2); page.mouse.down(); page.mouse.move(w/2+120, h/2+40, steps=6); page.mouse.up(); print(tag, "pan dx", x0, ev("window.__app.GV.tx"))
    page.click("#btnPan")
    # life
    ev("window.__app.setView('system')"); time.sleep(2.5)
    page.click("#btnLife"); time.sleep(2.5); S("6_life_today")
    for name, u in [("7_life_1gyr", 0.217), ("8_life_rgb", 0.6), ("9_life_tip", 0.64), ("10_life_pn", 0.84), ("11_life_wd", 0.95)]:
        ev(f"window.__app.LIFE.u={u}"); time.sleep(1.5); S(name)
        print(tag, name, ev("document.getElementById('lifeA').innerText"), "|", ev("document.getElementById('lifeB').innerText").replace("\n", " ")[:150])
    # gaia dense + gould belt
    ev("window.__app.setView('galaxy')"); time.sleep(2)
    page.click('#gScales button[data-s="near"]'); time.sleep(4.5); S("12_near")
    ev("window.__app.GV.tween=null; window.__app.GV.dist=0.07"); time.sleep(1.5); S("13_near_dense")
    ev("window.__app.GV.dist=0.9"); time.sleep(1.5); S("14_gould")
    # hubble card
    page.click('#gScales button[data-s="hub"]'); time.sleep(5); S("15_hub")
    el = page.locator(".lbl.hubble").first
    print(tag, "hubble labels", page.locator(".lbl.hubble").count())
    ev("document.querySelector('.lbl.hubble') && document.querySelector('.lbl.hubble').click()"); time.sleep(1); S("16_hubble_card")
    print(tag, "card open", ev("document.getElementById('mHubble').classList.contains('open')"), ev("document.getElementById('hbTitle').textContent"))
    page.keyboard.press("Escape")
    # galaxy compare
    page.click('#gScales button[data-s="mw"]'); time.sleep(3.5)
    ev("document.getElementById('gCmp').click()"); time.sleep(4); S("17_gal_compare")
    print(tag, "cmp", ev("document.body.classList.contains('cmp')"), ev("window.__app.S.cmp"))
    ev("document.getElementById('gCmp').click()"); time.sleep(1)
    errs = [l for l in logs if "[error]" in l or "pageerror" in l]
    print(tag, "ERRORS", errs[:8]); b.close()
with sync_playwright() as p:
    if len(sys.argv) < 2 or sys.argv[1] != "m": run(1440, 900, "d", p)
    if len(sys.argv) > 1: run(390, 844, "m", p)
