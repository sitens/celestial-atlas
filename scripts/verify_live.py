"""Smoke test of the deployed app (CSP, CDN libs, Open-Meteo, geolocation policy) + home page links."""
import sys, time, json
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "https://siten.ai"
res = []
def ok(n, c, i=""):
    res.append(bool(c)); print(("PASS " if c else "FAIL ") + n + ((" - " + str(i)) if i != "" else ""), flush=True)
with sync_playwright() as p:
    b, ctx, page, logs = launch(p, w=1440, h=900)
    page.goto(BASE + "/atlas/"); page.wait_for_function("window.__booted===true", timeout=90000); time.sleep(3)
    bad = [l for l in logs if l.startswith("[error]") or l.startswith("[pageerror]") or "Content Security Policy" in l or "Refused" in l]
    ok("atlas boots on siten.ai with no console/CSP errors", not bad, bad[:3])
    ok("atlas: WebGL2 + log depth + bloom pipeline", page.evaluate("window.__app.renderer.capabilities.isWebGL2 && window.__app.POST.ok"))
    page.fill("#q", "Tokyo"); page.wait_for_selector("#sugg div[data-i]", timeout=20000); page.locator("#sugg div[data-i]").first.click(); time.sleep(1)
    page.wait_for_function("document.querySelector('#wxBody').innerText.includes('Humidity')", timeout=30000)
    ok("atlas: geocode + weather via Open-Meteo allowed by CSP", "Tokyo" in page.evaluate("window.__app.S.loc.name"))
    page.wait_for_function("window.__app.CLOUD.target===1", timeout=40000)
    ok("atlas: live cloud grid fetched", True, page.evaluate("document.getElementById('cloudNote').innerText"))
    page.evaluate("window.__app.setView('sky',{reaim:true})"); time.sleep(2); page.screenshot(path="data/shots/live_atlas.png")
    page.evaluate("window.__app.setScale(false); window.__app.setView('system'); window.__app.setHelix(true)"); time.sleep(4)
    ok("atlas: helix of planets behind the Sun", page.evaluate("window.__app.HX.group.visible && Object.keys(window.__app.HX.lines).length===10"))
    page.evaluate("window.__app.setHelix(false,{noFly:true}); window.__app.setView('galaxy')"); time.sleep(7)
    page.click('#gScales [data-s="lan"]'); time.sleep(4)
    ok("atlas: Laniakea view", page.evaluate("window.__app.FAR.lan.visible"))
    page.screenshot(path="data/shots/live_laniakea.png")
    page.click('#gScales [data-s="merge"]'); [time.sleep(0.5) for _ in range(180) if not page.evaluate("window.__app.MG.ready")]; page.click("#mgFinal"); time.sleep(3)
    ok("atlas: Milky Way-Andromeda collision simulates and reaches the merged final state", page.evaluate("window.__app.MG.ready && window.__app.MG.info.sep < 3 && window.__app.GV.mt > 9000"), page.evaluate("document.getElementById('gdTitle').innerText"))
    page.screenshot(path="data/shots/live_collision.png")
    page.evaluate("window.__app.setView('system')"); time.sleep(2.5); page.click("#btnLife"); time.sleep(1.5); page.evaluate("window.__app.LIFE.u=0.62"); time.sleep(1.2)
    ok("atlas: life of the Sun (red giant)", page.evaluate("window.__app.LIFE.on && document.getElementById('lifeA').innerText.includes('Red giant')"))
    page.screenshot(path="data/shots/live_sunlife.png"); page.click("#lifeExit")
    ok("atlas: sky view renders", page.evaluate("window.__app.SKY.info.sunAlt!==undefined"))
    ok("page title/canonical", "Celestial Atlas" in page.title() and page.evaluate("document.querySelector('link[rel=canonical]').href") == "https://siten.ai/atlas/")
    pg = ctx.new_page(); lg = []; pg.on("console", lambda m: lg.append(m.text))
    pg.goto(BASE + "/"); pg.evaluate("sessionStorage.setItem('hasLoaded','1')"); pg.reload(); time.sleep(4)
    links = pg.evaluate("[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')).filter(h=>h&&h.includes('atlas'))")
    ok("home page: navbar links to /atlas/", "/atlas/" in links, links)
    txt = pg.evaluate("document.getElementById('projects')?.innerText||''")
    ok("home page: Projects section lists Celestial Atlas", "Celestial Atlas" in txt, txt[:90].replace("\n", " | "))
    pg.evaluate("document.getElementById('projects').scrollIntoView()"); time.sleep(1.5); pg.screenshot(path="data/shots/live_projects.png")
    pg.set_viewport_size({"width": 390, "height": 844}); pg.evaluate("window.scrollTo(0,0)"); time.sleep(1); pg.screenshot(path="data/shots/live_home_mobile.png")
    ok("home mobile: no horizontal overflow", pg.evaluate("document.scrollingElement.scrollWidth") <= 392, pg.evaluate("document.scrollingElement.scrollWidth"))
    b.close()
print(sum(res), "/", len(res))
