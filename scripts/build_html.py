"""Assemble site/index.html from src/ (template + css + body + assets + js modules)."""
import os, glob
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
def rd(p):
    with open(os.path.join(ROOT, p), encoding="utf-8", newline="") as f:
        return f.read().replace("\r\n", "\n")
tpl = rd("src/template.html")
js = rd("src/assets.js") + "\n" + rd("src/eclipses.js") + "\n" + "\n".join(rd(p) for p in sorted(os.path.relpath(x, ROOT).replace("\\", "/") for x in glob.glob(os.path.join(ROOT, "src/js/*.js"))))
html = tpl.replace("/*__CSS__*/", rd("src/style.css")).replace("<!--__BODY__-->", rd("src/body.html")).replace("/*__JS__*/", js)
out = os.path.join(ROOT, "site", "index.html")
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8", newline="\n") as f:
    f.write(html)
print(f"wrote {out}: {os.path.getsize(out)/1024/1024:.2f} MB")
