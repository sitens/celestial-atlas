"""Playwright helper: launch local Chrome, load the app, return page. Used by verification scripts."""
import sys, json, time
from playwright.sync_api import sync_playwright

def launch(p, headless=True, w=1440, h=900, dpr=1, gpu=True):
    args = ["--ignore-gpu-blocklist", "--enable-webgl", "--enable-unsafe-swiftshader"]
    if gpu: args += ["--use-angle=d3d11"]
    b = p.chromium.launch(channel="chrome", headless=headless, args=args)
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr, ignore_https_errors=True)
    page = ctx.new_page()
    logs = []
    page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    return b, ctx, page, logs

if __name__ == "__main__":
    with sync_playwright() as p:
        b, ctx, page, logs = launch(p)
        page.goto("http://127.0.0.1:8765/index.html")
        page.wait_for_function("window.__booted===true", timeout=60000)
        time.sleep(3)
        print(page.evaluate("""()=>{const gl=document.createElement('canvas').getContext('webgl2');const e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL)}"""))
        print(json.dumps(page.evaluate("window.__prof()")))
        page.screenshot(path="data/shots/boot.png")
        print("\n".join(logs[:30]))
        b.close()
