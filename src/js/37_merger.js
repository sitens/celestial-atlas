// ===================== 37_merger.js — Milky Way x Andromeda collision (Galaxy view, "Collision" scale) =====================
// Physics in 16_merger_math.js. Here: build the simulation (time-sliced, with checkpoints), draw 8,000 stars + glows, scrub/play/reverse,
// auto-frame camera, labels and the dock strip. The simulation is a restricted N-body (test stars in two moving halo potentials).
const MG = { built: false, building: false, prog: 0, scene: new THREE.Scene(), orb: null, st: null, ck: [], CK: 100, pts: null, glow: [], sunRing: null, base: null, n: 0, auto: true, tint: -1, final: null, kRest: 0, ready: false, catching: false, lag: 0, cur: null, info: {} };
GV.merge = false; GV.mt = 0; GV.mtMax = 10000;
const MG_NA = 6500, MG_NB = 7500;
const MG_COL = { // [disc, bulge, halo] base star colours per galaxy
  0: [[0.62, 0.78, 1.0], [1.0, 0.86, 0.62], [0.72, 0.82, 1.0]],
  1: [[0.80, 0.82, 1.0], [1.0, 0.80, 0.55], [0.85, 0.82, 0.95]],
};
function mgEvents() { // key moments from the orbit (Myr)
  const o = MG.orb; const p = o.peri.filter(q => q.r < 60).slice(0, 2);
  return { first: p[0] ? p[0].tMyr : 3650, second: p[1] ? p[1].tMyr : 5600, merged: o.mergedMyr, firstR: p[0] ? p[0].r : 30, secondR: p[1] ? p[1].r : 28 };
}
async function mergeBuild() {
  if (MG.built || MG.building) return; MG.building = true; MG.prog = 0; showMgProg(true);
  buildFar(); const m = FAR.m31, R0 = [m.x, m.y, m.z], P = MG_P;
  const nb = galaxyBasis(10.6847, 41.2687, 37.7, 77.5).y;   // M31 disc normal (spin axis sense is not observable; chosen prograde-ish)
  MG.orb = mergerOrbit(R0, P); const orb = MG.orb; MG.n = MG_NA + MG_NB;
  MG.st = mergerInit(MG_NA, MG_NB, orb, nb, P); const st = MG.st;
  // geometry
  const N = MG.n, pos = new Float32Array(st.pos), col = new Float32Array(N * 3), size = new Float32Array(N); MG.base = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const c = MG_COL[st.own[i]][st.kind[i]], j = i * 3, f = st.kind[i] === 2 ? 0.45 : 1; MG.base[j] = c[0] * f; MG.base[j + 1] = c[1] * f; MG.base[j + 2] = c[2] * f; size[i] = st.kind[i] === 1 ? 1.0 : st.kind[i] === 2 ? 0.8 : 1.0; }
  size[st.sunIdx] = 0.01; col.set(MG.base);
  MG.pts = cloudPoints({ pos, col, size, n: N }, 3, 0.55); MG.pts.renderOrder = 3; MG.scene.add(MG.pts);
  for (let g = 0; g < 2; g++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: g ? 0xffe6c4 : 0xcfe0ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 })); sp.renderOrder = 2; MG.scene.add(sp); MG.glow.push(sp); }
  MG.sunRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), depthWrite: false, transparent: true, depthTest: false })); MG.sunRing.renderOrder = 8; MG.scene.add(MG.sunRing);
  MG.sunDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, depthTest: false })); MG.sunDot.renderOrder = 8; MG.scene.add(MG.sunDot);
  // run the whole simulation once (time-sliced) and keep a checkpoint every MG.CK steps; positions at any time = nearest checkpoint + a few steps
  const save = () => MG.ck.push({ k: st.k, pos: st.pos.slice(), vel: st.vel.slice() });
  save(); const nCk = Math.floor(orb.n / MG.CK);
  for (let c = 1; c <= nCk; c++) {
    mergerAdvance(st, orb, MG.CK, 1, P); save(); MG.prog = c / nCk;
    if (c % 4 === 0) { setMgProg(MG.prog); await new Promise(r => setTimeout(r, 0)); }
  }
  MG.final = mergerRemnant(st, orb); MG.ev = mgEvents();
  // snapshot of the remnant's shape for the narration (also when just merged)
  { const k6 = Math.min(MG.ck.length - 1, Math.round(MG.ev.merged / (orb.dtMyr * MG.CK)) + 2); const tmp = { N: st.N, pos: MG.ck[k6].pos, vel: MG.ck[k6].vel, sunIdx: st.sunIdx }; MG.atMerge = mergerRemnant(tmp, orb); }
  mgRestore(0); MG.built = true; MG.building = false; MG.ready = true; showMgProg(false); mgBarSetup(); mgApplyPositions(true); mgFrameNow(true);
  if (typeof syncGalUI === 'function') syncGalUI();
}
function mgRestore(c) { const ck = MG.ck[c]; MG.st.pos.set(ck.pos); MG.st.vel.set(ck.vel); MG.st.k = ck.k; }
function showMgProg(on) { const el = $('mgProg'); if (el) el.style.display = on ? 'block' : 'none'; if (on) setMgProg(0); }
function setMgProg(p) { const b = $('mgProgBar'), t = $('mgProgTxt'); if (b) b.style.width = Math.round(p * 100) + '%'; if (t) t.textContent = `Simulating ${(p * 10).toFixed(1)} of 10 billion years…`; }
function mgWarm(f) { return f; }
function mgApplyPositions(force) {
  const st = MG.st; if (!MG.pts) return; if (!force && MG.lastK === st.k) return; MG.lastK = st.k;
  const a = MG.pts.geometry.getAttribute('position'); a.array.set(st.pos); a.needsUpdate = true;
  // stars age: after the merger star formation has stopped, so tint warm
  const age = Math.max(0, Math.min(1, (GV.mt - MG.ev.merged * 0.85) / 2500)); if (Math.abs(age - MG.tint) > 0.02) {
    MG.tint = age; const c = MG.pts.geometry.getAttribute('color').array, b = MG.base, w = [1.0, 0.80, 0.55];
    for (let i = 0; i < MG.n; i++) { const j = i * 3, lum = (b[j] + b[j + 1] + b[j + 2]) / 3; c[j] = b[j] * (1 - age) + w[0] * lum * age; c[j + 1] = b[j + 1] * (1 - age) + w[1] * lum * age; c[j + 2] = b[j + 2] * (1 - age) + w[2] * lum * age; }
    MG.pts.geometry.getAttribute('color').needsUpdate = true;
  }
}
// bring the live state to the requested time, within a CPU budget
function mgSync(budgetMs) {
  const orb = MG.orb, st = MG.st; if (!MG.ready) return;
  const tgt = Math.max(0, Math.min(orb.n, Math.round(GV.mt / orb.dtMyr)));
  let diff = tgt - st.k; if (diff === 0) { MG.catching = false; return; }
  const c = Math.floor(tgt / MG.CK);
  if (diff < -150 || diff > 150) { const kc = MG.ck[Math.min(c, MG.ck.length - 1)].k; if ((diff < 0) || kc > st.k) { mgRestore(Math.min(c, MG.ck.length - 1)); diff = tgt - st.k; } }
  const t0 = performance.now();
  while (diff !== 0 && performance.now() - t0 < budgetMs) { const n = Math.min(Math.abs(diff), 24); mergerAdvance(st, orb, n, diff > 0 ? 1 : -1, MG_P); diff = tgt - st.k; }
  MG.catching = diff !== 0; MG.lag = Math.abs(diff);
}
function mgCenters(k) { const o = MG.orb; return [new THREE.Vector3(o.c1[k * 3], o.c1[k * 3 + 1], o.c1[k * 3 + 2]), new THREE.Vector3(o.c2[k * 3], o.c2[k * 3 + 1], o.c2[k * 3 + 2])]; }
function mgFrameNow(instant) { // auto-frame target from the spread of the stars
  const st = MG.st, N = st.N; let cx = 0, cy = 0, cz = 0; for (let p = 0; p < N; p++) { cx += st.pos[p * 3]; cy += st.pos[p * 3 + 1]; cz += st.pos[p * 3 + 2]; } cx /= N; cy /= N; cz /= N;
  const [a, b] = mgCenters(st.k), sep = a.distanceTo(b); let s2 = 0, n = 0; for (let p = 0; p < N; p += 7) { const dx = st.pos[p * 3] - cx, dy = st.pos[p * 3 + 1] - cy, dz = st.pos[p * 3 + 2] - cz; s2 += dx * dx + dy * dy + dz * dz; n++; }
  const rms = Math.sqrt(s2 / n), want = Math.max(70, Math.min(2600, Math.max(sep * 1.7 + 90, rms * 2.4)));
  MG.frame = { cx, cy, cz, dist: want, sep, rms };
  if (instant) { GV.tx = cx; GV.ty = cy; GV.tz = cz; GV.dist = want; }
}
function mgYaw() { const m = FAR.m31; return m ? Math.atan2(-m.z, m.x) : 0.5; }
function enterMerge() {
  GV.merge = true; GV.follow = false; GV.drift = false; GV.mtSaved = GV.speed; GV.speed = 250; GV.playing = false; GV.mt = GV.mt || 0; MG.auto = true;
  if (!MG.built) mergeBuild();
  galFly({ yaw: mgYaw(), pitch: 0.42, dist: MG.frame ? MG.frame.dist : 1900, tx: MG.frame ? MG.frame.cx : 0, ty: MG.frame ? MG.frame.cy : 0, tz: MG.frame ? MG.frame.cz : 0, dur: 2500 });
  document.body.classList.add('mg'); syncPlayUI();
}
function exitMerge() {
  if (!GV.merge) return; GV.merge = false; document.body.classList.remove('mg'); GV.speed = GV.mtSaved || 20; GV.playing = false; showMgProg(false); syncPlayUI();
}
function mgGoto(tMyr) { GV.mt = Math.max(0, Math.min(GV.mtMax, tMyr)); GV.playing = false; MG.auto = true; syncPlayUI(); mgSyncUI(); }
function mgBarSetup() {
  const e = MG.ev, set = (id, t) => { const b = $(id); if (b) b.dataset.t = Math.round(t); };
  set('mgFirst', e.first); set('mgSecond', e.second); set('mgMerged', e.merged + 400); set('mgFinal', GV.mtMax - 1);
}
function mgSyncUI() { const b = $('mgAuto'); if (b) b.classList.toggle('on', MG.auto); }
function mgPhase() { // plain-language phase of the collision at the current time
  const e = MG.ev, t = GV.mt; if (!e) return '';
  if (t < e.first - 700) return 'Approaching: the two galaxies fall toward each other at ~110 km/s';
  if (t < e.first - 80) return 'Tidal forces begin to stretch both discs';
  if (t < e.first + 250) return 'First close pass: the discs plunge through each other';
  if (t < e.second - 400) return 'Separating: long tidal tails and a bridge of stars';
  if (t < e.second + 250) return 'Second pass: the galaxies return';
  if (t < e.merged + 500) return 'Coalescing: the two cores spiral together';
  return 'Merger complete: one giant elliptical, “Milkomeda”';
}
function mergeTick(dt, now) {
  if (!MG.ready) { return; }
  if (GV.playing) { GV.mt += GV.speed * dt; if (GV.mt >= GV.mtMax) { GV.mt = GV.mtMax; GV.playing = false; syncPlayUI(); } if (GV.mt <= 0) { GV.mt = 0; if (GV.speed < 0) { GV.playing = false; syncPlayUI(); } } }
  mgSync(MG.catching && Math.abs(GV.speed) < 2000 && !GV.playing ? 24 : 12);
  mgApplyPositions(false);
  const st = MG.st, [a, b] = mgCenters(st.k), dist = GV.dist;
  MG.glow[0].position.copy(a); MG.glow[1].position.copy(b);
  const close = Math.max(0, 1 - 40 / Math.max(40, a.distanceTo(b)));
  const gs = Math.max(30, dist * 0.05); MG.glow[0].scale.setScalar(gs); MG.glow[1].scale.setScalar(gs * 1.2);
  const gl = Math.max(0.05, Math.min(0.5, (dist - 150) / 1400)), age = Math.max(0, Math.min(1, (GV.mt - MG.ev.merged * 0.85) / 2500)); MG.glow[0].material.opacity = MG.glow[1].material.opacity = gl;
  for (const g of MG.glow) g.material.color.setRGB(0.80 + 0.2 * age, 0.88 - 0.1 * age, 1.0 - 0.45 * age);
  const sp = new THREE.Vector3(st.pos[st.sunIdx * 3], st.pos[st.sunIdx * 3 + 1], st.pos[st.sunIdx * 3 + 2]), rs = Math.max(0.5, dist * 0.012);
  MG.sunRing.position.copy(sp); MG.sunRing.scale.setScalar(rs * 2.2); MG.sunDot.position.copy(sp); MG.sunDot.scale.setScalar(rs * 3);
  MG.pts.material.uniforms.uK.value = Math.max(1.4, Math.min(8, 1.0 + 55 / Math.sqrt(Math.max(30, dist)))); MG.pts.material.uniforms.uAlpha.value = Math.min(0.7, 0.25 + 45 / Math.max(90, dist));
  mgFrameNow(false);
  if (MG.auto && !GV.tween) { const F = MG.frame, k = 1 - Math.exp(-dt / 0.35); GV.tx += (F.cx - GV.tx) * k; GV.ty += (F.cy - GV.ty) * k; GV.tz += (F.cz - GV.tz) * k; GV.dist *= Math.pow(F.dist / GV.dist, k); }
  MG.info = { t: GV.mt, sep: a.distanceTo(b), phase: mgPhase(), sunDist: sp.distanceTo(new THREE.Vector3(MG.frame.cx, MG.frame.cy, MG.frame.cz)), catching: MG.catching, rms: MG.frame.rms };
  // labels
  const on = S.tg.labels && S.view === 'galaxy', lab = (key, text, cls, pos, ox, oy, show) => placeGalLabel(galLabel(key, text, cls), pos, ox, oy, show), merged = GV.mt > MG.ev.merged + 300;
  lab('mgA', 'Milky Way', 'sun', a, 16, -10, on && !merged); lab('mgB', 'Andromeda (M31)', 'sun', b, 16, -10, on && !merged);
  lab('mgM', 'Milkomeda · the merged galaxy', 'sun', a.clone().lerp(b, 0.5), 18, -12, on && merged);
  lab('mgS', 'Sun', 'mk', sp, 12, -8, on && dist < 600);
}
// dock strip: separation of the two galaxies over 10 Gyr (log scale) with the key moments
function drawMergeStrip() {
  if (!MG.orb || !MG.ev) { const { w, h, dpr } = tlSizing(); const g = TL.canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); g.fillStyle = '#9fb0cf'; g.font = '11px ui-monospace,Consolas,monospace'; g.fillText('Simulating the collision…', 10, h / 2); TL.lastKey = null; return; }
  const { w, h, dpr } = tlSizing(); if (!w) return; TL.lastKey = null;
  const g = TL.canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const o = MG.orb, X = t => t / GV.mtMax * w, Y = r => { const l = Math.log10(Math.max(1, r)); return 14 + (1 - l / Math.log10(900)) * (h - 32); };
  g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 12, w, h - 30);
  g.beginPath(); for (let i = 0; i <= o.n; i += 8) { const x = X(i * o.dtMyr), y = Y(o.r[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokeStyle = '#6ad1ff'; g.lineWidth = 1.5; g.stroke(); g.lineWidth = 1;
  g.font = '10px ui-monospace,Consolas,monospace'; g.fillStyle = '#7d89a3'; for (let t = 0; t <= 10000; t += 2000) { g.fillRect(X(t), h - 14, 1, 4); g.fillText((t / 1000) + ' Gyr', Math.min(w - 46, X(t) + 3), h - 3); }
  const e = MG.ev; for (const [t, txt, col] of [[e.first, '1st pass', '#ffb454'], [e.second, '2nd pass', '#ffb454'], [e.merged, 'merged', '#ff8fa8']]) { g.strokeStyle = col; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X(t) + .5, 12); g.lineTo(X(t) + .5, h - 16); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.fillText(txt, Math.min(w - 52, X(t) + 4), 11); }
  g.fillStyle = '#9fb0cf'; g.fillText('separation of the two galaxies', 6, h - 18 > 40 ? h - 18 : 36);
  g.strokeStyle = '#ffb454'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(GV.mt), 0); g.lineTo(X(GV.mt), h); g.stroke(); g.lineWidth = 1;
  if (TL.galHoverX != null && TL.galHover) { const tw = g.measureText(TL.galHover).width + 14, tx = Math.min(w - tw - 4, Math.max(4, TL.galHoverX - tw / 2)); g.fillStyle = 'rgba(8,12,22,.92)'; g.fillRect(tx, 20, tw, 18); g.strokeStyle = '#fff3'; g.strokeRect(tx + .5, 20.5, tw, 18); g.fillStyle = '#e9eef8'; g.fillText(TL.galHover, tx + 7, 33); }
}
function mgHoverText(t) { const e = MG.ev; if (!e) return ''; let s = t < 50 ? 'today' : '+' + (t / 1000).toFixed(2) + ' Gyr'; if (Math.abs(t - e.first) < 150) s += ' · first close pass'; else if (Math.abs(t - e.second) < 150) s += ' · second pass'; else if (Math.abs(t - e.merged) < 200) s += ' · merger completes'; return s; }
