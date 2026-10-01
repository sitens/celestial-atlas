import sys, time, json
sys.path.insert(0, "scripts")
from pw import launch
from playwright.sync_api import sync_playwright
OUT = "data/shots/"
def run(steps, w=1440, h=900, dpr=1):
    with sync_playwright() as p:
        b, ctx, page, logs = launch(p, w=w, h=h, dpr=dpr)
        page.goto("http://127.0.0.1:8765/index.html")
        page.wait_for_function("window.__booted===true", timeout=60000)
        time.sleep(2.5)
        for name, js, wait in steps:
            if js: 
                r = page.evaluate(js)
                if r is not None: print(name, "->", r)
            time.sleep(wait)
            if name: page.screenshot(path=OUT + name + ".png")
        print("PROF", json.dumps(page.evaluate("window.__prof()")), json.dumps(page.evaluate("window.__parts")), json.dumps(page.evaluate("window.__parts2()")))
        print("LOGS:", "\n".join(logs[:40]))
        b.close()
if __name__ == "__main__":
    steps = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else []
    run(steps)
