// ===================== 60_main.js — camera, input, time engine, views, tour, render loop =====================
const CAM = { yaw: 0.55, pitch: 0.5, dist: 170, offset: [0, 0, 0], focus: 'Sun', from: null, tween: null, blend: 1 };
let ST = null; // latest ephemeris state
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const wrapPi = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
function camLimits() { const r = rVis(CAM.focus); return { min: r * 1.06, max: S.trueScale ? 2e9 : 900 }; }

// ---------- camera control ----------
function focusWorld() { return ST ? worldPos(CAM.focus, ST) : [0, 0, 0]; }
function flyTo(o) {
  const now = performance.now(), cur = currentTarget();
  CAM.from = cur; CAM.blend = 0;
  const changed = o.focus && o.focus !== CAM.focus;
  if (o.focus) CAM.focus = o.focus;
  if (!o.keepOffset) CAM.offset = [0, 0, 0];
  const lim = camLimits();
  CAM.tween = { t0: now, dur: o.dur || 1600, y0: CAM.yaw, p0: CAM.pitch, d0: CAM.dist, y1: o.yaw != null ? CAM.yaw + wrapPi(o.yaw - CAM.yaw) : CAM.yaw, p1: o.pitch != null ? o.pitch : CAM.pitch, d1: clamp(o.dist != null ? o.dist : CAM.dist, lim.min, lim.max) };
  if (o.dur === 0) { CAM.tween.dur = 1; }
}
let _tgt = [0, 0, 0];
function currentTarget() { return _tgt.slice(); }
function stepCamera(now) {
  const fw = focusWorld(), goal = [fw[0] + CAM.offset[0], fw[1] + CAM.offset[1], fw[2] + CAM.offset[2]];
  const tw = CAM.tween;
  if (tw) {
    const k = clamp((now - tw.t0) / tw.dur, 0, 1), e = ease(k);
    CAM.yaw = tw.y0 + (tw.y1 - tw.y0) * e; CAM.pitch = tw.p0 + (tw.p1 - tw.p0) * e; CAM.dist = tw.d0 * Math.pow(tw.d1 / tw.d0, e);
    CAM.blend = e; if (k >= 1) { CAM.tween = null; CAM.blend = 1; }
  }
  const e = CAM.blend;
  _tgt = CAM.from && e < 1 ? [CAM.from[0] + (goal[0] - CAM.from[0]) * e, CAM.from[1] + (goal[1] - CAM.from[1]) * e, CAM.from[2] + (goal[2] - CAM.from[2]) * e] : goal;
  const lim = camLimits(); CAM.dist = clamp(CAM.dist, lim.min, lim.max);
  const cp = Math.cos(CAM.pitch), d = CAM.dist;
  camera.position.set(Math.sin(CAM.yaw) * cp * d, Math.sin(CAM.pitch) * d, Math.cos(CAM.yaw) * cp * d);
  camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
  camera.near = Math.max(d * 0.0015, 1e-5); camera.far = 1e11; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  return _tgt;
}

// ---------- input ----------
const ptrs = new Map(); let dragInfo = null, pinch0 = null;
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragInfo = { x: e.clientX, y: e.clientY, moved: 0, pan: e.shiftKey || e.button === 2 || e.button === 1 };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: S.view === 'galaxy' ? GV.dist : CAM.dist, fov: SKY.fov }; }
  tourCancel(); CAM.tween = null; CAM.blend = 1;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (!p) { hoverMove(e); return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2 && pinch0) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = pinch0.d / Math.max(1, d);
    if (S.view === 'sky') SKY.fov = clamp(pinch0.fov * r, 2, 110); else if (S.view === 'galaxy') { GV.tween = null; GV.dist = clamp(pinch0.dist * r, 0.0004, 900); } else CAM.dist = pinch0.dist * r; return;
  }
  dragInfo.moved += Math.abs(dx) + Math.abs(dy);
  if (S.view === 'galaxy') {
    GV.tween = null; GV.yaw -= dx * 0.0052; GV.pitch = clamp(GV.pitch + dy * 0.0052, -1.52, 1.52);
  } else if (S.view === 'sky') {
    const dpp = SKY.fov / renderer.domElement.clientHeight;
    SKY.az = (SKY.az - dx * dpp + 360) % 360; SKY.alt = clamp(SKY.alt + dy * dpp, -89, 89);
  } else if (dragInfo.pan || e.shiftKey) {
    const k = CAM.dist * 0.0016, right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    CAM.offset[0] += (-right.x * dx + up.x * dy) * k; CAM.offset[1] += (-right.y * dx + up.y * dy) * k; CAM.offset[2] += (-right.z * dx + up.z * dy) * k;
  } else { CAM.yaw -= dx * 0.0052; CAM.pitch = clamp(CAM.pitch + dy * 0.0052, -1.52, 1.52); }
});
canvas.addEventListener('pointerup', e => {
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null;
  if (dragInfo && dragInfo.moved < 5 && S.view !== 'sky' && S.view !== 'galaxy') { const id = pickBody(e.clientX, e.clientY); if (id) selectBody(id); }
  if (ptrs.size === 0) dragInfo = null;
});
canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch0 = null; });
canvas.addEventListener('dblclick', e => { if (S.view === 'sky' || S.view === 'galaxy') return; const id = pickBody(e.clientX, e.clientY); if (id) { selectBody(id); focusBody(id); } });
canvas.addEventListener('wheel', e => {
  e.preventDefault(); tourCancel();
  const k = Math.exp(clamp(e.deltaY, -300, 300) * 0.0011);
  if (S.view === 'galaxy') { GV.tween = null; GV.dist = clamp(GV.dist * k, 0.0004, 900); } else if (S.view === 'sky') SKY.fov = clamp(SKY.fov * k, 2, 110); else { CAM.tween = null; CAM.blend = 1; CAM.dist = clamp(CAM.dist * k, camLimits().min, camLimits().max); }
  syncFov();
}, { passive: false });
function pickBody(cx, cy) {
  const r = canvas.getBoundingClientRect(), x = cx - r.left, y = cy - r.top; let best = null, bd = 1e9;
  for (const id in OB) {
    const o = OB[id]; if (!o.onscreen) continue; if (BODY[id].parent && !o.mesh.visible) continue;
    const dd = Math.hypot(o.sx - x, o.sy - y), rad = Math.max(o.px, 13) + 4;
    if (dd < rad) { const sc = dd / rad + (BODY[id].parent ? 0 : 0.05); if (sc < bd) { bd = sc; best = id; } }
  }
  return best;
}
const tip = document.createElement('div'); tip.id = 'tip'; tip.style.cssText = 'position:fixed;z-index:25;pointer-events:none;background:#0b1020e0;border:1px solid #fff2;border-radius:8px;padding:5px 9px;font-size:11.5px;display:none;white-space:nowrap'; document.body.appendChild(tip);
function hoverMove(e) {
  if (S.view === 'sky' || S.view === 'galaxy' || !ST) { tip.style.display = 'none'; return; }
  const id = pickBody(e.clientX, e.clientY);
  if (!id) { tip.style.display = 'none'; canvas.style.cursor = 'grab'; return; }
  canvas.style.cursor = 'pointer';
  const dEarth = id === 'Earth' ? 0 : v3.len(v3.sub(ST.pos[id], ST.pos.Earth)), dSun = v3.len(ST.pos[id]);
  tip.innerHTML = `<b>${id}</b> · ${dSun / AU_KM < 0.001 ? '' : (dSun / AU_KM).toFixed(3) + ' AU from Sun'}${id === 'Earth' ? '' : '<br><span style="color:#8b97ae">' + fmtKm(dEarth) + ' from Earth</span>'}`;
  tip.style.display = 'block'; tip.style.left = Math.min(innerWidth - 220, e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
}
function fmtKm(km) { return km > 1.5e7 ? (km / AU_KM).toFixed(3) + ' AU' : Math.round(km).toLocaleString() + ' km'; }
function syncFov() { const f = $('fov'); if (f) { f.value = SKY.fov; $('fovV').textContent = SKY.fov.toFixed(0) + '°'; } }

// ---------- selection / views ----------
function selectBody(id) { S.selected = id; if (typeof uiSelect === 'function') uiSelect(id); }
function litView(id, rot = 0.65) { // camera direction that sees the sunlit side of a body
  const p = ST ? ST.pos[id] : [1, 0, 0], d = v3.norm(v3.mul(p, -1));
  return { yaw: Math.atan2(d[0], d[2]) + rot, pitch: clamp(Math.asin(clamp(d[1], -1, 1)) * 0.3 + 0.28, -0.6, 0.8) };
}
function focusBody(id, opts = {}) {
  const o = OB[id], d = BODY[id], hasMoons = !!MOONS_OF[id];
  let k = d.id === 'Sun' ? 4 : hasMoons ? (id === 'Earth' ? 9 : 10) : (d.parent ? 6 : 5);
  if (id === 'Saturn') k = 12;
  if (id === 'Moon') k = 6;
  const lv = litView(id, id === 'Sun' ? 0 : 0.65);
  flyTo(Object.assign({ focus: id, dist: rVis(id) * k, pitch: id === 'Saturn' ? Math.max(0.35, lv.pitch) : lv.pitch, yaw: lv.yaw, dur: 1700 }, opts));
  if (S.view === 'sky') setView('planet', { noFly: true });
  else { S.view = 'planet'; markView(); }
}
function markView() { document.querySelectorAll('.vbtn[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === S.view)); document.body.classList.toggle('galaxy', S.view === 'galaxy'); updateSkyUI(); }
function updateSkyUI() { if ($('hxBar')) $('hxBar').style.display = HX.on && S.view !== 'sky' && S.view !== 'galaxy' ? 'flex' : 'none'; const gal = S.view === 'galaxy'; $('galBar').style.display = gal ? 'flex' : 'none'; $('galInfo').style.display = gal ? 'block' : 'none'; const sky = S.view === 'sky'; $('skyBar').style.display = sky ? 'flex' : 'none'; $('skyInfo').style.display = sky ? 'block' : 'none'; }
function setScale(tr, keepCam) {
  if (S.trueScale === tr) return;
  const r0 = rVis(CAM.focus); S.trueScale = tr; const r1 = rVis(CAM.focus);
  CAM.dist *= r1 / r0; CAM.offset = [0, 0, 0]; CAM.tween = null; CAM.blend = 1; CAM.from = null; trailAnchor = null;
  for (const k in ORB) ORB[k].ref = -1e18;
  const chip = document.querySelector('[data-tg="trueScale"]'); if (chip) chip.classList.toggle('on', tr);
}
function setView(v, opts = {}) {
  tourCancel();
  if (v === 'galaxy') { enterGalaxy({ intro: !opts.noIntro }); return; }
  if (v === 'sky') { S.view = 'sky'; markView(); if (!SKY.aimed || opts.reaim) { SKY.aimed = true; SKY.needAim = true; } return; }
  const prev = S.view; S.view = v; markView();
  if (opts.noFly) return;
  if (v === 'system') {
    flyTo({ focus: 'Sun', dist: S.trueScale ? 2.4e5 * 60 : 175, pitch: 0.5, yaw: 0.55, dur: 1800 });
  } else if (v === 'earthmoon') {
    setScale(true); const lv = litView('Earth', 1.35); flyTo({ focus: 'Earth', dist: 560, pitch: 0.34, yaw: lv.yaw, dur: 1800 });
    if (ST) { const we = worldPos('Earth', ST), wm = worldPos('Moon', ST); CAM.offset = [(wm[0] - we[0]) / 2, (wm[1] - we[1]) / 2, (wm[2] - we[2]) / 2]; }
    toast('True scale: Earth is 12,742 km wide, the Moon 384,000 km away. Zoom in on either.', 4800);
  } else if (v === 'planet') {
    let id = S.selected; if (!id || id === 'Sun') id = 'Jupiter';
    focusBody(id);
  }
}
function autoAim() {
  const i = SKY.info; if (!i.sunDir) { SKY.needAim = true; return; }
  if (i.sunAlt > -3) {
    const a = dirToAzAlt(i.sunDir); SKY.az = a.az; SKY.alt = clamp(a.alt + 10, 5, 70); SKY.fov = 60;
    if (i.obsc > 0.001 && i.sunAlt > 0) { aimSky('sun'); SKY.fov = 14; }
  } else if (i.moonAlt > 3) { const a = dirToAzAlt(i.moonDir); SKY.az = a.az; SKY.alt = clamp(a.alt + 8, 5, 70); SKY.fov = 60; }
  else { SKY.az = 180; SKY.alt = 35; SKY.fov = 70; }
  syncFov();
}

// ---------- time engine ----------
function setTime(ms, opts = {}) {
  ms = clampTime(ms); S.t = ms; if (!opts.keepLive) { S.live = false; if (!opts.keepPlaying) S.playing = false; }
  syncPlayUI(); uiTimeChanged();
}
function goLive() { S.live = true; S.playing = false; S.speed = 1; S.dir = 1; S.t = Date.now(); syncPlayUI(); uiTimeChanged(); }
function stepMonths(ms, n) {
  const p = partsInZone(ms, 'UTC'); const tot = p.y * 12 + (p.mo - 1) + n, y = Math.floor(tot / 12), mo = tot - y * 12;
  const dim = new Date(Date.UTC(2000, mo + 1, 0)).getUTCDate(), dd = Math.min(p.d, mo === 1 ? (isLeap(y) ? 29 : 28) : dim);
  return utcFromParts(y, mo + 1, dd, p.h, p.mi, p.s) + (ms - Math.floor(ms / 1000) * 1000);
}
const SYN = 29.530588853 * MS_DAY;
const STEP_DEFS = [['1m', ms => 60000], ['1h', ms => 3600000], ['1d', ms => MS_DAY], ['1w', ms => 7 * MS_DAY], ['1mo', (ms, s) => stepMonths(ms, s) - ms], ['1y', (ms, s) => stepMonths(ms, 12 * s) - ms], ['syn', () => SYN]];
function stepTime(key, sign) { const d = STEP_DEFS.find(x => x[0] === key); const delta = d[1](S.t, sign); setTime(S.t + (key === '1mo' || key === '1y' ? delta : sign * delta)); }
const SPEEDS = [['1× real-time', 1], ['60× (1 min/s)', 60], ['1 hour / s', 3600], ['1 day / s', 86400], ['10 days / s', 864000], ['1 month / s', 2629800], ['1 year / s', 31557600]];
function setSpeed(v) {
  S.speed = v;
  if (S.live && v !== 1) { S.live = false; S.playing = true; }
  syncPlayUI(); uiTimeChanged();
}
function togglePlay() {
  if (S.live) { S.live = false; S.playing = false; }
  else S.playing = !S.playing;
  syncPlayUI(); uiTimeChanged();
}
function syncPlayUI() {
  $('btnPlay').textContent = S.playing ? '⏸' : '▶'; $('btnPlay').classList.toggle('on', S.playing);
  $('btnRev').classList.toggle('on', S.dir < 0); $('spdSel').value = String(S.speed);
}

// ---------- cinematic tour ----------
let tourToken = 0, touring = false;
function tourCancel() { if (touring) { touring = false; tourToken++; $('bars').style.display = 'none'; $('btnTour').classList.remove('on'); if (tourRestore) { setScale(tourRestore.scale); tourRestore = null; } } }
let tourRestore = null;
const sleep = (ms, tok) => new Promise(res => { const t0 = performance.now(); (function w() { if (tok !== tourToken || performance.now() - t0 >= ms) res(); else requestAnimationFrame(w); })(); });
async function runTour() {
  if (touring) { tourCancel(); return; }
  touring = true; const tok = ++tourToken; tourRestore = { scale: S.trueScale };
  $('bars').style.display = 'block'; $('btnTour').classList.add('on'); S.view = 'planet'; markView();
  const cap = t => { const c = $('cap'); c.style.opacity = 0; setTimeout(() => { c.textContent = t; c.style.opacity = 1; }, 300); };
  const when = fmtNice(S.t, S.loc.tz) + ' · ' + S.loc.name;
  const steps = [
    () => { setScale(false); cap(`The Solar System · ${when}`); flyTo({ focus: 'Sun', dist: 190, pitch: 0.55, yaw: 0.4, dur: 2600 }); return 5200; },
    () => { cap('Inner planets, exactly where they are'); flyTo({ focus: 'Sun', dist: 38, pitch: 0.9, yaw: 1.4, dur: 3600 }); return 5600; },
    () => { cap('Earth — tilted, turning, and lit by the Sun'); flyTo({ focus: 'Earth', dist: rVis('Earth') * 7, pitch: 0.28, yaw: 0.7, dur: 3200 }); return 5400; },
    () => { const up = OB.Earth.up || [0, 0, 1]; cap(`${S.loc.name} — your place under the sky`); flyTo({ focus: 'Earth', dist: rVis('Earth') * 2.6, pitch: Math.asin(clamp(up[1], -1, 1)), yaw: Math.atan2(up[0], up[2]), dur: 3600 }); return 6000; },
    () => { setScale(true); cap('Earth and Moon at true scale — with the Moon’s shadow cones'); flyTo({ focus: 'Earth', dist: 1250, pitch: 0.3, yaw: 1.1, dur: 3800 }); return 6200; },
    () => { cap('The Moon: tidally locked, wobbling with libration'); flyTo({ focus: 'Moon', dist: rVis('Moon') * 6, pitch: 0.2, yaw: 2.0, dur: 3200 }); return 5200; },
    () => { setScale(false); cap('Jupiter and its Galilean moons'); flyTo({ focus: 'Jupiter', dist: rVis('Jupiter') * 12, pitch: 0.22, yaw: 0.6, dur: 3800 }); return 6400; },
    () => { cap('Saturn — rings tilted toward the Sun'); flyTo({ focus: 'Saturn', dist: rVis('Saturn') * 11, pitch: 0.3, yaw: 0.9, dur: 3600 }); return 6000; },
    () => { cap('Back to the big picture'); flyTo({ focus: 'Sun', dist: 175, pitch: 0.5, yaw: 0.55, dur: 3600 }); return 5000; },
    () => { cap('Press on: the Sun carries the whole Solar System through the Galaxy at 245 km/s — every planet corkscrews behind it'); GV.playing = false; setHelix(true, { noPlay: true }); S.live = false; S.playing = true; S.speed = 2629800; syncPlayUI(); hxFrame(); return 7500; },
    () => { cap('Zooming out ×10 billion — the Sun’s path becomes an orbit around the Milky Way: one lap every ~223 million years'); setHelix(false, { noFly: true }); S.playing = false; syncPlayUI(); enterGalaxy({ dur: 7000 }); GV.gt = 0; GV.playing = false; return 8500; },
    () => { cap('…bobbing through the disc every ~70 Myr — and the Galaxy itself is moving, so the path is a helix'); GV.drift = true; syncGalUI(); galFly({ yaw: helixYaw(), pitch: 0.4, dist: 150, tx: 0, ty: 0, tz: 0, dur: 5000 }); GV.speed = 60; GV.playing = true; return 9000; },
    () => { cap('Our neighbours: the Magellanic Clouds, dwarf galaxies — and Andromeda, falling toward us'); GV.drift = false; GV.playing = false; syncGalUI(); galScaleTo('sat', 3500); return 5500; },
    () => { galScaleTo('lg', 4500); cap('The Local Group — Andromeda (M31) approaches at 110 km/s; merger in ~4–5 billion years'); return 7000; },
    () => { galScaleTo('lan', 6000); cap('Laniakea — the whole Local Group flows at ~600 km/s toward the Great Attractor'); return 9000; },
  ];
  for (const st of steps) { if (tok !== tourToken) return; const wait = st(); await sleep(wait, tok); }
  if (tok === tourToken) { GV.playing = false; GV.drift = false; GV.gt = 0; syncGalUI(); tourCancel(); S.view = 'system'; markView(); }
}

// ---------- location ----------
function setLocation(loc, opts = {}) {
  S.loc = Object.assign({ elev: 0 }, loc); try { localStorage.setItem('ca.loc', JSON.stringify(S.loc)); } catch (e) { }
  uiLocationChanged(); if (!opts.silent) toast(`Location: ${S.loc.name}`);
}
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = 'none', ms); }

// ---------- render loop ----------
let lastFrame = performance.now(), fpsAcc = 0, fpsN = 0, FPS = 0;
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix(); skyCam.aspect = w / h; skyCam.updateProjectionMatrix(); galCam.aspect = w / h; galCam.updateProjectionMatrix();
  postResize();
}
addEventListener('resize', resize);
let lastViewKind = '';
const PROF = { state: 0, scene: 0, ui: 0, n: 0 };
let dprAuto = Math.min(window.devicePixelRatio || 1, 2), dprTarget = dprAuto, adaptT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { FPS = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  const p0 = performance.now();
  if (S.live) S.t = Date.now();
  else if (S.playing) {
    S.t += S.dir * S.speed * dt * 1000;
    if (S.t >= RANGE.validMax || S.t <= RANGE.validMin) { S.t = clampTime(S.t); S.playing = false; syncPlayUI(); toast('Reached the end of the supported date range.'); }
  }
  const spinTarget = (!S.live && S.playing && S.speed >= 86400 * 1.5) ? 0 : 1;
  S.spinBlend += (spinTarget - S.spinBlend) * (1 - Math.exp(-dt / 0.45));
  ST = computeState(S.t);
  if (applyStarEpoch(S.t)) SKY.lblKey = null;
  const p1 = performance.now();
  if (S.view === 'galaxy') {
    updateGalaxy(dt, now); renderScene(galScene, galCam);
    if (lastViewKind !== 'gal') { lastViewKind = 'gal'; for (const id in OB) OB[id].label.style.display = 'none'; for (const k of ['N', 'E', 'S', 'W']) markerLabels[k].style.display = 'none'; for (const k in SKY.labels) { SKY.labels[k].style.display = 'none'; SKY.labels[k]._on = false; } }
  } else if (S.view === 'sky') {
    if (lastViewKind === 'gal') hideGalLabels();
    const s0 = performance.now(); updateSky(ST); acc(PROF.parts = PROF.parts || {}, 'sky', performance.now() - s0); if (SKY.needAim) { SKY.needAim = false; autoAim(); updateSky(ST); } renderScene(skyScene, skyCam);
    if (lastViewKind !== 'sky') { lastViewKind = 'sky'; for (const id in OB) OB[id].label.style.display = 'none'; for (const k of ['N', 'E', 'S', 'W']) markerLabels[k].style.display = 'none'; }
  } else {
    if (lastViewKind === 'gal') hideGalLabels();
    if (lastViewKind !== 'sys') { lastViewKind = 'sys'; for (const k in SKY.labels) { SKY.labels[k].style.display = 'none'; SKY.labels[k]._on = false; } }
    const origin = stepCamera(now);
    updateScene(ST, origin); updateLabels(); renderScene(scene, camera);
  }
  const p2 = performance.now();
  uiTick(now);
  const p3 = performance.now();
  PROF.state += p1 - p0; PROF.scene += p2 - p1; PROF.ui += p3 - p2; PROF.n++;
  // adaptive resolution: keep interaction smooth on weak GPUs
  if (!window.__noAdapt && now > 9000 && now - adaptT > 2500 && document.visibilityState === 'visible') {
    adaptT = now;
    if (FPS < 30 && dprAuto <= 0.74 && S.tg.bloom && POST.ok) { S.tg.bloom = false; const c = document.querySelector('[data-tg="bloom"]'); if (c) c.classList.remove('on'); toast('Bloom switched off to keep the frame rate up.'); }
    else if (FPS < 30 && dprAuto > 0.7) { dprAuto = Math.max(0.7, dprAuto * 0.82); renderer.setPixelRatio(dprAuto); resize(); }
    else if (FPS > 57 && dprAuto < dprTarget) { dprAuto = Math.min(dprTarget, dprAuto * 1.12); renderer.setPixelRatio(dprAuto); resize(); }
  }
}
window.__parts2 = () => PROF.parts;
window.__prof = () => { const n = Math.max(1, PROF.n), r = { state: PROF.state / n, scene: PROF.scene / n, ui: PROF.ui / n, fps: FPS, dpr: dprAuto, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; PROF.state = PROF.scene = PROF.ui = PROF.n = 0; return r; };
function startRender() { resize(); requestAnimationFrame(frame); }
