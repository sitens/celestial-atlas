// ===================== 38_life.js — the life of the Sun (Solar System view, "Sun’s life") =====================
// A schematic, physically-labelled look at the Sun from birth to white dwarf and the fate of the planets. Luminosity, radius and mass
// come from published solar-evolution models (Sackmann, Boothroyd & Kraemer 1993; Schröder & Smith 2008, MNRAS 386, 155: tip of the red
// giant branch at +7.59 Gyr with R ≈ 256 R☉, L ≈ 2,730 L☉, M ≈ 0.67 M☉; final white dwarf ≈ 0.54 M☉). Temperature follows from L and R.
// Distances use a square-root scale (a star 100× farther is drawn 10× farther) so a 0.005 AU star and a 30 AU Neptune fit one view;
// planet sizes are exaggerated. Orbits widen as the Sun loses mass (a ∝ 1/M).
const lifeScene = new THREE.Scene();
const lifeCam = new THREE.PerspectiveCamera(45, 1, 1e-4, 1e5);
const LIFE = { on: false, playing: false, speed: 1, u: 0.17, tween: null, yaw: 0.5, pitch: 0.75, dist: 6.5, tx: 0, ty: 0, tz: 0, min: 0.03, max: 140, built: false, objs: {}, hz: null, star: null, glow: [], neb: null, st: null, engulf: {}, labels: {}, spin: 0 };
const LIFE_SPEEDS = [['0.5×', 0.5], ['1×', 1], ['2×', 2], ['4×', 4]];
function lifeBuild() {
  if (LIFE.built) return; LIFE.built = true;
  LIFE.star = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(1, 0.95, 0.8) }, uTime: { value: 0 }, uGran: { value: 1 } }, vertexShader: `
varying vec3 vN, vP, vV; 
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`, fragmentShader: `
precision highp float; varying vec3 vN, vP, vV; uniform vec3 uColor; uniform float uTime, uGran;
#include <common>
#include <logdepthbuf_pars_fragment>
float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  #include <logdepthbuf_fragment>
  float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float limb = 0.42 + 0.58 * pow(mu, 0.55);
  float g = vn(normalize(vP) * 9.0 + uTime * 0.06) * 0.6 + vn(normalize(vP) * 22.0 - uTime * 0.1) * 0.4;
  vec3 c = uColor * limb * (1.0 + (g - 0.5) * 0.22 * uGran);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}` })); LIFE.star.renderOrder = 4; lifeScene.add(LIFE.star);
  const whiteGlow = radialTex([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,0.6)'], [0.5, 'rgba(255,255,255,0.14)'], [1, 'rgba(255,255,255,0)']], 256);
  for (let i = 0; i < 2; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: whiteGlow, color: 0xffeecc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); sp.renderOrder = 5; lifeScene.add(sp); LIFE.glow.push(sp); }
  // habitable zone annulus (vertex-updated)
  const rg = new THREE.RingGeometry(1, 2, 128, 1); LIFE.hz = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })); LIFE.hz.rotation.x = -Math.PI / 2; LIFE.hz.renderOrder = 0; lifeScene.add(LIFE.hz);
  const ph = new Map(); for (const [id, a, sz] of LIFE_PLANETS) {
    const col = new THREE.Color(BODY[id].color), mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: col })); mesh.renderOrder = 3; lifeScene.add(mesh);
    const pts = []; for (let i = 0; i <= 160; i++) { const t = i / 160 * 6.2832; pts.push(new THREE.Vector3(Math.cos(t), 0, Math.sin(t))); }
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false })); lifeScene.add(line);
    const th0 = ST ? Math.atan2(ST.pos[id][2], ST.pos[id][0]) : Math.random() * 6.28;
    LIFE.objs[id] = { mesh, line, a, sz, th: th0 };
  }
  // planetary-nebula shell
  const nt = radialTex([[0, 'rgba(120,255,230,0)'], [0.55, 'rgba(120,255,230,0)'], [0.72, 'rgba(120,255,230,0.55)'], [0.82, 'rgba(255,140,200,0.35)'], [1, 'rgba(120,200,255,0)']], 256);
  LIFE.neb = new THREE.Sprite(new THREE.SpriteMaterial({ map: nt, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); LIFE.neb.renderOrder = 2; lifeScene.add(LIFE.neb);
  // background stars
  const n = 1600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n); let s = 99;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, th = rnd() * 6.2832, r = Math.sqrt(1 - u * u), R = 900; pos[i * 3] = R * r * Math.cos(th); pos[i * 3 + 1] = R * u; pos[i * 3 + 2] = R * r * Math.sin(th); const b = 0.35 + 0.65 * rnd() * rnd(); col[i * 3] = b; col[i * 3 + 1] = b * 0.95; col[i * 3 + 2] = b; size[i] = 0.7 + rnd() * 1.1; }
  LIFE.bg = cloudPoints({ pos, col, size, n }, 1.6, 0.9); lifeScene.add(LIFE.bg);
  // when each planet is lost: first u at which the star reaches its orbit (Earth also feels tidal drag, so it is lost earlier)
  for (const [id, a, , f] of LIFE_PLANETS) { LIFE.engulf[id] = 9; for (let u = 0; u <= 1; u += 0.0005) { const s2 = lifeState(u); if (s2.RAU >= a / s2.M * f) { LIFE.engulf[id] = u; break; } } }
}
function setLife(on) {
  on = !!on; if (on === LIFE.on) return;
  if (on) {
    lifeBuild(); setHelix(false, { noFly: true }); if (S.cmp) setCompare(false); if (S.view !== 'system') setView('system', { noFly: true }); GV.merge && exitMerge();
    LIFE.on = true; document.body.classList.add('life'); LIFE.u = 0.17; LIFE.playing = false; LIFE.speed = 1; LIFE.yaw = 0.5; LIFE.pitch = 0.75; LIFE.dist = 7; LIFE.tx = LIFE.ty = LIFE.tz = 0; markView();
    S.playing = false; syncPlayUI(); toast('The Sun’s life: drag the strip below (or press play). Distances are square-root scaled.', 5000);
  } else {
    LIFE.on = false; LIFE.playing = false; document.body.classList.remove('life'); for (const k in LIFE.labels) { LIFE.labels[k].style.display = 'none'; LIFE.labels[k]._on = false; } markView(); syncPlayUI();
  }
  lifeBarSetup();
}
function lifeFrame() { LIFE.tween = { t0: performance.now(), dur: 900, from: { yaw: LIFE.yaw, pitch: LIFE.pitch, dist: LIFE.dist, tx: LIFE.tx, ty: LIFE.ty, tz: LIFE.tz }, to: { yaw: LIFE.yaw, pitch: 0.75, dist: LIFE.u > 0.5 && LIFE.u < 0.82 ? 9 : 7, tx: 0, ty: 0, tz: 0 } }; }
function lifeGoto(u) { LIFE.u = Math.max(0, Math.min(1, u)); LIFE.playing = false; syncPlayUI(); }
function lifeBarSetup() {
  const box = $('lifeSteps'); if (!box || box.childElementCount) return;
  const steps = [['Birth', 0], ['Today', 0.17], ['Earth leaves habitable zone · +1.1 Gyr', 0.217], ['Subgiant · +5.4 Gyr', 0.40], ['Red giant · +7.5 Gyr', 0.62], ['Planetary nebula', 0.82], ['White dwarf', 0.95]];
  for (const [n, u] of steps) { const b = document.createElement('button'); b.textContent = n.split(' · ')[0]; b.title = n; b.dataset.u = u; b.addEventListener('click', () => { lifeGoto(+u); lifeFrame(); }); box.appendChild(b); }
  $('lifeExit').addEventListener('click', () => setLife(false));
}
const lifeLab = (key, text, cls, pos, ox, oy, show) => placeLabelCam(lifeLabel(key, text, cls), pos, ox, oy, show, lifeCam);
function lifeLabel(key, text, cls) { let el = LIFE.labels[key]; if (!el) { el = document.createElement('div'); el.className = 'lbl gal ' + (cls || ''); el.textContent = text; $('labels').appendChild(el); LIFE.labels[key] = el; } else if (text && el.textContent !== text) el.textContent = text; return el; }
function updateLife(dt, now) {
  lifeBuild();
  if (LIFE.playing) { const rate = LIFE.u > 0.60 && LIFE.u < 0.87 ? 0.010 : 0.025; LIFE.u += LIFE.speed * rate * dt; if (LIFE.u >= 1) { LIFE.u = 1; LIFE.playing = false; syncPlayUI(); } if (LIFE.u <= 0) { LIFE.u = 0; if (LIFE.speed < 0) { LIFE.playing = false; syncPlayUI(); } } }
  const s = lifeState(LIFE.u); LIFE.st = s;
  // star
  const rStar = Math.max(lifeDisp(s.RAU), 0.0035), c = bbColor(s.T), warm = s.T < 6500 ? [1, 0.93, 0.78] : [1, 1, 1], col = [c[0] * warm[0], c[1] * warm[1], c[2] * warm[2]];
  if (s.T < 5200) { const mean = (col[0] + col[1] + col[2]) / 3, k = 1 + (5200 - s.T) / 1500; for (let i = 0; i < 3; i++) col[i] = Math.max(0, mean + (col[i] - mean) * k); }   // cool stars look redder than the simple blackbody tint
  LIFE.star.scale.setScalar(rStar); LIFE.star.material.uniforms.uColor.value.setRGB(col[0] * 0.95, col[1] * 0.95, col[2] * 0.95); LIFE.star.material.uniforms.uTime.value = now / 1000; LIFE.star.material.uniforms.uGran.value = s.R > 0.2 ? 1 : 0;
  const lum = Math.log10(Math.max(1e-3, s.L)); const gs = rStar * 2.6 + 0.16 + 0.05 * Math.max(0, lum + 1);
  LIFE.glow[0].scale.setScalar(gs); LIFE.glow[1].scale.setScalar(gs * 2.6); for (const g of LIFE.glow) g.material.color.setRGB(col[0], col[1], col[2]);
  LIFE.glow[0].material.opacity = rStar > 0.5 ? 0.35 : 0.85; LIFE.glow[1].material.opacity = Math.min(0.4, 0.10 + 0.05 * Math.max(0, lum + 1));
  // habitable zone
  const pos = LIFE.hz.geometry.getAttribute('position'), rin = lifeDisp(s.hzIn / 1), rout = lifeDisp(s.hzOut), nseg = 128;
  for (let i = 0; i <= nseg; i++) { const t = i / nseg * 6.2832, cx = Math.cos(t), sy = Math.sin(t); pos.setXYZ(i, rin * cx, rin * sy, 0); pos.setXYZ(nseg + 1 + i, rout * cx, rout * sy, 0); }
  pos.needsUpdate = true; LIFE.hz.visible = s.L > 0.05;
  // planets
  const omegaE = 6.2832 / 0.9;
  for (const [id, a0, , f] of LIFE_PLANETS) {
    const o = LIFE.objs[id], a = a0 / s.M, rd = lifeDisp(a), gone = LIFE.u >= LIFE.engulf[id];
    o.th += omegaE * Math.sqrt(s.M / (a * a * a)) * dt * 0.35; const r = rd;
    o.mesh.position.set(Math.cos(o.th) * r, 0, Math.sin(o.th) * r); o.mesh.scale.setScalar(o.sz * (id === 'Earth' ? 1 : 1)); o.mesh.visible = !gone;
    o.line.scale.setScalar(r); o.line.material.opacity = gone ? 0.08 : 0.35;
    const inHz = a >= s.hzIn && a <= s.hzOut;
    if (id === 'Earth' && !gone) o.mesh.material.color.set(inHz ? 0x58c0ff : (a < s.hzIn ? 0xff8a5a : 0xcfe3ff));
    lifeLab('lf' + id, id + (gone ? ' — swallowed' : id === 'Earth' && !inHz && s.t > 0 ? (a < s.hzIn ? ' — too hot' : ' — frozen') : ''), gone ? 'drift' : 'mk', o.mesh.position, 8, -6, !gone || LIFE.u - LIFE.engulf[id] < 0.2);
    if (gone) { const el = lifeLabel('lf' + id); el.style.opacity = 0.55; } else lifeLabel('lf' + id).style.opacity = 1;
  }
  lifeLab('lfSun', s.phase[2] === 'White dwarf' ? 'White dwarf' : 'Sun', 'sun', new THREE.Vector3(0, rStar, 0), 10, -12, true);
  lifeLab('lfHZ', 'habitable zone', 'ring', new THREE.Vector3(rout * 0.7071, 0, rout * 0.7071), 6, 0, s.L > 0.05 && LIFE.dist < 40);
  // planetary nebula shell (expanding while the star is a hot core)
  const pn = (LIFE.u - 0.80) / 0.11; LIFE.neb.material.opacity = pn > 0 && pn < 1 ? Math.sin(pn * Math.PI) * 0.55 : 0; LIFE.neb.scale.setScalar(0.8 + Math.max(0, Math.min(1, pn)) * 10);
  // camera
  const tw = LIFE.tween;
  if (tw) { const k = Math.min(1, (now - tw.t0) / tw.dur), e = ease(k), L = (p, q) => p + (q - p) * e; LIFE.yaw = L(tw.from.yaw, tw.to.yaw); LIFE.pitch = L(tw.from.pitch, tw.to.pitch); LIFE.dist = tw.from.dist * Math.pow(tw.to.dist / tw.from.dist, e); LIFE.tx = L(tw.from.tx, tw.to.tx); LIFE.ty = L(tw.from.ty, tw.to.ty); LIFE.tz = L(tw.from.tz, tw.to.tz); if (k >= 1) LIFE.tween = null; }
  LIFE.dist = Math.max(LIFE.min, Math.min(LIFE.max, LIFE.dist)); const cp = Math.cos(LIFE.pitch);
  lifeCam.position.set(LIFE.tx + Math.sin(LIFE.yaw) * cp * LIFE.dist, LIFE.ty + Math.sin(LIFE.pitch) * LIFE.dist, LIFE.tz + Math.cos(LIFE.yaw) * cp * LIFE.dist);
  lifeCam.up.set(0, 1, 0); lifeCam.lookAt(LIFE.tx, LIFE.ty, LIFE.tz); lifeCam.near = Math.max(LIFE.dist * 0.001, 1e-4); lifeCam.far = 1e4; lifeCam.updateProjectionMatrix(); lifeCam.updateMatrixWorld(true);
  LIFE.bg.material.uniforms.uAlpha.value = 0.9;
}
function lifeFmtT(t) { return t < -0.005 ? (-t).toFixed(2) + ' Gyr ago' : Math.abs(t) < 0.005 ? 'today' : '+' + (t < 0.1 ? t.toFixed(3) : t < 8 ? t.toFixed(2) : t.toFixed(1)) + ' Gyr'; }
function lifeHud() {
  const s = LIFE.st; if (!s) return;
  const Rtxt = s.R >= 0.1 ? `${s.R >= 10 ? Math.round(s.R) : s.R.toFixed(2)} R☉${s.RAU > 0.05 ? ` (${s.RAU.toFixed(2)} AU)` : ''}` : `${s.R.toFixed(3)} R☉ (about ${(s.R * 109).toFixed(1)}× Earth)`;
  $('lifeA').textContent = `${s.phase[2]} · ${lifeFmtT(s.t)}`;
  $('lifeB').innerHTML = `Luminosity <b>${s.L >= 10 ? Math.round(s.L).toLocaleString('en-US') : s.L >= 0.1 ? s.L.toFixed(2) : s.L.toFixed(3)} L☉</b> · radius <b>${Rtxt}</b> · surface <b>${Math.round(s.T).toLocaleString('en-US')} K</b> · mass <b>${s.M.toFixed(2)} M☉</b><br>${s.L > 0.05 ? `Habitable zone <b>${s.hzIn.toFixed(2)}–${s.hzOut.toFixed(2)} AU</b>` : 'No habitable zone any more'}`;
}
function drawLifeStrip() {
  const { w, h, dpr } = tlSizing(); if (!w) return; TL.lastKey = null; const g = TL.canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const X = u => u * w, by = h * 0.3, bh = Math.max(12, h * 0.3), cols = ['#ffd27a', '#ffb454', '#ff7a55', '#ffe9a8', '#e8a15a', '#ff9d6a', '#7fe3d6', '#9fc5ff'];
  g.font = '10px ui-monospace,Consolas,monospace'; g.textBaseline = 'alphabetic';
  LIFE_PHASES.forEach((p, i) => { const u0 = lifeUofT(Math.max(p[0], -4.57)), u1 = lifeUofT(Math.min(p[1], 13)); g.fillStyle = cols[i] + (i === 0 ? 'cc' : 'dd'); g.fillRect(X(u0), by, Math.max(2, X(u1) - X(u0) - 1), bh); if (X(u1) - X(u0) > 62) { g.fillStyle = '#0b1020'; g.fillText(p[2], X(u0) + 4, by + bh * 0.68); } });
  g.fillStyle = '#9fb0cf'; g.fillText('birth', 3, by - 4); g.fillText('today', X(0.17) + 3, by - 4); g.fillText('red giant', X(0.6) - 18, by - 4); g.fillText('white dwarf → cooling for trillions of years', Math.min(w - 230, X(0.87)), by - 4);
  g.fillStyle = '#7d89a3'; for (const t of [-4.57, 0, 5, 7.6, 10]) { const u = lifeUofT(t); g.fillRect(X(u), h - 14, 1, 4); g.fillText(t === -4.57 ? '−4.6 Gyr' : (t > 0 ? '+' : '') + t + ' Gyr', Math.min(w - 52, X(u) + 3), h - 3); }
  g.strokeStyle = '#ffb454'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(LIFE.u), 0); g.lineTo(X(LIFE.u), h); g.stroke(); g.lineWidth = 1;
  if (TL.galHoverX != null && TL.galHover) { const tw = g.measureText(TL.galHover).width + 14, tx = Math.min(w - tw - 4, Math.max(4, TL.galHoverX - tw / 2)); g.fillStyle = 'rgba(8,12,22,.92)'; g.fillRect(tx, by + bh + 4, tw, 18); g.strokeStyle = '#fff3'; g.strokeRect(tx + .5, by + bh + 4.5, tw, 18); g.fillStyle = '#e9eef8'; g.fillText(TL.galHover, tx + 7, by + bh + 17); }
}
function lifeHoverText(u) { const s = lifeState(u); return `${s.phase[2]} · ${lifeFmtT(s.t)}`; }
