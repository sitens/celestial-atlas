// ===================== 35_galaxy.js — Milky Way view: the Sun's helical path around the Galactic Centre =====================
const galScene = new THREE.Scene();
const galCam = new THREE.PerspectiveCamera(45, 1, 1e-4, 1e6);
const GV = { ready: false, gt: 0, playing: false, speed: 20, drift: false, vex: 25, dscale: 0.2, art: true, gaia: true, scaleName: 'mw', omega: 28.2, cross: null, crossOmega: null, follow: false, yaw: 0.6, pitch: 0.95, dist: 38, tx: 0, ty: 0, tz: 0, tween: null, labels: {}, pathKey: '', info: {}, sun: null };
const GT_MAX = 650, BEADS = 90;
const LY_PER_KPC = 3261.56;
let galDots, galPoints, galPath, galBeads, galSun, galSunRing, galDrop, galGhost = [], galMarkers = [], galDrift = null;

const GAL_VS = `
attribute vec3 color; attribute float size; varying vec3 vC; uniform float uPx, uK;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vC = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(size * uK * uPx, 1.0, 18.0 * uPx);
  #include <logdepthbuf_vertex>
}`;
const GAL_FS = `
precision highp float; varying vec3 vC; uniform float uAlpha;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; float a = pow(max(0.0, 1.0 - r), 1.6);
  gl_FragColor = vec4(vC, a * uAlpha);
  #include <colorspace_fragment>
}`;
function radialTex(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function ringTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,225,150,0.95)'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 40, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function galLabel(key, text, cls) {
  let el = GV.labels[key];
  if (!el) { el = document.createElement('div'); el.className = 'lbl gal ' + (cls || ''); el.textContent = text; $('labels').appendChild(el); GV.labels[key] = el; }
  return el;
}
function buildGalaxy() {
  const mw = buildMilkyWay(110000, 11);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mw.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(mw.col, 3)); g.setAttribute('size', new THREE.BufferAttribute(mw.size, 1));
  galPoints = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uPx: { value: renderer.getPixelRatio() }, uK: { value: 1.7 }, uAlpha: { value: 0.3 } }, vertexShader: GAL_VS, fragmentShader: GAL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  galPoints.frustumCulled = false; galScene.add(galPoints);
  // diffuse disc glow + bulge glow
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(255,230,190,0.55)'], [0.1, 'rgba(255,214,160,0.32)'], [0.35, 'rgba(150,185,255,0.16)'], [0.7, 'rgba(110,150,255,0.05)'], [1, 'rgba(90,130,255,0)']], 512), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  glow.rotation.x = -Math.PI / 2; glow.renderOrder = -2; galScene.add(glow); GV.glow = glow;
  const gc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 })); gc.scale.set(3.2, 3.2, 1); gc.renderOrder = 5; galScene.add(gc);
  const gc2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 })); gc2.scale.set(0.7, 0.7, 1); gc2.renderOrder = 5; galScene.add(gc2);
  // scale rings
  for (const R of [5, 10, 15]) {
    const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * 6.2832; pts.push(new THREE.Vector3(R * Math.cos(a), 0, R * Math.sin(a))); }
    galScene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4a6a9c, transparent: true, opacity: 0.28, depthWrite: false })));
  }
  // Sun's orbit path through time (rebuilt when exaggeration / drift mode change)
  const o = sunOrbit(), n = o.t.length;
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  galPath = new THREE.Line(pg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); galPath.frustumCulled = false; galPath.renderOrder = 4; galScene.add(galPath);
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BEADS * 3), 3)); bg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(BEADS * 3), 3)); bg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(BEADS).fill(3.2), 1));
  galBeads = new THREE.Points(bg, new THREE.ShaderMaterial({ uniforms: { uPx: { value: renderer.getPixelRatio() }, uK: { value: 2.2 }, uAlpha: { value: 1.0 } }, vertexShader: GAL_VS, fragmentShader: GAL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); galBeads.frustumCulled = false; galBeads.renderOrder = 6; galScene.add(galBeads);
  const nd = Math.floor((o.t.length - 1) / 8) + 1, dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nd * 3), 3)); dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nd * 3), 3)); dg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(nd).fill(2.0), 1));
  galDots = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: { uPx: { value: renderer.getPixelRatio() }, uK: { value: 1.6 }, uAlpha: { value: 0.9 } }, vertexShader: GAL_VS, fragmentShader: GAL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); galDots.frustumCulled = false; galDots.renderOrder = 4; galScene.add(galDots);
  galSun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, depthTest: false })); galSun.renderOrder = 8; galScene.add(galSun);
  galSunRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), depthWrite: false, transparent: true, depthTest: false })); galSunRing.renderOrder = 8; galScene.add(galSunRing);
  galDrop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.6, depthTest: false })); galDrop.renderOrder = 7; galScene.add(galDrop);
  // ghost copies of the galactic disc (shown when the galaxy's drift through space is on)
  for (let i = 0; i < 9; i++) {
    const pts = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * 6.2832; pts.push(new THREE.Vector3(16 * Math.cos(a), 0, 16 * Math.sin(a))); }
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7fb0ff, transparent: true, opacity: 0.18 + (i === 4 ? 0.25 : 0), depthWrite: false })); ln.visible = false; galScene.add(ln); galGhost.push(ln);
  }
  // geological markers on the path (Myr before now)
  galMarkers = [[-66, 'K–Pg · dinosaurs end (66 Myr ago)'], [-252, 'Permian–Triassic extinction (252 Myr ago)'], [-541, 'Cambrian explosion (541 Myr ago)'], [66, '+66 Myr']].map(([t, txt]) => ({ t, txt }));
  galDrift = galaxyDrift();
  GV.ready = true;
  buildFar();
}
function galPathBuild() {
  const key = GV.vex + '|' + GV.drift + '|' + GV.dscale; if (key === GV.pathKey) return; GV.pathKey = key;
  const o = sunOrbit(), P = galPath.geometry.getAttribute('position'), C = galPath.geometry.getAttribute('color'), D = GVD();
  for (let i = 0; i < o.t.length; i++) {
    const t = o.t[i], dd = GV.drift ? t : 0;
    P.setXYZ(i, o.x[i] + D[0] * dd, o.y[i] * GV.vex + D[1] * dd, o.z[i] + D[2] * dd);
    const f = 0.2 + 0.65 * Math.exp(-Math.abs(t) / 260);
    if (t < 0) C.setXYZ(i, 0.25 * f, 0.7 * f, 1.0 * f); else C.setXYZ(i, 1.0 * f, 0.7 * f, 0.25 * f);
  }
  P.needsUpdate = true; C.needsUpdate = true;
  const DP = galDots.geometry.getAttribute('position'), DC = galDots.geometry.getAttribute('color');
  for (let j = 0, i = 0; i < o.t.length; i += 8, j++) { DP.setXYZ(j, P.getX(i), P.getY(i), P.getZ(i)); DC.setXYZ(j, C.getX(i) * 1.5, C.getY(i) * 1.5, C.getZ(i) * 1.5); }
  DP.needsUpdate = true; DC.needsUpdate = true;
}
const GVD = () => galDrift.v.map(v => v * GV.dscale);
function galSunPos(t) { const s = sunAt(t); return new THREE.Vector3(s.x, s.y * GV.vex, s.z); }
function galPoint(t) { // path point at time t, in the frame where the galaxy sits at the origin NOW
  const s = sunAt(t), D = GVD(), dd = GV.drift ? (t - GV.gt) : 0;
  return new THREE.Vector3(s.x + D[0] * dd, s.y * GV.vex + D[1] * dd, s.z + D[2] * dd);
}
function galFly(o) { // tween the orbit camera
  GV.tween = { t0: performance.now(), dur: o.dur || 2500, from: { yaw: GV.yaw, pitch: GV.pitch, dist: GV.dist, tx: GV.tx, ty: GV.ty, tz: GV.tz }, to: Object.assign({ yaw: GV.yaw, pitch: GV.pitch, dist: GV.dist, tx: 0, ty: 0, tz: 0 }, o) };
}
function enterGalaxy(opts = {}) {
  if (!GV.ready) buildGalaxy();
  S.view = 'galaxy'; markView();
  if (opts.intro !== false) {
    const sp = galSunPos(GV.gt);
    GV.yaw = 0.9; GV.pitch = 0.5; GV.dist = 0.35; GV.tx = sp.x; GV.ty = sp.y; GV.tz = sp.z;
    galFly({ yaw: 0.55, pitch: 0.98, dist: 38, tx: 0, ty: 0, tz: 0, dur: opts.dur || 6500 });
    toast('Zooming out: the Sun is one star in the Orion Spur, 26,700 light-years from the Milky Way\'s centre.', 6000);
  }
}
function galApplyPath() { // everything that depends on GV.drift: the path, beads, marker and ghost discs (also re-run per half in compare mode)
  galPathBuild();
  const s = sunAt(GV.gt), D = GVD(), sp = new THREE.Vector3(s.x, s.y * GV.vex, s.z);
  galPath.position.set(GV.drift ? -D[0] * GV.gt : 0, GV.drift ? -D[1] * GV.gt : 0, GV.drift ? -D[2] * GV.gt : 0); galDots.position.copy(galPath.position);
  // beads: the recent past and near future of the path
  const bp = galBeads.geometry.getAttribute('position'), bc = galBeads.geometry.getAttribute('color'), bs = galBeads.geometry.getAttribute('size');
  for (let i = 0; i < BEADS; i++) {
    const t = GV.gt + (i - BEADS * 0.55) * 2.4, q = galPoint(Math.max(-GT_MAX - 40, Math.min(GT_MAX + 40, t))), f = 1 - Math.abs(i - BEADS * 0.55) / (BEADS * 0.6);
    bp.setXYZ(i, q.x, q.y, q.z); const past = t < GV.gt; bc.setXYZ(i, (past ? 0.3 : 1.0) * (0.35 + f), (past ? 0.75 : 0.72) * (0.35 + f), (past ? 1.0 : 0.3) * (0.35 + f)); bs.setX(i, 1.6 + 3.2 * Math.max(0, f));
  }
  bp.needsUpdate = true; bc.needsUpdate = true; bs.needsUpdate = true;
  // marker, drop line to the plane, ghost discs
  galSun.position.copy(sp); galSunRing.position.copy(sp);
  const dr = galDrop.geometry.getAttribute('position'); dr.setXYZ(0, sp.x, sp.y, sp.z); dr.setXYZ(1, sp.x, 0, sp.z); dr.needsUpdate = true; galDrop.visible = GV.vex > 1.5;
  for (let i = 0; i < galGhost.length; i++) {
    const k = i - 4, vis = GV.drift && k !== 0; galGhost[i].visible = GV.drift;
    const dd = k * 120; galGhost[i].position.set(D[0] * dd, D[1] * dd, D[2] * dd); galGhost[i].material.opacity = k === 0 ? 0 : Math.max(0.05, 0.22 - Math.abs(k) * 0.03);
  }
}
function updateGalaxy(dt, now) {
  if (!GV.ready) buildGalaxy();
  if (GV.merge) mergeTick(dt, now);
  else if (GV.playing) { GV.gt += GV.speed * dt; if (GV.gt > GT_MAX) { GV.gt = GT_MAX; GV.playing = false; syncGalUI(); } if (GV.gt < -GT_MAX) { GV.gt = -GT_MAX; GV.playing = false; syncGalUI(); } }
  GV.glow.material.opacity = GV.art ? 0.22 : 0.9;
  FAR.rot.rotation.y = -GV.omega * GM.kms * GV.gt; FAR.rot.updateMatrixWorld(true);
  const s = sunAt(GV.gt), D = GVD(), sp = new THREE.Vector3(s.x, s.y * GV.vex, s.z);
  galApplyPath();
  // camera
  const tw = GV.tween;
  if (tw) {
    const k = Math.min(1, (now - tw.t0) / tw.dur), e = ease(k), L = (a, b) => a + (b - a) * e;
    GV.yaw = L(tw.from.yaw, tw.to.yaw); GV.pitch = L(tw.from.pitch, tw.to.pitch); GV.dist = tw.from.dist * Math.pow(tw.to.dist / tw.from.dist, e);
    GV.tx = L(tw.from.tx, tw.to.tx); GV.ty = L(tw.from.ty, tw.to.ty); GV.tz = L(tw.from.tz, tw.to.tz); if (k >= 1) GV.tween = null;
  } else if (GV.follow) { GV.tx += (sp.x - GV.tx) * 0.2; GV.ty += (sp.y - GV.ty) * 0.2; GV.tz += (sp.z - GV.tz) * 0.2; }
  GV.dist = Math.max(0.0004, Math.min(6e5, GV.dist));
  const cp = Math.cos(GV.pitch);
  galCam.position.set(GV.tx + Math.sin(GV.yaw) * cp * GV.dist, GV.ty + Math.sin(GV.pitch) * GV.dist, GV.tz + Math.cos(GV.yaw) * cp * GV.dist);
  galCam.up.set(0, 1, 0); galCam.lookAt(GV.tx, GV.ty, GV.tz); galCam.near = Math.max(GV.dist * 0.001, 1e-5); galCam.far = 1e9; galCam.updateProjectionMatrix(); galCam.updateMatrixWorld(true);
  const dc = galCam.position.distanceTo(sp), sc = Math.max(0.00025, dc * 0.022);
  galSun.scale.set(sc * 2.2, sc * 2.2, 1); galSunRing.scale.set(sc * 1.6, sc * 1.6, 1);
  galPoints.material.uniforms.uAlpha.value = Math.max(0.12, Math.min(0.55, 0.22 * Math.pow(GV.dist / 25, 0.42))) * (GV.art ? 0.5 : 1) * (GV.nearFade == null ? 1 : GV.nearFade);
  const pathVis = GV.dist < 2500; galPath.visible = galDots.visible = galBeads.visible = galSun.visible = galSunRing.visible = galDrop.visible = pathVis;
  galPoints.material.uniforms.uK.value = Math.max(1.4, Math.min(2.4, 2.4 - GV.dist / 80));
  GV.sun = s; GV.info = { gt: GV.gt, R: s.R, y: s.y, speed: s.speed, vR: s.vR, phi: s.phi, dist: GV.dist };
  // labels
  const lab = (key, text, cls, pos, ox, oy, show) => placeGalLabel(galLabel(key, text, cls), pos, ox, oy, show);
  const on = S.tg.labels && S.view === 'galaxy' && !GV.merge;
  lab('gc', 'Sagittarius A* · Galactic Centre', 'gc', new THREE.Vector3(0, 0, 0), 12, -6, on && GV.dist < 110);
  lab('sun', 'Sun · Orion Spur', 'sun', sp, 14, -8, on && GV.dist < 110);
  const armLab = [[0, 12.4, 'Perseus Arm'], [1, 10.4, 'Sagittarius–Carina Arm'], [2, 9.4, 'Scutum–Centaurus Arm'], [3, 11.6, 'Norma–Outer Arm']];
  for (const [j, R, name] of armLab) { const p = armXZ(ARMS[j], R); lab('arm' + j, name, 'arm', FAR.rot.localToWorld(new THREE.Vector3(p[0], 0, p[1])), 0, 0, on && GV.dist > 8 && GV.dist < 110); }
  const bx = Math.cos(GM.barAngle) * 5.0, bz = Math.sin(GM.barAngle) * 5.0; lab('bar', 'Central bar', 'arm', FAR.rot.localToWorld(new THREE.Vector3(bx, 0.3, bz)), 4, -4, on && GV.dist > 6 && GV.dist < 110);
  [5, 10, 15].forEach(R => lab('ring' + R, `${R} kpc · ${(R * LY_PER_KPC / 1000).toFixed(0)}k ly`, 'ring', new THREE.Vector3(-R * 0.7071, 0, -R * 0.7071), 0, 0, on && GV.dist > 10 && GV.dist < 110));
  for (const m of galMarkers) { const show = on && Math.abs(m.t) <= 560 && m.t < 0; lab('mk' + m.t, m.txt, 'mk', galPoint(m.t), 8, -4, show && GV.dist < 120 && !GV.drift); }
  if (GV.drift) lab('drift', 'Galaxy drifts toward the Great Attractor (l 266°, b 29°) →', 'drift', new THREE.Vector3(D[0] * 140, D[1] * 140, D[2] * 140), 0, 0, on); else lab('drift', '', 'drift', new THREE.Vector3(), 0, 0, false);
  updateFar(GV.dist, on, sp);
}
const _gv = new THREE.Vector3(), _gv2 = new THREE.Vector3();
function placeGalLabel(el, pos, ox, oy, show) { placeLabelCam(el, pos, ox, oy, show, galCam); }
function placeLabelCam(el, pos, ox, oy, show, cam) {
  let on = false, x = 0, y = 0;
  if (show) {
    _gv.copy(pos).project(cam); _gv2.copy(pos).applyMatrix4(cam.matrixWorldInverse);
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    x = (_gv.x * 0.5 + 0.5) * w + ox; y = (-_gv.y * 0.5 + 0.5) * h + oy; on = _gv2.z < 0 && x > -60 && x < w + 60 && y > -20 && y < h + 20;
  }
  if (on !== el._on) { el.style.display = on ? 'block' : 'none'; el._on = on; }
  if (on) el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
}
function hideGalLabels() { for (const k in GV.labels) { GV.labels[k].style.display = 'none'; GV.labels[k]._on = false; } }
