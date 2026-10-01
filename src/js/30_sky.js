// ===================== 30_sky.js — ground / sky view from the chosen location =====================
const skyScene = new THREE.Scene();
const skyCam = new THREE.PerspectiveCamera(60, 1, 1, 30000);
skyCam.rotation.order = 'YXZ';
const SKY = { az: 180, alt: 25, fov: 60, info: {}, ready: false, labels: {} };
const SKY_R = 9000, SKY_D = { sun: 8000, moon: 7900, planet: 8200, corona: 7990 };

// ---- sky dome shader (sky + ground haze) ----
const DOME_FS = `
precision highp float;
uniform vec3 uSun; uniform float uL, uTotal, uTwiAmt;
varying vec3 vDir;
#include <common>
#include <logdepthbuf_pars_fragment>
vec3 skyCol(vec3 d){
  float h = clamp(d.y, 0.0, 1.0);
  vec3 sd = uSun;
  float cosg = max(dot(d, sd), 0.0);
  float c2 = cosg * cosg, c4 = c2 * c2, c5 = c4 * cosg, c8 = c4 * c4, c16 = c8 * c8, c32 = c16 * c16, c40 = c32 * c8;
  vec3 zen = vec3(0.045, 0.16, 0.48), hor = vec3(0.34, 0.52, 0.86);
  vec3 day = mix(hor, zen, sqrt(h));
  vec3 night = mix(vec3(0.0040, 0.0068, 0.0190), vec3(0.0006, 0.0012, 0.0045), sqrt(h));
  vec3 col = mix(night, day, uL);
  float tw = smoothstep(-0.32, -0.02, sd.y) * (1.0 - smoothstep(0.05, 0.28, sd.y));
  col += vec3(0.95, 0.38, 0.10) * c5 * exp(-h * 5.5) * tw * 0.75;
  col += vec3(0.30, 0.12, 0.25) * exp(-h * 3.0) * tw * 0.35;
  col += vec3(1.0, 0.85, 0.6) * c40 * 0.35 * uL;
  col += vec3(0.9, 0.42, 0.16) * exp(-h * 15.0) * uTotal * 0.5;
  col += vec3(0.05, 0.10, 0.22) * exp(-h * 4.0) * (1.0 - uL) * 0.35 * (1.0 - tw);
  return col;
}
void main(){
  #include <logdepthbuf_fragment>
  vec3 d = vDir;
  vec3 col;
  if (d.y >= 0.0) col = skyCol(d);
  else {
    vec3 hz = skyCol(vec3(d.x, 0.0, d.z) * inversesqrt(max(d.x * d.x + d.z * d.z, 1e-6)));
    float fog = exp(d.y * 26.0);
    vec3 g = mix(vec3(0.004, 0.005, 0.006), vec3(0.055, 0.062, 0.05), uL) ;
    col = mix(g, hz * 0.8, fog);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const DOME_VS = `
varying vec3 vDir;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
let skyDome, skyStars, skyConst, skyEcl, skyHorizon, sunDisc, sunGlow, sunHalo, corona, diamond, moonMesh, moonMat;
const skyPlanets = {};
const coronaTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const img = g.createImageData(512, 512);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rays = []; for (let i = 0; i < 90; i++) rays.push({ a: rnd() * Math.PI * 2, w: 0.02 + rnd() * 0.07, l: 0.35 + rnd() * 0.65 });
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const dx = (x - 255.5) / 255.5, dy = (y - 255.5) / 255.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let v = 0.0;
    if (r < 1) {
      v = 0.26 / (0.07 + Math.pow(r * 5.0, 2.2));
      let s = 0; for (const ra of rays) { let da = Math.abs(((a - ra.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); da = Math.min(da, Math.PI * 2 - da); s += Math.exp(-(da * da) / (ra.w * ra.w)) * ra.l * Math.exp(-r * 2.2); }
      v += s * 0.35 * Math.min(1, r * 6);
      v *= Math.pow(Math.max(0, 1 - r), 1.4) * (1 + 0.5 * Math.cos(2 * a)); // streamers stretched along the equator
    }
    const k = (y * 512 + x) * 4, b = Math.min(255, v * 255);
    img.data[k] = b; img.data[k + 1] = b * 0.96; img.data[k + 2] = b * 0.92; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function buildSky() {
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 48, 32), new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uL: { value: 0 }, uTotal: { value: 0 }, uTwiAmt: { value: 0 } },
    vertexShader: DOME_VS, fragmentShader: DOME_FS, side: THREE.BackSide, depthWrite: false,
  }));
  skyDome.renderOrder = -20; skyDome.frustumCulled = false; skyScene.add(skyDome);
  skyStars = makeStarPoints(SKY_R * 0.95, 1); skyStars.material.uniforms.uHorizon.value = 1; skyStars.matrixAutoUpdate = false; skyScene.add(skyStars);
  skyConst = buildConstellations(SKY_R * 0.94, 0.28); skyConst.matrixAutoUpdate = false; skyScene.add(skyConst);
  const ecl = []; for (let i = 0; i <= 180; i++) { const a = i / 180 * Math.PI * 2; ecl.push(new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(SKY_R * 0.93)); }
  skyEcl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ecl), new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.22, depthWrite: false }));
  skyEcl.matrixAutoUpdate = false; skyEcl.frustumCulled = false; skyScene.add(skyEcl);
  // Milky Way in sky frame
  const mw = new THREE.Mesh(new THREE.SphereGeometry(SKY_R * 0.97, 48, 32), new THREE.MeshBasicMaterial({ map: tex('milky'), side: THREE.BackSide, color: new THREE.Color(0.55, 0.55, 0.6), depthWrite: false, transparent: true, opacity: 1, blending: THREE.AdditiveBlending }));
  mw.matrixAutoUpdate = false; mw.renderOrder = -15; mw.frustumCulled = false;
  const gal = A.Rotation_GAL_EQJ(), t0 = A.MakeTime(new Date(0));
  const g2s = (x, y, z) => { const v = A.RotateVector(gal, new A.Vector(x, y, z, t0)); return eqj2scene(v.x, v.y, v.z); };
  mw.userData.local = new THREE.Matrix4().makeBasis(new THREE.Vector3(...g2s(1, 0, 0)), new THREE.Vector3(...g2s(0, 0, 1)), new THREE.Vector3(...g2s(0, 1, 0)));
  skyScene.add(mw); SKY.mw = mw;
  // Sun
  sunDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: 0xfff1d0, depthWrite: true, toneMapped: false })); sunDisc.frustumCulled = false; skyScene.add(sunDisc);
  sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 })); sunGlow.renderOrder = 3; skyScene.add(sunGlow);
  sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35, color: 0xffd9a0 })); sunHalo.renderOrder = 3; skyScene.add(sunHalo);
  corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: coronaTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); corona.renderOrder = 2; skyScene.add(corona);
  diamond = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, color: 0xffffff })); diamond.renderOrder = 4; skyScene.add(diamond);
  // Moon
  moonMat = makeLit({ map: 'moon', amb: 0.012, redUmbra: true });
  moonMesh = new THREE.Mesh(geoHi, moonMat); moonMesh.matrixAutoUpdate = false; moonMesh.frustumCulled = false; skyScene.add(moonMesh);
  // planets as glow points
  for (const id of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(BODY[id].color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.renderOrder = 5; skyScene.add(sp); skyPlanets[id] = sp;
  }
  SKY.ready = true;
}
// ---- frame maths ----
const _sk = { cx: [0, 0, 0], cy: [0, 0, 0], cz: [0, 0, 0] };
function skyFromEqj(v) { return [v[0] * _sk.cx[0] + v[1] * _sk.cy[0] + v[2] * _sk.cz[0], v[0] * _sk.cx[1] + v[1] * _sk.cy[1] + v[2] * _sk.cz[1], v[0] * _sk.cx[2] + v[1] * _sk.cy[2] + v[2] * _sk.cz[2]]; }
const eqjFromScene = v => [v3.dot(v, SX), v3.dot(v, SY), v3.dot(v, SZ)];
const skyFromScene = v => skyFromEqj(eqjFromScene(v));
function setSkyFrame(time, obs) {
  const r = A.Rotation_EQJ_HOR(time, obs), t0 = time;
  const f = (x, y, z) => { const h = A.RotateVector(r, new A.Vector(x, y, z, t0)); return [-h.y, h.z, -h.x]; };
  _sk.cx = f(1, 0, 0); _sk.cy = f(0, 1, 0); _sk.cz = f(0, 0, 1);
}
function azAltToDir(az, alt) { const a = az * DEG, e = alt * DEG; return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)]; }
function dirToAzAlt(d) { return { az: ((Math.atan2(d[0], -d[2]) / DEG) + 360) % 360, alt: Math.asin(Math.max(-1, Math.min(1, d[1]))) / DEG }; }
const SM = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const skyLabelLayer = $('labels');
function skyLabel(key, text, cls) {
  let el = SKY.labels[key];
  if (!el) { el = document.createElement('div'); el.className = 'lbl sky ' + (cls || ''); el.textContent = text; skyLabelLayer.appendChild(el); SKY.labels[key] = el; }
  return el;
}
function placeSkyLabel(el, dir, dist, offX, offY, visible) {
  let on = false, x = 0, y = 0;
  if (visible) {
    const v = _lv.set(dir[0], dir[1], dir[2]).multiplyScalar(dist || 100);
    const inFront = _lv2.copy(v).applyMatrix4(skyCam.matrixWorldInverse).z < 0;
    v.project(skyCam);
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    x = (v.x * 0.5 + 0.5) * w + (offX || 6); y = (-v.y * 0.5 + 0.5) * h + (offY || -8);
    on = inFront && x > -40 && x < w + 40 && y > -20 && y < h + 20;
  }
  if (on !== el._on) { el.style.display = on ? 'block' : 'none'; el._on = on; }
  if (on && (Math.abs(x - (el._x || 0)) > 0.4 || Math.abs(y - (el._y || 0)) > 0.4)) { el._x = x; el._y = y; el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; }
}
const _lv = new THREE.Vector3(), _lv2 = new THREE.Vector3();
const CARD = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];

function updateSky(st) {
  if (!SKY.ready) buildSky();
  const time = st.time, obs = mkObs(S.loc.lat, S.loc.lon, S.loc.elev);
  setSkyFrame(time, obs);
  // star group transform: scene-ecl -> sky
  const mx = (v) => new THREE.Vector3(...skyFromScene(v));
  const M = new THREE.Matrix4().makeBasis(mx([1, 0, 0]), mx([0, 1, 0]), mx([0, 0, 1]));
  for (const o of [skyStars, skyConst, skyEcl]) { o.matrix.copy(M); o.matrixWorld.copy(M); }
  const mwM = M.clone().multiply(SKY.mw.userData.local); SKY.mw.matrix.copy(mwM); SKY.mw.matrixWorld.copy(mwM);
  // bodies
  const sun = skyBody('Sun', time, obs), moon = skyBody('Moon', time, obs);
  const sunDir = skyFromEqj(sun.eqj), moonDir = skyFromEqj(moon.eqj);
  const rs = angRadius(BODY.Sun.R, sun.distAU), rm = angRadius(BODY.Moon.R, moon.distAU);
  const sep = Math.atan2(v3.len(v3.cross(sun.eqj, moon.eqj)), v3.dot(sun.eqj, moon.eqj));
  const obsc = discCoverFrac(rs, rm, sep), mag = Math.max(0, (rs + rm - sep) / (2 * rs));
  // daylight
  const sunAlt = sun.alt;
  const dayLuma = SM(-12, 1.5, sunAlt);
  const E = clamp(1 + Math.log10(Math.max(1 - obsc, 1e-4)) / 3.0, 0, 1); // perceived brightness ~ log of illuminance
  const L = dayLuma * E;
  const total = SM(0.985, 1.0, obsc) * SM(-6, 3, sunAlt);
  const U = skyDome.material.uniforms;
  U.uSun.value.set(sunDir[0], sunDir[1], sunDir[2]); U.uL.value = L; U.uTotal.value = total;
  skyStars.material.uniforms.uScale.value = Math.max(0.9, Math.min(2.2, 60 / SKY.fov)) * Math.min(1.3, Math.max(0.8, renderer.domElement.clientHeight / 900));
  skyConst.visible = S.tg.constellations; skyEcl.visible = S.tg.orbits;
  SKY.mw.material.opacity = 1 - SM(0.0, 0.25, L) ; SKY.mw.visible = SKY.mw.material.opacity > 0.02;
  // Sun
  const sd = new THREE.Vector3(...sunDir), rSun = SKY_D.sun * Math.tan(rs);
  sunDisc.position.copy(sd).multiplyScalar(SKY_D.sun); sunDisc.scale.setScalar(rSun); sunDisc.lookAt(0, 0, 0);
  const warm = SM(0, 22, sunAlt);
  sunDisc.material.color.setRGB(1.0, 0.55 + 0.42 * warm, 0.22 + 0.7 * warm);
  sunDisc.visible = sunAlt > -2;
  const lite = 1 - obsc; // glow dims as the Sun is covered
  sunGlow.position.copy(sd).multiplyScalar(SKY_D.sun * 0.998); sunGlow.scale.setScalar(rSun * 22); sunGlow.material.opacity = 0.85 * Math.pow(lite, 1.2) * SM(-3, 4, sunAlt);
  sunHalo.position.copy(sunGlow.position); sunHalo.scale.setScalar(rSun * 90); sunHalo.material.opacity = 0.28 * Math.pow(lite, 1.5) * SM(-3, 4, sunAlt);
  // corona + diamond ring (only physically when Moon covers the whole Sun disc or nearly)
  corona.position.copy(sd).multiplyScalar(SKY_D.corona); corona.scale.setScalar(rSun * 11); corona.material.opacity = SM(0.9985, 1.0, obsc) * (rm >= rs * 0.995 ? 1 : 0.0) * SM(-2, 3, sunAlt);
  const gapBright = SM(0.93, 0.9985, obsc) * (1 - SM(0.99955, 0.99995, obsc)) * SM(-2, 3, sunAlt) * (rm >= rs * 0.995 ? 1 : 0.35);
  const mDir = new THREE.Vector3(...moonDir), toSun = sd.clone().sub(mDir.clone()).normalize();
  const limbP = sd.clone().multiplyScalar(SKY_D.sun).add(toSun.clone().multiplyScalar(rSun * 0.97));
  diamond.position.copy(limbP).multiplyScalar(0.999); diamond.scale.setScalar(rSun * (2.5 + 14 * gapBright)); diamond.material.opacity = Math.min(1, gapBright * 1.4);
  // Moon (lit shader with Earth occluder -> real lunar eclipse colouring)
  const rMoonMesh = SKY_D.moon * Math.tan(rm), mp = mDir.clone().multiplyScalar(SKY_D.moon);
  const ax = moonAxes(time, st.moonGeoKm), axS = { x: skyFromScene(ax.x), y: skyFromScene(ax.y), z: skyFromScene(ax.z) };
  setBasisMatrix(moonMesh, axS, rMoonMesh, mp, 'sphere');
  const mu = moonMat.uniforms, sunFromMoon = skyFromScene(v3.mul(st.pos.Moon, -1)), dSM = v3.len(st.pos.Moon);
  mu.uSunDir.value.set(sunFromMoon[0] / dSM, sunFromMoon[1] / dSM, sunFromMoon[2] / dSM); mu.uSunDist.value = dSM; mu.uBodyR.value = BODY.Moon.R; mu.uVisR.value = rMoonMesh; mu.uCenter.value.copy(mp);
  const er = skyFromScene(v3.sub(st.pos.Earth, st.pos.Moon)); mu.uOcc.value[0].set(er[0], er[1], er[2], BODY.Earth.R * 1.02); for (let i = 1; i < 4; i++) mu.uOcc.value[i].set(0, 0, 0, 0);
  // planets (positions refreshed at a rate matched to the zoom; magnitudes once per day)
  const labelsOn = S.tg.labels, thr = clamp(SKY.fov * 400, 150, 20000);
  if (!SKY.plT || Math.abs(st.tms - SKY.plT) > thr || SKY.plLoc !== S.loc.lat + ',' + S.loc.lon) {
    SKY.plT = st.tms; SKY.plLoc = S.loc.lat + ',' + S.loc.lon;
    const needMag = !SKY.magT || Math.abs(st.tms - SKY.magT) > MS_DAY; if (needMag) SKY.magT = st.tms;
    for (const id in skyPlanets) {
      const p = skyBody(id, time, obs); let m = SKY.mags && SKY.mags[id]; if (needMag || m == null) { const il = illum(id, time); m = il ? il.mag : 6; (SKY.mags = SKY.mags || {})[id] = m; }
      SKY.info[id] = { alt: p.alt, az: p.az, mag: m, eqj: p.eqj };
    }
  }
  const lim = 7.2 - 13 * Math.pow(Math.max(L, 0), 0.38);
  skyStars.material.uniforms.uLim.value = lim;
  for (const id in skyPlanets) {
    const sp = skyPlanets[id], pi = SKY.info[id], d = skyFromEqj(pi.eqj), m = pi.mag;
    const sizeDeg = Math.max(0.14, Math.min(1.1, 0.55 + (1.2 - m) * 0.17));
    sp.position.set(d[0], d[1], d[2]).multiplyScalar(SKY_D.planet); sp.scale.setScalar(SKY_D.planet * Math.tan(sizeDeg * DEG) * 2);
    const vis = m < lim + 0.3 ? 1 : 0;
    sp.material.opacity = Math.min(1, 0.25 + 0.2 * (lim - m)) * vis; sp.visible = vis > 0;
    pi.dir = d; pi.vis = vis > 0;
  }
  // camera
  skyCam.rotation.set(SKY.alt * DEG, -SKY.az * DEG, 0, 'YXZ'); skyCam.fov = SKY.fov; skyCam.updateProjectionMatrix(); skyCam.updateMatrixWorld(true);
  // info for HUD
  Object.assign(SKY.info, { sunAlt, sunAz: sun.az, moonAlt: moon.alt, moonAz: moon.az, obsc, mag, sep, rs, rm, L, lim, sunDir, moonDir, total });
  SKY.info.lunar = sep > 2.3 ? lunarEclipseNow(time) : { umbMag: -9, penMag: -9, behind: false };
  // labels (skip when nothing moved)
  const lk = [SKY.az.toFixed(2), SKY.alt.toFixed(2), SKY.fov.toFixed(2), Math.round(st.tms / 2000), labelsOn, S.tg.constellations, S.view].join('|');
  if (lk === SKY.lblKey) return; SKY.lblKey = lk;
  for (const [n, az] of CARD) { const el = skyLabel('c' + n, n, 'card'); placeSkyLabel(el, azAltToDir(az, 1.2), 100, -6, -10, S.view === 'sky'); }
  const sunEl = skyLabel('Sun', 'Sun', 'body'), moonEl = skyLabel('Moon', 'Moon', 'body');
  placeSkyLabel(sunEl, sunDir, 100, 14, 6, S.view === 'sky' && labelsOn && sunAlt > -2);
  placeSkyLabel(moonEl, moonDir, 100, 14, 6, S.view === 'sky' && labelsOn && moon.alt > -1);
  for (const id in skyPlanets) { const el = skyLabel(id, id, 'body'); placeSkyLabel(el, SKY.info[id].dir, 100, 8, -6, S.view === 'sky' && labelsOn && SKY.info[id].vis && SKY.info[id].alt > -1); }
  // star + constellation names
  const showNames = S.tg.constellations || (labelsOn && SKY.fov < 50);
  if (!SKY.sn) { SKY.sn = STAR_NAMES.filter(s => s[2] <= 1.6).map((s, i) => ({ el: null, i, s, dirE: starDirEqj(s[0], s[1]) })); SKY.snYrs = null; }
  if (SKY.snYrs !== starYrs) { SKY.snYrs = starYrs; for (const o of SKY.sn) o.dirE = starDirAt(o.s, starYrs); }
  for (const o of SKY.sn) {
    const el = o.el || (o.el = skyLabel('s' + o.i, o.s[3], 'star'));
    const d = skyFromScene(o.dirE), a = d[1] > 0.02 && lim > o.s[2];
    placeSkyLabel(el, d, 100, 6, -4, S.view === 'sky' && showNames && a);
  }
  if (!SKY.cn) SKY.cn = CONSTS.map((c, i) => ({ c, i, el: null, dirE: starDirEqj(c.ra, c.dec) }));
  for (const o of SKY.cn) {
    const el = o.el || (o.el = skyLabel('k' + o.i, o.c.name, 'const'));
    const d = skyFromScene(o.dirE);
    placeSkyLabel(el, d, 100, -20, 0, S.view === 'sky' && S.tg.constellations && d[1] > 0.03 && lim > 3);
  }
  // meteor radiants
  if (!SKY.mt) SKY.mt = METEORS.map((m, i) => ({ m, el: skyLabel('m' + i, '✶ ' + m.name + ' radiant', 'meteor'), dirE: starDirEqj(m.ra, m.dec) }));
  const yr = new Date(st.tms).getUTCFullYear();
  for (const o of SKY.mt) {
    const near = [yr - 1, yr, yr + 1].some(y => Math.abs(meteorPeak(o.m, y) - st.tms) < 3.5 * MS_DAY);
    const d = skyFromScene(o.dirE); placeSkyLabel(o.el, d, 100, 6, -4, S.view === 'sky' && near && d[1] > 0 && labelsOn && lim > 3);
  }
}
function aimSky(which) {
  const i = SKY.info; if (!i.sunDir) return;
  const d = which === 'sun' ? i.sunDir : which === 'moon' ? i.moonDir : azAltToDir(which === 'north' ? 0 : which === 'east' ? 90 : which === 'west' ? 270 : 180, 28);
  const a = dirToAzAlt(d); SKY.az = a.az; SKY.alt = a.alt;
  if (which === 'sun' || which === 'moon') SKY.fov = Math.min(SKY.fov, 8);
}
