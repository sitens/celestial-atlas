"""UI overhaul check: desktop + mobile screenshots of each view, popovers, guide, compare. Prints console errors."""
import sys, time
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright

def run(w, h, tag, p):
    b, ctx, page, logs = launch(p, w=w, h=h)
    page.add_init_script("window.__noAdapt=true")
    page.goto("http://127.0.0.1:8765/index.html"); page.wait_for_function("window.__booted===true", timeout=60000); time.sleep(3)
    S = lambda n: page.screenshot(path=f"data/shots/ui_{tag}_{n}.png")
    S("1_system")
    if w < 500:
        page.click("#gdMin"); time.sleep(.4); S("1b_guide_open"); page.click("#gdMin")
    page.click("#clockPill"); time.sleep(.4); S("2_timepop"); page.click("[data-closepop]")
    page.click("#btnOpt"); time.sleep(.4); S("3_options"); page.keyboard.press("Escape")
    page.click("#btnMenu"); time.sleep(.4); S("4_menu"); page.keyboard.press("Escape")
    # guide text
    print(tag, "guide system:", page.evaluate("document.getElementById('gdText').innerText.slice(0,160)"))
    page.click("#btnGuide"); time.sleep(.3); page.click("#btnGuide"); time.sleep(.6)
    # helix + compare
    page.evaluate("window.__app.setHelix(true)"); time.sleep(4)
    S("5_helix")
    page.click("#hxCmp"); time.sleep(2); S("6_compare")
    print(tag, "cmp:", page.evaluate("document.body.classList.contains('cmp')"))
    page.click("#hxCmp"); time.sleep(.5)
    # views
    for v in ["earthmoon", "planet", "sky", "galaxy"]:
        page.click(f".vbtn[data-v={v}]"); time.sleep(5 if v == "galaxy" else 2.5); S("7_" + v)
        print(tag, v, "title:", page.evaluate("document.getElementById('gdTitle').textContent"), "| view:", page.evaluate("document.body.dataset.view"))
    # galaxy scales
    for s in ["near", "sat", "lg", "lan", "mw"]:
        page.click(f"#gScales button[data-s={s}]"); time.sleep(5 if s in ("lg", "lan") else 4); S("8_gal_" + s)
        print(tag, s, "title:", page.evaluate("document.getElementById('gdTitle').textContent"), "| on:", page.evaluate("[...document.querySelectorAll('#gScales button.on')].map(b=>b.dataset.s).join()"))
    # transport in galaxy
    page.click("#btnPlay"); time.sleep(1.2); print(tag, "gal playing:", page.evaluate("window.__app.GV.playing"), "gt", page.evaluate("window.__app.GV.gt"))
    page.click("#btnPlay")
    # tooltip
    page.mouse.move(5, 300); time.sleep(.3); page.hover("#btnPlay"); time.sleep(1); S("9_tooltip")
    print(tag, "tooltip:", page.evaluate("document.getElementById('tt').innerText"))
    errs = [l for l in logs if "[error]" in l or "pageerror" in l or "[warning]" in l and "guide" in l]
    print(tag, "ERRORS:", errs[:10]); b.close()

with sync_playwright() as p:
    run(1440, 900, "d", p)
    run(390, 844, "m", p)
