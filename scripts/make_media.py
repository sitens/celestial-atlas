"""Screenshots for README / OG image (needs the server on :8765)."""
import sys, time
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
HIDE = "#topbar,#timebar,.panel,#dock,#banner,#rangeWarn,#skyBar,#skyInfo,#toast,#mobnav{display:none!important}"
with sync_playwright() as p:
    b, ctx, page, logs = launch(p, w=1440, h=900)
    page.add_init_script("window.__noAdapt=true")
    page.goto("http://127.0.0.1:8765/index.html"); page.wait_for_function("window.__booted===true", timeout=60000); time.sleep(3)
    page.evaluate("(()=>{const a=window.__app;a.setLocation({name:'New York, NY, USA',lat:40.7128,lon:-74.006,elev:10,tz:'America/New_York'},{silent:true});a.setTime(Date.UTC(2026,9,1,17,0,0));a.setView('planet');a.focusBody('Earth',{dur:10});})()"); time.sleep(3.5)
    page.screenshot(path="docs/earth.png")
    page.add_style_tag(content=HIDE)
    page.set_viewport_size({"width": 1200, "height": 630}); time.sleep(1.2)
    page.evaluate("(()=>{const a=window.__app;a.flyTo({focus:'Earth',dist:a.rVis?0:a.OB.Earth.vr*3.4,pitch:0.28,yaw:a.CAM.yaw,dur:10});})()"); time.sleep(2.5)
    page.screenshot(path="docs/og_raw.png")
    page.set_viewport_size({"width": 1440, "height": 900})
    page.evaluate("(()=>{const a=window.__app;a.applyPreset('e2024');})()"); time.sleep(3.5)
    page.screenshot(path="docs/eclipse.png")
    page.evaluate("(()=>{const a=window.__app;a.setView('planet');a.setLocation({name:'New York, NY, USA',lat:40.7128,lon:-74.006,elev:10,tz:'America/New_York'},{silent:true});a.setTime(Date.UTC(2026,9,1,17,0,0));a.selectBody('Saturn');a.focusBody('Saturn',{dur:10});})()"); time.sleep(3.5)
    page.screenshot(path="docs/saturn.png")
    b.close()
im = Image.open("docs/og_raw.png").convert("RGB").resize((1200, 630))
ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
for x in range(0, 760):  # left-to-right dark gradient for legibility
    d.line([(x, 0), (x, 630)], fill=(3, 5, 10, int(215 * (1 - x / 760) ** 1.2)))
im = Image.alpha_composite(im.convert("RGBA"), ov)
d = ImageDraw.Draw(im)
def font(names, size):
    for n in names:
        try: return ImageFont.truetype(n, size)
        except Exception: pass
    return ImageFont.load_default()
serif = font(["C:/Windows/Fonts/georgiai.ttf", "C:/Windows/Fonts/georgia.ttf"], 78)
sans = font(["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"], 30)
small = font(["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"], 24)
d.rectangle([0, 0, 1200, 4], fill=(106, 209, 255, 255))
d.text((64, 170), "Celestial Atlas", font=serif, fill=(233, 238, 248, 255))
d.text((68, 280), "Earth & the Solar System", font=sans, fill=(205, 214, 232, 255))
d.text((68, 322), "any place, any date (1000–3000 CE)", font=sans, fill=(205, 214, 232, 255))
d.text((68, 384), "Real planet & moon positions", font=small, fill=(139, 151, 174, 255))
d.text((68, 418), "Exact eclipse shadows · sky view · weather", font=small, fill=(139, 151, 174, 255))
d.text((68, 548), "siten.ai/atlas", font=small, fill=(255, 180, 84, 255))
im.convert("RGB").save("docs/og.png")
import os; os.remove("docs/og_raw.png"); print("ok")
