"""One-off patch: galaxy scale buttons, arm strip, Omega_p select (applied once)."""
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
def rd(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()
def wr(p, s): open(os.path.join(ROOT, p), "w", encoding="utf-8").write(s)

h = rd("src/body.html")
a = h.index('<div id="galBar">'); b = h.index('<footer id="dock">')
new = '''<div id="galBar">
  <div class="gbrow"><span class="seg" id="gScales"><button data-s="mw" class="on">Milky Way</button><button data-s="sat">Neighbours</button><button data-s="lg">Local Group</button><button data-s="lan">Laniakea</button></span>
    <button class="chip on" id="gArt" title="Show the NASA/JPL artist concept disc under the model stars">NASA art</button><span class="sep"></span>
    <button class="pbtn" id="gRev" title="Run time backward">⏪</button><button class="pbtn" id="gPlay" title="Play / pause galactic time">▶</button>
    <select class="fld" id="gSpd" aria-label="Galactic playback speed"><option value="5">5 Myr/s</option><option value="20" selected>20 Myr/s</option><option value="60">60 Myr/s</option><option value="150">150 Myr/s</option></select>
    <input type="range" id="gT" min="-650" max="650" step="0.5" value="0" aria-label="Galactic time (Myr from now)"><span id="gTv" class="note" style="margin:0;width:92px;font-family:var(--mono)">now</span>
    <button class="chip" id="gNow">⟲ Now</button></div>
  <div class="gbrow">
    <button class="chip" id="gDrift" title="Add the Galaxy's own motion through space (~560 km/s relative to the CMB): the Sun's path becomes a true helix">Helix through space</button>
    <span class="note" style="margin:0">Drift ×</span><input type="range" id="gDs" min="5" max="100" value="20" aria-label="Drift speed scale"><span id="gDsv" class="note" style="margin:0;width:34px">20%</span>
    <button class="chip" id="gFollow" title="Keep the Sun centred">Follow Sun</button>
    <span class="note" style="margin:0">Vertical ×</span><input type="range" id="gVex" min="1" max="60" value="25" aria-label="Vertical exaggeration"><span id="gVexv" class="note" style="margin:0;width:26px">25</span>
    <button class="chip" id="gTop">Top</button><button class="chip" id="gEdge">Edge-on</button></div>
  <div class="gbrow"><span class="note" style="margin:0" title="The spiral pattern rotates rigidly at the pattern speed; the Sun overtakes or lags it">Arm pattern speed Ωp</span>
    <select class="fld" id="gOmega" aria-label="Spiral pattern speed"><option value="20">20 km/s/kpc (Dias &amp; Lépine 2005)</option><option value="25">25 km/s/kpc</option><option value="28.2" selected>28.2 km/s/kpc (Dias+ 2019)</option><option value="32">32 km/s/kpc</option></select>
    <canvas id="gArms" height="38" title="Times when the Sun is inside a spiral arm (model). Click to jump." style="flex:1;min-width:260px;height:38px;border:1px solid var(--line);border-radius:8px;cursor:pointer;background:rgba(255,255,255,.04)"></canvas></div>
</div>

'''
wr("src/body.html", h[:a] + new + h[b:])

c = rd("src/style.css")
if "#galBar{flex-direction:column" not in c:
    c += '''
#galBar{flex-direction:column;border-radius:16px;padding:8px 14px;gap:6px}#galBar .gbrow{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;width:100%}
.lbl.gal.lg{color:#cfe0ff;font-size:11px;opacity:.95}.lbl.gal.lan{color:#a9c8ff;font-size:11px}
@media (max-width:900px){#galBar{padding:6px 8px}#galBar #gArms{min-width:180px}}
'''
    wr("src/style.css", c)

u = rd("src/js/50_ui.js")
def ru(a, b):
    global u
    assert a in u, a[:70]
    u = u.replace(a, b, 1)
ru("function wire_galaxy() {", '''const ARM_COL = ['#7cc4ff', '#ffd27a', '#ff8fa8', '#a6f0a0'];
function drawArmStrip() {
  const cv = $('gArms'); if (!cv || !GV.ready) return;
  if (GV.crossOmega !== GV.omega) { GV.cross = armCrossings(GV.omega); GV.crossOmega = GV.omega; }
  const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = 38; if (!w) return; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const X = t => (t + GT_MAX) / (2 * GT_MAX) * w;
  g.font = '9px ui-monospace,Consolas,monospace'; g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 14, w, 10);
  for (const s of GV.cross) { g.fillStyle = ARM_COL[s.arm]; g.fillRect(X(s.t0), 12, Math.max(2, X(s.t1) - X(s.t0)), 14); }
  for (const m of MASS_EXT) { g.fillStyle = '#ff6b6b'; g.fillRect(X(-m[0]) - 0.5, 4, 1.5, 8); }
  g.fillStyle = '#7d89a3'; for (const t of [-600, -400, -200, 0, 200, 400, 600]) { g.fillRect(X(t), 28, 1, 4); g.fillText((t > 0 ? '+' : t < 0 ? '\\u2212' : '') + Math.abs(t), X(t) + 3, 37); }
  g.fillStyle = '#ff6b6b'; g.fillText('mass extinctions', 4, 9);
  g.strokeStyle = '#ffb454'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(GV.gt), 0); g.lineTo(X(GV.gt), h); g.stroke();
}
function wire_galaxy() {
  $('gScales').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { galScaleTo(b.dataset.s); $('gScales').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }));
  $('gArt').addEventListener('click', () => { GV.art = !GV.art; $('gArt').classList.toggle('on', GV.art); });
  $('gOmega').addEventListener('change', e => { GV.omega = +e.target.value; drawArmStrip(); });
  $('gArms').addEventListener('click', e => { const r = e.target.getBoundingClientRect(); GV.gt = ((e.clientX - r.left) / r.width * 2 - 1) * GT_MAX; GV.playing = false; syncGalUI(); });
  $('gArms').addEventListener('mousemove', e => {
    const r = e.target.getBoundingClientRect(), t = ((e.clientX - r.left) / r.width * 2 - 1) * GT_MAX; let txt = (t < 0 ? Math.abs(t).toFixed(0) + ' Myr ago' : '+' + t.toFixed(0) + ' Myr');
    const s = (GV.cross || []).find(q => t >= q.t0 && t <= q.t1); if (s) txt += ` · inside the ${ARMS[s.arm].name} (${Math.round(s.t0)}…${Math.round(s.t1)})`;
    const me = MASS_EXT.find(m => Math.abs(-m[0] - t) < 6); if (me) txt += ` · ${me[1]} extinction`; e.target.title = txt;
  });''')
ru("  const s = GV.sun; if (!s) return; syncGalUI();", "  const s = GV.sun; if (!s) return; syncGalUI(); drawArmStrip();")
ru("    + `One galactic year ≈ 223 Myr", "    + `${(() => { const n = nearestArm(gt, GV.omega); return n.inside ? `<b>Inside the ${ARMS[n.arm].name}</b> (model, Ωp ${GV.omega})` : `Between arms — nearest: ${ARMS[n.arm].name}, ${Math.abs(n.dist).toFixed(1)} kpc away (model, Ωp ${GV.omega})`; })()}<br>`\n    + `One galactic year ≈ 223 Myr")
wr("src/js/50_ui.js", u)
print("patched")
