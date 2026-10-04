// ===================== 26_helix.js — the Sun's motion through the Galaxy: planets (and the Moon) trace corkscrews behind the Sun =====================
// The Sun carries the whole system at ~245 km/s around the Galactic Centre. In the Sun's rest frame planets circle it; in the Galaxy's frame
// each planet traces a helix whose axis is the Sun's path. Trails are static curves in the inertial (Galaxy) frame; the Sun moves along them.
const HX = { on: false, span: 12, K: 18, u: null, speedKms: 245, l: 0, b: 0, lines: {}, tA: null, key: '', moonSpread: -1, group: new THREE.Group(), arrow: null, tip: null, label: null };
scene.add(HX.group);
const HX_BODIES = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Moon'];
const HX_COLOR = { Mercury: '#c9bfb5', Venus: '#f0d79e', Earth: '#58c0ff', Mars: '#ff7a55', Jupiter: '#e8c79c', Saturn: '#f0dea8', Uranus: '#9ef0f6', Neptune: '#7f98ff', Pluto: '#d6c4b0', Moon: '#ffffff' };
const YR_MS = 365.25 * MS_DAY;

function hxInit() {
  if (HX.u) return;
  const o = sunOrbit(), i = Math.round(-o.tMin / o.dt), v = [o.vx[i], o.vy[i], o.vz[i]];       // kpc/Myr, galaxy frame
  const xg = -v[0], yg = v[2], zg = v[1];                                                       // -> galactic Xg,Yg,Zg
  const rot = A.Rotation_GAL_EQJ(), e = A.RotateVector(rot, new A.Vector(xg, yg, zg, A.MakeTime(new Date(0))));
  const sc = eqj2scene(e.x, e.y, e.z), n = v3.norm(sc);
  HX.u = new THREE.Vector3(n[0], n[1], n[2]); HX.speedKms = Math.hypot(v[0], v[1], v[2]) / GM.kms;
  HX.l = ((Math.atan2(yg, xg) * 180 / Math.PI) + 360) % 360; HX.b = Math.asin(zg / Math.hypot(xg, yg, zg)) * 180 / Math.PI;
  HX.auPerYr = HX.speedKms * 3.15576e7 / AU_KM;
  const lbl = document.createElement('div'); lbl.className = 'lbl helix'; lbl.style.display = 'none'; $('labels').appendChild(lbl); HX.label = lbl;
  const arrowMat = new THREE.LineBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.9, depthWrite: false });
  HX.arrow = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), HX.u.clone()]), arrowMat); HX.arrow.frustumCulled = false; HX.arrow.renderOrder = 6; HX.group.add(HX.arrow);
  HX.tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 14), new THREE.MeshBasicMaterial({ color: 0xffd58a, depthWrite: false })); HX.tip.frustumCulled = false; HX.tip.renderOrder = 6; HX.group.add(HX.tip);
}
const HX_VS = `
attribute float aT; varying float vA; uniform float uNow, uL, uPx;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  float d = uNow - aT;
  vA = d >= 0.0 ? exp(-d / uL) : 0.32 * exp(d / (uL * 0.6));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const HX_FS = `
precision highp float; varying float vA; uniform vec3 uColor; uniform float uGain;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(uColor * uGain, clamp(vA, 0.0, 1.0));
  #include <colorspace_fragment>
}`;
function hxK() { return S.trueScale ? HX.speedKms * 3.15576e7 * TRUE_UNIT : HX.K; }        // world units per Julian year of Sun travel
function hxMakeLine(id) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)); g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(1), 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uNow: { value: 0 }, uL: { value: 8 }, uPx: { value: 1 }, uColor: { value: new THREE.Color(HX_COLOR[id]) }, uGain: { value: id === 'Earth' ? 1.5 : id === 'Moon' ? 1.1 : 1.0 } }, vertexShader: HX_VS, fragmentShader: HX_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const l = new THREE.Line(g, m); l.frustumCulled = false; l.renderOrder = 3; HX.group.add(l); return (HX.lines[id] = l);
}
function hxBuild(tms) {
  hxInit();
  const K = hxK(), span = HX.span, u = HX.u, moonSp = spreadFactor('Earth');
  HX.tA = tms; HX.key = [HX.span, HX.K, S.trueScale].join('|'); HX.moonSpread = moonSp;
  for (const id of HX_BODIES) {
    const isMoon = id === 'Moon', per = isMoon ? 0.0748 : PERIOD_DAYS[id] / 365.25, sp = isMoon ? Math.min(span, 4) : span;
    const n = Math.max(160, Math.min(isMoon ? 3600 : 2600, Math.ceil(2 * sp / per * (isMoon ? 22 : 28))));
    const pos = new Float32Array(n * 3), aT = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const dy = -sp + 2 * sp * i / (n - 1), t = tms + dy * YR_MS, tm = timeOf(t);
      let w;
      if (isMoon) {
        const e = helioToWorld(vecAU2scene(A.HelioVector(A.Body.Earth, tm))), m = offsetToWorld('Earth', vecAU2scene(A.GeoMoon(tm)), true);
        w = [e[0] + m[0] * moonSp, e[1] + m[1] * moonSp, e[2] + m[2] * moonSp];
      } else w = helioToWorld(vecAU2scene(A.HelioVector(A.Body[id], tm)));
      pos[i * 3] = w[0] + u.x * K * dy; pos[i * 3 + 1] = w[1] + u.y * K * dy; pos[i * 3 + 2] = w[2] + u.z * K * dy; aT[i] = dy;
    }
    const l = HX.lines[id] || hxMakeLine(id);
    l.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); l.geometry.setAttribute('aT', new THREE.BufferAttribute(aT, 1)); l.geometry.computeBoundingSphere();
    l.material.uniforms.uL.value = Math.max(1.5, span * 0.75);
  }
  const L = Math.max(20, span * K * 0.4); HX.arrowLen = L;
  HX.arrow.geometry.setFromPoints([new THREE.Vector3(), u.clone().multiplyScalar(L)]);
}
function hxUpdate(st, origin) {
  const vis = HX.on && S.view !== 'sky' && S.view !== 'galaxy';
  HX.group.visible = vis; if (HX.label) HX.label.style.display = 'none';
  if (!vis) return;
  hxInit();
  const keyNow = [HX.span, HX.K, S.trueScale].join('|'), yrs = HX.tA == null ? 1e9 : (st.tms - HX.tA) / YR_MS;
  if (keyNow !== HX.key || Math.abs(yrs) > HX.span * 0.45 || Math.abs(spreadFactor('Earth') - HX.moonSpread) > 0.12) hxBuild(st.tms);
  const now = (st.tms - HX.tA) / YR_MS, K = hxK(), u = HX.u;
  const px = -u.x * K * now - origin[0], py = -u.y * K * now - origin[1], pz = -u.z * K * now - origin[2];
  for (const id of HX_BODIES) { const l = HX.lines[id]; if (!l) continue; l.position.set(px, py, pz); l.material.uniforms.uNow.value = now; l.visible = id !== 'Moon' || S.tg.moons; }
  // arrow from the Sun along its direction of travel
  const sun = OB.Sun.pos, L = HX.arrowLen || 40;
  HX.arrow.position.set(sun.x, sun.y, sun.z);
  const tip = new THREE.Vector3(sun.x + u.x * L, sun.y + u.y * L, sun.z + u.z * L), s = Math.max(0.5, L / 22);
  HX.tip.position.copy(tip); HX.tip.scale.setScalar(s); HX.tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
  if (S.tg.labels) {
    projectToScreen(tip, _scr); const behind = _v.copy(tip).applyMatrix4(camera.matrixWorldInverse).z > 0;
    if (!behind && _scr.x > -80 && _scr.x < innerWidth + 80) { HX.label.style.display = 'block'; HX.label.style.transform = `translate(${(_scr.x + 14).toFixed(0)}px,${(_scr.y - 10).toFixed(0)}px)`; HX.label.innerHTML = `Sun’s path through the Galaxy · ${HX.speedKms.toFixed(0)} km/s<br><small>toward Galactic l ${HX.l.toFixed(0)}°, b ${HX.b.toFixed(0)}° (Cygnus) · ${HX.auPerYr.toFixed(0)} AU every year</small>`; }
  }
}
function hxPitchNote() { // honest scale statement for the UI
  const earthR = S.trueScale ? 1 : EXPL.dist(1), pitch = S.trueScale ? HX.auPerYr : hxK(), real = HX.auPerYr / 1.0;
  return S.trueScale ? 'True scale: Earth’s corkscrew is ' + HX.auPerYr.toFixed(0) + ' AU long per turn but only 1 AU wide — so it looks like a nearly straight line with a tiny wiggle.'
    : `Stretch is exaggerated for visibility: here one turn is ${(pitch / earthR).toFixed(1)}× the orbit’s radius; in reality it is ${real.toFixed(0)}× (${HX.auPerYr.toFixed(0)} AU long, 1 AU wide).`;
}
function hxFrame() { // camera that sees the corkscrews side-on, Sun leading to the right
  hxInit();
  const yaw = Math.atan2(-HX.u.z, HX.u.x);
  flyTo({ focus: 'Sun', dist: S.trueScale ? hxK() * HX.span * 0.7 : 150 + HX.span * HX.K * 0.25, pitch: 0.32, yaw, dur: 2200 });
}
// side-by-side explainer: left = textbook flat view (Sun at rest), right = the same moment with the Sun's real motion drawn as helices
function setCompare(on) {
  const okSys = S.view === 'system' && HX.on && !LIFE.on, okGal = S.view === 'galaxy' && !GV.merge;
  on = !!on && (okSys || okGal); S.cmp = on; S.cmpView = on ? S.view : null;
  document.body.classList.toggle('cmp', on); if (S.cmpX == null) S.cmpX = 0.5; $('cmpDiv').style.left = (S.cmpX * 100) + '%';
  for (const id of ['hxCmp', 'gCmp']) { const b = $(id); if (b) { b.classList.toggle('on', on); b.textContent = on ? '✕ End comparison' : '⇄ Compare ' + (id === 'gCmp' ? 'flat vs helix' : 'with flat view'); } }
  if (on) {
    const gal = S.view === 'galaxy';
    $('cmpL').textContent = gal ? 'Flat view · the Galaxy stands still; the Sun simply circles it' : 'Flat view · the Sun stands still (the textbook picture)';
    $('cmpR').textContent = gal ? `Real motion · the Galaxy itself drifts ≈ ${galDrift ? galDrift.speed.toFixed(0) : 560} km/s, so the Sun’s path is a helix` : 'Real motion · the Sun carries the system at 246 km/s';
    if (gal) { GV.follow = false; GV.drift = false; galFly({ yaw: helixYaw(), pitch: 0.4, dist: 150, tx: 0, ty: 0, tz: 0, dur: 1600 }); if (!GV.playing) { GV.playing = true; GV.speed = Math.abs(GV.speed) || 60; } syncPlayUI(); }
  } else { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); galCam.aspect = innerWidth / innerHeight; galCam.updateProjectionMatrix(); if (S.view === 'galaxy' && GV.ready) galApplyPath(); }
  if (typeof setGuide === 'function' && document.body.classList.contains('guide')) { if (on) { setCompare.wasMin = document.body.classList.contains('min'); setGuide(true, true); } else if (setCompare.wasMin === false) { setGuide(true, false); setCompare.wasMin = null; } }
}
function setHelix(on, opts = {}) {
  HX.on = !!on; if (on) hxInit();
  const chip = document.querySelector('[data-tg="helix"]'); if (chip) chip.classList.toggle('on', HX.on);
  document.body.classList.toggle('hx', HX.on); if (!HX.on && S.cmp) setCompare(false);
  if ($('hxBar')) $('hxBar').style.display = HX.on && S.view !== 'sky' && S.view !== 'galaxy' ? 'flex' : 'none';
  if (HX.on && !opts.noFly) {
    if (S.view === 'sky' || S.view === 'galaxy') setView('system', { noFly: true });
    S.view = 'system'; markView(); hxFrame();
    if (!opts.noPlay) { S.live = false; S.playing = true; S.speed = 2629800; S.dir = 1; syncPlayUI(); }
  }
  scheduleHash();
}
