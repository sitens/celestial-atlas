// ===================== 36_galaxy_far.js — from the Milky Way outward: satellites, the Local Group, the Laniakea flow =====================
// Units here are kpc (same as the galaxy scene). Objects use catalogue positions (galactic l,b,d from the Sun) relative to the Sun's present position.
const FAR = { built: false, lg: new THREE.Group(), lan: new THREE.Group(), items: [], lanLabels: [], beads: null, streams: [], ga: null, center: null, sun0: null, m31: null, art: null, rot: null, mwMark: null, arrowLG: null, arrowM31: null };
const KPC_MPC = 1000;
function farTexture(type, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const rnd = mulberry32(seed);
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.globalCompositeOperation = 'lighter';
  const blob = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); };
  if (type === 'spiral') {
    blob(128, 128, 120, 'rgba(120,150,255,A)', 0.18); blob(128, 128, 46, 'rgba(255,214,160,A)', 0.8);
    for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 520; i++) { const t = i / 520, th = t * 9 + arm * Math.PI, r = 14 + t * 105, x = 128 + Math.cos(th) * r + (rnd() - 0.5) * 13, y = 128 + Math.sin(th) * r * 0.9 + (rnd() - 0.5) * 11; blob(x, y, 3 + rnd() * 5, rnd() < 0.25 ? 'rgba(255,150,170,A)' : 'rgba(170,200,255,A)', 0.24 + 0.2 * rnd()); }
    blob(128, 128, 18, 'rgba(255,245,225,A)', 0.95);
  } else if (type === 'ell') { blob(128, 128, 90, 'rgba(255,200,140,A)', 0.55); blob(128, 128, 36, 'rgba(255,230,190,A)', 0.9); }
  else if (type === 'dsph') { blob(128, 128, 110, 'rgba(210,200,170,A)', 0.2); blob(128, 128, 50, 'rgba(230,220,190,A)', 0.4); }
  else { blob(128, 128, 110, 'rgba(150,185,255,A)', 0.16); for (let i = 0; i < 70; i++) blob(70 + rnd() * 120, 80 + rnd() * 100, 8 + rnd() * 20, rnd() < 0.3 ? 'rgba(255,160,180,A)' : 'rgba(190,215,255,A)', 0.22); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function farVec(l, b, d, scaleKpc) { const v = lbToXYZ(l, b, d * scaleKpc); return new THREE.Vector3(v[0] + FAR.sun0.x, v[1] + FAR.sun0.y, v[2] + FAR.sun0.z); }
function buildFar() {
  if (FAR.built) return; FAR.built = true;
  const s0 = sunAt(0); FAR.sun0 = new THREE.Vector3(s0.x, s0.y, s0.z);
  // Milky Way pattern group (art disc + procedural stars rotate rigidly at the spiral pattern speed)
  FAR.rot = new THREE.Group(); galScene.add(FAR.rot); galScene.remove(galPoints); FAR.rot.add(galPoints);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(FAR_ART_KPC, FAR_ART_KPC), new THREE.MeshBasicMaterial({ map: tex('mwArt'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, side: THREE.DoubleSide, color: 0xffffff }));
  art.geometry.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)));
  art.renderOrder = -3; art.frustumCulled = false; FAR.rot.add(art); FAR.art = art;
  // Milky Way marker for far scales
  const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: farTexture('spiral', 5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); mk.renderOrder = 3; galScene.add(mk); FAR.mwMark = mk;
  // Local Group + satellites
  galScene.add(FAR.lg);
  for (const o of LOCAL_GROUP) {
    const pos = farVec(o.l, o.b, o.d, 1), tex = farTexture(o.type, (o.n.length * 97) | 0);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95 })); sp.position.copy(pos); sp.renderOrder = 3;
    FAR.lg.add(sp); FAR.items.push({ o, pos, sp }); if (o.vr) FAR.m31 = pos;
  }
  // arrows: Milky Way <-> Andromeda approach; Local Group motion toward the Great Attractor
  const mkArrow = (col) => { const g = new THREE.Group(); const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthTest: false })); ln.renderOrder = 7; const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 12), new THREE.MeshBasicMaterial({ color: col, depthTest: false })); cone.renderOrder = 7; g.add(ln, cone); g.userData = { ln, cone }; galScene.add(g); return g; };
  FAR.arrowM31 = mkArrow(0x9cffd0); FAR.arrowLG = mkArrow(0xffd58a);
  // Laniakea
  galScene.add(FAR.lan);
  const rnd = mulberry32(2024), gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) * 1.732; };
  const nodes = LANIAKEA.map(o => ({ o, pos: farVec(o.l, o.b, o.d, KPC_MPC) })); FAR.nodes = nodes;
  const ga = nodes.find(n => n.o.ga).pos; FAR.ga = ga; FAR.center = ga.clone().multiplyScalar(0.9).add(FAR.sun0.clone().multiplyScalar(0.1));
  const N = 22000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N); let k = 0;
  const put = (p, r, g, b, s) => { if (k >= N) return; pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b; size[k] = s; k++; };
  for (const n of nodes) { const cnt = Math.round(1800 * n.o.w), sg = n.o.r * KPC_MPC * 0.55; for (let i = 0; i < cnt; i++) put(new THREE.Vector3(n.pos.x + gauss() * sg, n.pos.y + gauss() * sg * 0.8, n.pos.z + gauss() * sg), 1.0, 0.82 + 0.1 * rnd(), 0.6 + 0.2 * rnd(), 1.2 + rnd() * 1.4); }
  const inside = nodes.filter(n => !n.o.outside).map(n => n.pos), origin = FAR.sun0.clone(); inside.push(origin);
  for (let i = 0; i < inside.length; i++) for (let j = i + 1; j < inside.length; j++) { const a = inside[i], b = inside[j], dist = a.distanceTo(b); if (dist > 90 * KPC_MPC) continue; const cnt = Math.round(dist / KPC_MPC * 30), mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(4 * KPC_MPC)); for (let q = 0; q < cnt; q++) { const t = q / cnt, p = a.clone().multiplyScalar((1 - t) * (1 - t)).add(mid.clone().multiplyScalar(2 * t * (1 - t))).add(b.clone().multiplyScalar(t * t)); p.add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(2.4 * KPC_MPC)); put(p, 0.62, 0.74, 1.0, 0.9 + rnd() * 0.9); } }
  while (k < N) { const p = new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(70 * KPC_MPC).add(FAR.center); put(p, 0.55, 0.62, 0.9, 0.8 + rnd() * 0.8); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uPx: { value: renderer.getPixelRatio() }, uK: { value: 1.5 }, uAlpha: { value: 0.55 } }, vertexShader: GAL_VS, fragmentShader: GAL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; FAR.lan.add(pts); FAR.lanPts = pts;
  // flow streamlines converging on the Great Attractor + moving beads
  const NS = 80, seg = 40, lp = new Float32Array(NS * seg * 2 * 3), lc = new Float32Array(NS * seg * 2 * 3);
  FAR.streams = [];
  for (let i = 0; i < NS; i++) {
    const u = rnd() * 2 - 1, th = rnd() * 6.2832, rr = Math.sqrt(1 - u * u), dir = new THREE.Vector3(rr * Math.cos(th), u, rr * Math.sin(th)), R = (62 + 22 * rnd()) * KPC_MPC;
    const a = FAR.center.clone().add(dir.multiplyScalar(R)), b = ga.clone().add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(3 * KPC_MPC)), c = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(14 * KPC_MPC));
    FAR.streams.push({ a, b, c });
    for (let s = 0; s < seg; s++) for (let e = 0; e < 2; e++) { const t = (s + e) / seg, p = a.clone().multiplyScalar((1 - t) * (1 - t)).add(c.clone().multiplyScalar(2 * t * (1 - t))).add(b.clone().multiplyScalar(t * t)), idx = ((i * seg + s) * 2 + e) * 3, f = 0.25 + 0.75 * t; lp[idx] = p.x; lp[idx + 1] = p.y; lp[idx + 2] = p.z; lc[idx] = 0.35 * f; lc[idx + 1] = 0.85 * f; lc[idx + 2] = 1.0 * f; }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); ls.frustumCulled = false; FAR.lan.add(ls);
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3 * 3), 3)); bg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NS * 3 * 3), 3)); bg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(NS * 3).fill(3), 1));
  FAR.beads = new THREE.Points(bg, new THREE.ShaderMaterial({ uniforms: { uPx: { value: renderer.getPixelRatio() }, uK: { value: 1.8 }, uAlpha: { value: 1 } }, vertexShader: GAL_VS, fragmentShader: GAL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); FAR.beads.frustumCulled = false; FAR.lan.add(FAR.beads);
  // Laniakea boundary (three great circles) + Great Attractor glow
  const R = 80 * KPC_MPC; for (const [ax, ay] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) { const pts2 = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * 6.2832; const v = new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0); v.applyEuler(new THREE.Euler(ax, ay, 0)); pts2.push(v.add(FAR.center)); } FAR.lan.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), new THREE.LineBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.35, depthWrite: false }))); }
  FAR.gaGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); FAR.gaGlow.position.copy(ga); FAR.gaGlow.renderOrder = 4; FAR.lan.add(FAR.gaGlow);
}
const FAR_ART_KPC = 47.9;
function setArrow(a, from, to, headScale) {
  const d = to.clone().sub(from), len = d.length(); if (len < 1e-9) return; const dir = d.clone().divideScalar(len);
  a.userData.ln.geometry.setFromPoints([from, to]); a.userData.cone.position.copy(to); a.userData.cone.scale.setScalar(headScale); a.userData.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
}
function updateFar(dist, on) {
  if (!FAR.built) buildFar();
  const lab = (key, text, cls, pos, ox, oy, show) => placeGalLabel(galLabel(key, text, cls), pos, ox, oy, show);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // Milky Way itself fades to a marker as we leave
  const near = 1 - sm(300, 1400, dist);
  galPoints.visible = near > 0.02; FAR.art.visible = near > 0.02; FAR.art.material.opacity = (GV.art ? 0.8 : 0) * near;
  FAR.mwMark.material.opacity = sm(260, 900, dist) * 0.95; FAR.mwMark.scale.setScalar(Math.max(34, dist * 0.02)); FAR.mwMark.rotation.z = 0;
  const lgVis = sm(14, 70, dist) * (1 - sm(9e4, 4e5, dist));
  FAR.lg.visible = lgVis > 0.01;
  for (const it of FAR.items) {
    const phys = it.o.size, s = Math.max(phys * 1.0, dist * (it.o.type === 'spiral' ? 0.045 : it.o.tier === 2 ? 0.012 : 0.012));
    it.sp.scale.set(s, s * (it.o.type === 'spiral' ? 0.62 : 1), 1); it.sp.material.opacity = lgVis * (it.o.tier === 1 ? (1 - sm(1500, 8000, dist)) : 1);
    const showL = on && ((it.o.tier === 1 && dist > 90 && dist < 1500) || (it.o.tier === 2 && dist > 600 && dist < 2.5e4));
    lab('lg' + it.o.n, it.o.n, 'lg', it.pos, 10, -6, showL);
  }
  lab('mwmark', 'Milky Way', 'sun', new THREE.Vector3(0, 0, 0), 14, -8, on && dist > 520 && dist < 4e4);
  lab('lgyou', 'Local Group · you are here', 'sun', new THREE.Vector3(0, 0, 0), 14, 12, on && dist >= 4e4);
  // arrows
  const showA = on && dist > 900 && dist < 2.5e4;
  FAR.arrowM31.visible = showA; FAR.arrowLG.visible = on && dist > 900 && dist < 6e5;
  if (FAR.m31) { const dir = FAR.m31.clone().normalize(); const from = FAR.m31.clone().sub(dir.clone().multiplyScalar(dist * 0.03)), to = FAR.m31.clone().sub(dir.clone().multiplyScalar(dist * 0.14)); setArrow(FAR.arrowM31, from, to, dist * 0.012); lab('m31arrow', 'approaching at 110 km/s · merger in ~4–5 Gyr', 'drift', from.clone().add(to).multiplyScalar(0.5), 8, 12, showA && dist < 1e4); }
  { const d = new THREE.Vector3(...lbToFrame(LANIAKEA_INFO.lgL, LANIAKEA_INFO.lgB, 1)).normalize(); const len = dist * 0.22; const from = new THREE.Vector3(0, 0, 0), to = d.clone().multiplyScalar(Math.max(len, 600)); setArrow(FAR.arrowLG, from, to, Math.max(len, 600) * 0.05); lab('lgvel', `Local Group → ${LANIAKEA_INFO.lgVelKms} km/s toward the Great Attractor region`, 'drift', to, 8, -6, on && dist > 1500 && dist < 4e5); }
  // Laniakea
  const lanVis = sm(1.4e4, 9e4, dist);
  FAR.lan.visible = lanVis > 0.01; FAR.lanPts.material.uniforms.uAlpha.value = 0.55 * lanVis; FAR.lanPts.material.uniforms.uK.value = 1.2 + 0.8 * lanVis;
  FAR.gaGlow.scale.setScalar(Math.max(8000, dist * 0.05)); FAR.gaGlow.material.opacity = 0.7 * lanVis;
  if (FAR.lan.visible) {
    const bp = FAR.beads.geometry.getAttribute('position'), bc = FAR.beads.geometry.getAttribute('color'), tt = performance.now() / 1000 * 0.06; let n = 0;
    FAR.streams.forEach((s, i) => { for (let b = 0; b < 3; b++) { const t = ((tt + b / 3 + i * 0.173) % 1), p = s.a.clone().multiplyScalar((1 - t) * (1 - t)).add(s.c.clone().multiplyScalar(2 * t * (1 - t))).add(s.b.clone().multiplyScalar(t * t)); bp.setXYZ(n, p.x, p.y, p.z); bc.setXYZ(n, 0.6 + 0.4 * t, 0.95, 1.0); n++; } });
    bp.needsUpdate = true; bc.needsUpdate = true;
  }
  for (const nd of FAR.nodes) lab('lan' + nd.o.n, nd.o.n + (nd.o.outside ? ' (outside Laniakea)' : ''), nd.o.ga ? 'sun' : 'lan', nd.pos, 8, -4, on && lanVis > 0.4 && dist > 4e4);
  lab('lanname', `Laniakea Supercluster · ~${LANIAKEA_INFO.diameterMpc} Mpc across · ~${LANIAKEA_INFO.galaxies.toLocaleString('en-US')} galaxies`, 'gc', FAR.center.clone().add(new THREE.Vector3(0, 82 * KPC_MPC, 0)), -120, -10, on && lanVis > 0.4);
}
const GV_SCALES = {
  mw: () => ({ pitch: 0.98, dist: 38, tx: 0, ty: 0, tz: 0 }),
  sat: () => ({ pitch: 0.8, dist: 150, tx: 0, ty: 0, tz: 0 }),
  lg: () => { buildFar(); const m = FAR.m31; return { pitch: 0.9, yaw: m ? Math.atan2(-m.z, m.x) : 0, dist: 1350, tx: m ? m.x * 0.5 : 0, ty: m ? m.y * 0.5 : 0, tz: m ? m.z * 0.5 : 0 }; },
  lan: () => { buildFar(); const c = FAR.center; return { pitch: 0.5, dist: 2.4e5, tx: c.x * 0.45, ty: c.y * 0.45, tz: c.z * 0.45 }; },
};
function galScaleTo(name, dur) { if (!GV.ready) buildGalaxy(); GV.follow = false; syncGalUI(); galFly(Object.assign({ yaw: GV.yaw, dur: dur || 3200 }, GV_SCALES[name]()));
  GV.scaleName = name; }
