// ===================== 36_galaxy_far.js — the neighbourhood: Gaia stars, satellites, the Local Group (as true 3-D galaxies), Laniakea =====================
// Units are kpc (same as the galaxy scene). Catalogue positions (galactic l,b,d from the Sun) are placed relative to the Sun's present position.
const FAR = { built: false, lg: new THREE.Group(), lan: new THREE.Group(), near: new THREE.Group(), items: [], beads: null, streams: [], ga: null, center: null, sun0: null, m31: null, art: null, rot: null, mwLite: null, mwGlow: null, arrowLG: null, arrowM31: null, gaia: null };
const KPC_MPC = 1000, FAR_ART_KPC = 47.9;
const GLOW_COL = { spiral: 0xcfe0ff, barred: 0xffe2b8, irr: 0xbfd6ff, ell: 0xffd9a0, dsph: 0xe6dcc0 };
function bpRpColor(c) { // Gaia BP-RP -> approximate star colour
  const t = Math.max(-0.4, Math.min(3.2, c));
  if (t < 0.4) return [0.6 + 0.4 * (t + 0.4) / 0.8, 0.72 + 0.28 * (t + 0.4) / 0.8, 1.0];
  if (t < 1.1) return [1.0, 1.0 - 0.12 * (t - 0.4) / 0.7, 0.92 - 0.38 * (t - 0.4) / 0.7];
  return [1.0, 0.88 - 0.4 * Math.min(1, (t - 1.1) / 1.6), 0.54 - 0.34 * Math.min(1, (t - 1.1) / 1.6)];
}
function farVec(l, b, d, scaleKpc) { const v = lbToXYZ(l, b, d * scaleKpc); return new THREE.Vector3(v[0] + FAR.sun0.x, v[1] + FAR.sun0.y, v[2] + FAR.sun0.z); }
function galaxyMat(k, alpha) { return new THREE.ShaderMaterial({ uniforms: { uPx: { value: renderer.getPixelRatio() }, uK: { value: k }, uAlpha: { value: alpha } }, vertexShader: GAL_VS, fragmentShader: GAL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); }
function cloudPoints(c, k, alpha) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(c.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(c.col, 3)); g.setAttribute('size', new THREE.BufferAttribute(c.size, 1));
  const p = new THREE.Points(g, galaxyMat(k, alpha)); p.frustumCulled = false; return p;
}
function buildFar() {
  if (FAR.built) return; FAR.built = true;
  const s0 = sunAt(0); FAR.sun0 = new THREE.Vector3(s0.x, s0.y, s0.z);
  // Milky Way pattern group (art disc + stars + dust rotate rigidly at the spiral pattern speed)
  FAR.rot = new THREE.Group(); galScene.add(FAR.rot); galScene.remove(galPoints); FAR.rot.add(galPoints);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(FAR_ART_KPC, FAR_ART_KPC), new THREE.MeshBasicMaterial({ map: tex('mwArt'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, side: THREE.DoubleSide }));
  art.geometry.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)));
  art.renderOrder = -3; art.frustumCulled = false; FAR.rot.add(art); FAR.art = art;
  const dust = buildMWDust(26000, 31), dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dust.pos, 3));
  const dcol = new Float32Array(dust.n * 3), dsz = new Float32Array(dust.n).fill(3.4); for (let i = 0; i < dust.n; i++) { dcol[i * 3] = 0.05; dcol[i * 3 + 1] = 0.03; dcol[i * 3 + 2] = 0.02; }
  dg.setAttribute('color', new THREE.BufferAttribute(dcol, 3)); dg.setAttribute('size', new THREE.BufferAttribute(dsz, 1));
  FAR.dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: { uPx: { value: renderer.getPixelRatio() }, uK: { value: 1.7 }, uAlpha: { value: 0.16 } }, vertexShader: GAL_VS, fragmentShader: GAL_FS, transparent: true, depthWrite: false, blending: THREE.NormalBlending }));
  FAR.dust.frustumCulled = false; FAR.dust.renderOrder = 2; FAR.rot.add(FAR.dust);
  // a lighter copy of the true-shape Milky Way for the far scales (edge-on it is a thin disc with a boxy bulge - not a flat picture)
  FAR.mwLite = cloudPoints(buildMilkyWay(16000, 5), 1.5, 0); galScene.add(FAR.mwLite);
  FAR.mwGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xd8e4ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); FAR.mwGlow.renderOrder = 3; galScene.add(FAR.mwGlow);
  // ---- Gaia DR3 stars (real 3-D positions) around the Sun; they co-move with the Sun, so the group follows the Sun along its orbit ----
  { const bin = atob(GAIA.b64), n = GAIA.n, u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const dv = new DataView(u8.buffer), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) { const o = i * 8, x = dv.getInt16(o, true) * 1e-4, y = dv.getInt16(o + 2, true) * 1e-4, z = dv.getInt16(o + 4, true) * 1e-4, g = u8[o + 6] / 10, c = u8[o + 7] / 50 - 0.6, rgb = bpRpColor(c);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; const br = Math.min(1, 0.45 + (10.5 - g) * 0.18); col[i * 3] = rgb[0] * br; col[i * 3 + 1] = rgb[1] * br; col[i * 3 + 2] = rgb[2] * br; size[i] = 1.1 + Math.max(0, 9.5 - g) * 0.38; }
    FAR.gaia = cloudPoints({ pos, col, size, n }, 1.6, 0.9); FAR.gaia.renderOrder = 5; FAR.near.add(FAR.gaia); }
  galScene.add(FAR.near); FAR.nearLabels = [];
  for (const r of NEAR_STARS) if (r[4] < 5.5 || Math.hypot(r[1], r[2], r[3]) < 9) FAR.nearLabels.push({ n: r[0], p: new THREE.Vector3(r[1] / 1000, r[2] / 1000, r[3] / 1000), d: Math.hypot(r[1], r[2], r[3]) });
  FAR.clusters = [['Hyades', 180.1, -22.4, 47], ['Pleiades', 166.6, -23.5, 136], ['Taurus clouds', 172, -15, 140], ['Ophiuchus clouds', 353, 17, 140], ['Scorpius–Centaurus assoc.', 330, 15, 130], ['Alpha Persei cluster', 147, -6.5, 175], ['Praesepe (Beehive)', 205.9, 32.5, 187], ['Orion Nebula (M42)', 209, -19.4, 412]].map(c => ({ n: c[0], p: new THREE.Vector3(...lbToXYZ(c[1], c[2], c[3] / 1000)) }));
  // Local Bubble: a ~100 pc cavity (drawn as three great circles)
  { const R = 0.1, m = new THREE.LineBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.3, depthWrite: false }); for (const e of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) { const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * 6.2832; pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0).applyEuler(new THREE.Euler(e[0], e[1], 0))); } FAR.near.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m)); } }
  FAR.rings = []; for (const R of [0.01, 0.05, 0.25]) { const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * 6.2832; pts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)); } const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4a6a9c, transparent: true, opacity: 0.4, depthWrite: false })); FAR.near.add(ln); FAR.rings.push({ R, ln }); }
  // ---- Local Group + satellites as true 3-D galaxies (point clouds with real inclinations) ----
  galScene.add(FAR.lg);
  let seed = 11;
  for (const o of LOCAL_GROUP) {
    const pos = farVec(o.l, o.b, o.d, 1), sh = GAL_SHAPES[o.n], kind = sh ? sh.kind : (o.type === 'irr' ? 'irr' : o.type === 'ell' ? 'ell' : o.type === 'spiral' ? 'spiral' : 'dsph');
    const cnt = sh ? sh.n : Math.max(500, Math.min(1500, Math.round(300 + o.size * 600))), cloud = buildGalaxyCloud(kind, o.size, cnt, seed++, sh && sh.stretch ? sh.stretch : [1, 1, 1]);
    const pts = cloudPoints(cloud, kind === 'dsph' ? 1.2 : 1.5, 0), grp = new THREE.Group();
    const m = new THREE.Matrix4();
    if (sh) { const b = galaxyBasis(sh.ra, sh.dec, sh.pa, sh.inc); m.makeBasis(new THREE.Vector3(...b.x), new THREE.Vector3(...b.y), new THREE.Vector3(...b.z)); }
    else { const rr = mulberry32(seed * 7), th = rr() * 6.2832, ph = Math.acos(2 * rr() - 1); m.makeRotationFromEuler(new THREE.Euler(th, ph, rr() * 6.2832)); }
    pts.applyMatrix4(m); grp.add(pts); grp.position.copy(pos); FAR.lg.add(grp);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: GLOW_COL[kind], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); glow.position.copy(pos); glow.renderOrder = 3; FAR.lg.add(glow);
    FAR.items.push({ o, pos, pts, glow, kind }); if (o.vr) FAR.m31 = pos;
  }
  const mkArrow = (col) => { const g = new THREE.Group(); const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthTest: false })); ln.renderOrder = 7; const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 12), new THREE.MeshBasicMaterial({ color: col, depthTest: false })); cone.renderOrder = 7; g.add(ln, cone); g.userData = { ln, cone }; galScene.add(g); return g; };
  FAR.arrowM31 = mkArrow(0x9cffd0); FAR.arrowLG = mkArrow(0xffd58a);
  // ---- Laniakea
  galScene.add(FAR.lan);
  const rnd = mulberry32(2024), gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) * 1.732; };
  const nodes = LANIAKEA.map(o => ({ o, pos: farVec(o.l, o.b, o.d, KPC_MPC) })); FAR.nodes = nodes;
  // ---- Hubble's famous galaxies, placed from their catalogue direction (galactic l, b) and distance (Mpc)
  FAR.hubble = [['Whirlpool (M51)', 104.9, 68.6, 8.6], ['Sombrero (M104)', 298.5, 51.1, 9.55], ['NGC 4414', 174.5, 83.2, 17.7], ['NGC 1300', 208.2, -55.2, 18.7], ['Antennae (NGC 4038/39)', 287.0, 42.5, 22]].map(h => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xd9b8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
    const pos = farVec(h[1], h[2], h[3], KPC_MPC); sp.position.copy(pos); sp.renderOrder = 6; galScene.add(sp); return { n: h[0], d: h[3], pos, sp };
  });
  const ga = nodes.find(n => n.o.ga).pos; FAR.ga = ga; FAR.center = ga.clone().multiplyScalar(0.9).add(FAR.sun0.clone().multiplyScalar(0.1));
  const N = 22000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N); let k = 0;
  const put = (p, r, g, b, s) => { if (k >= N) return; pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b; size[k] = s; k++; };
  for (const n of nodes) { const cnt = Math.round(1800 * n.o.w), sg = n.o.r * KPC_MPC * 0.55; for (let i = 0; i < cnt; i++) put(new THREE.Vector3(n.pos.x + gauss() * sg, n.pos.y + gauss() * sg * 0.8, n.pos.z + gauss() * sg), 1.0, 0.82 + 0.1 * rnd(), 0.6 + 0.2 * rnd(), 1.2 + rnd() * 1.4); }
  const inside = nodes.filter(n => !n.o.outside).map(n => n.pos), origin = FAR.sun0.clone(); inside.push(origin);
  for (let i = 0; i < inside.length; i++) for (let j = i + 1; j < inside.length; j++) { const a = inside[i], b = inside[j], dist = a.distanceTo(b); if (dist > 90 * KPC_MPC) continue; const cnt = Math.round(dist / KPC_MPC * 30), mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(4 * KPC_MPC)); for (let q = 0; q < cnt; q++) { const t = q / cnt, p = a.clone().multiplyScalar((1 - t) * (1 - t)).add(mid.clone().multiplyScalar(2 * t * (1 - t))).add(b.clone().multiplyScalar(t * t)); p.add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(2.4 * KPC_MPC)); put(p, 0.62, 0.74, 1.0, 0.9 + rnd() * 0.9); } }
  while (k < N) { const p = new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(70 * KPC_MPC).add(FAR.center); put(p, 0.55, 0.62, 0.9, 0.8 + rnd() * 0.8); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const pts = new THREE.Points(g, galaxyMat(1.5, 0.55)); pts.frustumCulled = false; FAR.lan.add(pts); FAR.lanPts = pts;
  const NS = 80, seg = 40, lp = new Float32Array(NS * seg * 2 * 3), lc = new Float32Array(NS * seg * 2 * 3);
  FAR.streams = [];
  for (let i = 0; i < NS; i++) {
    const u = rnd() * 2 - 1, th = rnd() * 6.2832, rr = Math.sqrt(1 - u * u), dir = new THREE.Vector3(rr * Math.cos(th), u, rr * Math.sin(th)), R = (62 + 22 * rnd()) * KPC_MPC;
    const a = FAR.center.clone().add(dir.multiplyScalar(R)), b = ga.clone().add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(3 * KPC_MPC)), c = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(14 * KPC_MPC));
    FAR.streams.push({ a, b, c });
    for (let s = 0; s < seg; s++) for (let e = 0; e < 2; e++) { const t = (s + e) / seg, p = a.clone().multiplyScalar((1 - t) * (1 - t)).add(c.clone().multiplyScalar(2 * t * (1 - t))).add(b.clone().multiplyScalar(t * t)), idx = ((i * seg + s) * 2 + e) * 3, f = 0.25 + 0.75 * t; lp[idx] = p.x; lp[idx + 1] = p.y; lp[idx + 2] = p.z; lc[idx] = 0.35 * f; lc[idx + 1] = 0.85 * f; lc[idx + 2] = 1.0 * f; }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })); ls.frustumCulled = false; FAR.lan.add(ls);
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3 * 3), 3)); bg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NS * 3 * 3), 3)); bg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(NS * 3).fill(3), 1));
  FAR.beads = new THREE.Points(bg, galaxyMat(1.8, 1)); FAR.beads.frustumCulled = false; FAR.lan.add(FAR.beads);
  const R = 80 * KPC_MPC; for (const [ax, ay] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) { const pts2 = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * 6.2832; const v = new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0); v.applyEuler(new THREE.Euler(ax, ay, 0)); pts2.push(v.add(FAR.center)); } FAR.lan.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), new THREE.LineBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.3, depthWrite: false }))); }
  FAR.gaGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); FAR.gaGlow.position.copy(ga); FAR.gaGlow.renderOrder = 4; FAR.lan.add(FAR.gaGlow);
}
function setArrow(a, from, to, headScale) {
  const d = to.clone().sub(from), len = d.length(); if (len < 1e-9) return; const dir = d.clone().divideScalar(len);
  a.userData.ln.geometry.setFromPoints([from, to]); a.userData.cone.position.copy(to); a.userData.cone.scale.setScalar(headScale); a.userData.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
}
const smoothS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function updateFar(dist, on, sunPos) {
  if (!FAR.built) buildFar();
  const lab = (key, text, cls, pos, ox, oy, show) => placeGalLabel(galLabel(key, text, cls), pos, ox, oy, show);
  const sm = smoothS;
  // ---- the Milky Way: full model near, a lighter true-shape copy far away
  const near = 1 - sm(300, 1400, dist), sinEl = Math.abs(Math.sin(GV.pitch)), flat = sm(0.1, 0.55, sinEl);   // the flat NASA picture fades as we move edge-on
  const nf = sm(1.2, 8, dist); GV.nearFade = nf; galPoints.visible = FAR.dust.visible = near > 0.02 && nf > 0.02; FAR.art.visible = near > 0.02 && GV.art && nf > 0.02;
  FAR.art.material.opacity = 0.8 * near * flat * nf; GV.glow.material.opacity = (GV.art ? 0.22 : 0.9) * (0.25 + 0.75 * flat) * nf;
  FAR.dust.material.uniforms.uAlpha.value = 0.2 * (0.4 + 0.6 * (1 - flat)) * near;
  const liteA = (1 - near) * (1 - sm(1.2e5, 4e5, dist)); FAR.mwLite.visible = liteA > 0.01; FAR.mwLite.material.uniforms.uAlpha.value = 0.5 * liteA;
  FAR.mwGlow.material.opacity = sm(260, 900, dist) * 0.5 * (1 - sm(2e5, 6e5, dist)); FAR.mwGlow.scale.setScalar(Math.max(30, dist * 0.014));
  // ---- Gaia stars follow the Sun
  const gaiaA = 1 - sm(2, 14, dist); FAR.near.visible = dist < 60;
  FAR.near.position.copy(sunPos);
  FAR.gaia.material.uniforms.uAlpha.value = (GV.gaia ? 0.95 : 0) * gaiaA; FAR.gaia.material.uniforms.uK.value = dist < 0.2 ? 2.4 : dist < 1.5 ? 1.8 : 1.3;
  for (const r of FAR.rings) r.ln.material.opacity = 0.4 * (dist < 4 ? 1 - sm(1.2, 4, dist) : 0);
  const showN = on && dist < 3;
  for (const s of FAR.nearLabels) { const show = showN && s.d < (dist < 0.05 ? 12 : dist < 0.15 ? 8 : 5); lab('ns' + s.n, `${s.n} · ${(s.d * 3.2616).toFixed(1)} ly`, 'star', FAR.near.localToWorld(s.p.clone()), 6, -4, show); }
  for (const c of FAR.clusters) lab('nc' + c.n, c.n, 'lan', FAR.near.localToWorld(c.p.clone()), 6, -4, showN && dist > 0.15);
  lab('bubble', 'Local Bubble · a ~100 pc cavity of hot, thin gas', 'lan', FAR.near.localToWorld(new THREE.Vector3(0.1, 0, 0)), 6, -4, on && dist > 0.15 && dist < 2);
  [[0.01, '10 pc · 33 ly'], [0.05, '50 pc · 163 ly'], [0.25, '250 pc · 815 ly']].forEach(([R, t]) => lab('nring' + R, t, 'ring', FAR.near.localToWorld(new THREE.Vector3(R * 0.7071, 0, -R * 0.7071)), 4, -4, on && dist < 3 && dist > R * 1.2 && dist < R * 40));
  // ---- Local Group and satellites: glow when tiny, a 3-D point cloud as it grows on screen
  const lgVis = sm(14, 70, dist) * (1 - sm(9e4, 4e5, dist));
  FAR.lg.visible = lgVis > 0.01;
  for (const it of FAR.items) {
    const app = it.o.size / Math.max(dist, 1e-6), cloudA = sm(0.004, 0.02, app) * lgVis, glowA = (1 - sm(0.008, 0.05, app)) * lgVis * (it.o.tier === 1 ? (1 - sm(1500, 8000, dist)) : 1);
    it.pts.material.uniforms.uAlpha.value = (it.kind === 'dsph' ? 0.5 : it.kind === 'spiral' || it.kind === 'barred' ? 0.5 : 0.7) * cloudA; it.pts.visible = cloudA > 0.01;
    it.glow.material.opacity = 0.75 * glowA; it.glow.scale.setScalar(Math.max(it.o.size * 1.3, dist * (it.o.type === 'spiral' ? 0.032 : 0.013)));
    const showL = on && ((it.o.tier === 1 && dist > 40 && dist < 1500) || (it.o.tier === 2 && dist > 600 && dist < 2.5e4));
    lab('lg' + it.o.n, it.o.n, 'lg', it.pos, 10, -6, showL);
  }
  lab('mwmark', 'Milky Way', 'sun', new THREE.Vector3(0, 0, 0), 14, -8, on && dist > 520 && dist < 4e4);
  lab('lgyou', 'Local Group · you are here', 'sun', new THREE.Vector3(0, 0, 0), 14, 12, on && dist >= 4e4);
  const showA = on && dist > 900 && dist < 2.5e4;
  FAR.arrowM31.visible = showA; FAR.arrowLG.visible = on && dist > 900 && dist < 6e5;
  if (FAR.m31) { const dir = FAR.m31.clone().normalize(), from = FAR.m31.clone().sub(dir.clone().multiplyScalar(dist * 0.03)), to = FAR.m31.clone().sub(dir.clone().multiplyScalar(dist * 0.14)); setArrow(FAR.arrowM31, from, to, dist * 0.012); lab('m31arrow', 'approaching at 110 km/s · merger in ~4–5 Gyr', 'drift', from.clone().add(to).multiplyScalar(0.5), 8, 12, showA && dist < 1e4); }
  { const d = new THREE.Vector3(...lbToFrame(LANIAKEA_INFO.lgL, LANIAKEA_INFO.lgB, 1)).normalize(), len = Math.max(dist * 0.22, 600), to = d.clone().multiplyScalar(len); setArrow(FAR.arrowLG, new THREE.Vector3(), to, len * 0.05); lab('lgvel', `Local Group → ${LANIAKEA_INFO.lgVelKms} km/s toward the Great Attractor region`, 'drift', to, 8, -6, on && dist > 1500 && dist < 4e5); }
  // ---- Laniakea
  const lanVis = sm(1.4e4, 9e4, dist);
  FAR.lan.visible = lanVis > 0.01; FAR.lanPts.material.uniforms.uAlpha.value = 0.55 * lanVis; FAR.lanPts.material.uniforms.uK.value = 1.2 + 0.8 * lanVis;
  FAR.gaGlow.scale.setScalar(Math.max(8000, dist * 0.05)); FAR.gaGlow.material.opacity = 0.7 * lanVis;
  if (FAR.lan.visible) {
    const bp = FAR.beads.geometry.getAttribute('position'), bc = FAR.beads.geometry.getAttribute('color'), tt = performance.now() / 1000 * 0.06; let n = 0;
    FAR.streams.forEach((s, i) => { for (let b = 0; b < 3; b++) { const t = ((tt + b / 3 + i * 0.173) % 1), p = s.a.clone().multiplyScalar((1 - t) * (1 - t)).add(s.c.clone().multiplyScalar(2 * t * (1 - t))).add(s.b.clone().multiplyScalar(t * t)); bp.setXYZ(n, p.x, p.y, p.z); bc.setXYZ(n, 0.6 + 0.4 * t, 0.95, 1.0); n++; } });
    bp.needsUpdate = true; bc.needsUpdate = true;
  }
  { const hv = on && dist > 3000 && dist < 1.3e5, hs = Math.max(120, dist * 0.012);
    for (const h of FAR.hubble) { h.sp.visible = hv; h.sp.scale.setScalar(hs); lab('hub' + h.n, `${h.n} · ${(h.d * 3.2616).toFixed(0)} Mly`, 'hubble', h.pos, 8, -4, hv); } }
  for (const nd of FAR.nodes) lab('lan' + nd.o.n, nd.o.n + (nd.o.outside ? ' (outside Laniakea)' : ''), nd.o.ga ? 'sun' : 'lan', nd.pos, 8, -4, on && lanVis > 0.4 && dist > 4e4);
  lab('lanname', `Laniakea Supercluster · ~${LANIAKEA_INFO.diameterMpc} Mpc across · ~${LANIAKEA_INFO.galaxies.toLocaleString('en-US')} galaxies`, 'gc', FAR.center.clone().add(new THREE.Vector3(0, 82 * KPC_MPC, 0)), -120, -10, on && lanVis > 0.4);
}
const GV_SCALES = {
  sun: () => ({ pitch: 0.5, dist: 0.0006, follow: true }),
  near: () => ({ pitch: 0.55, dist: 0.32, follow: true }),
  mw: () => ({ pitch: 0.98, dist: 38, tx: 0, ty: 0, tz: 0, follow: false }),
  sat: () => ({ pitch: 0.8, dist: 150, tx: 0, ty: 0, tz: 0, follow: false }),
  lg: () => { buildFar(); const m = FAR.m31; return { pitch: 0.9, yaw: m ? Math.atan2(-m.z, m.x) : 0, dist: 1350, tx: m ? m.x * 0.5 : 0, ty: m ? m.y * 0.5 : 0, tz: m ? m.z * 0.5 : 0, follow: false }; },
  hub: () => { buildFar(); const c = new THREE.Vector3(); for (const h of FAR.hubble) c.add(h.pos); c.multiplyScalar(0.55 / FAR.hubble.length); return { pitch: 0.7, dist: 4e4, tx: c.x, ty: c.y, tz: c.z, follow: false }; },
  lan: () => { buildFar(); const c = FAR.center; return { pitch: 0.5, dist: 2.4e5, tx: c.x * 0.45, ty: c.y * 0.45, tz: c.z * 0.45, follow: false }; },
};
function galScaleTo(name, dur) {
  if (!GV.ready) buildGalaxy();
  const sc = GV_SCALES[name](), follow = !!sc.follow; delete sc.follow;
  GV.follow = follow; if (follow) { const sp = galSunPos(GV.gt); sc.tx = sp.x; sc.ty = sp.y; sc.tz = sp.z; }
  GV.scaleName = name; syncGalUI(); galFly(Object.assign({ yaw: GV.yaw, dur: dur || 3200 }, sc));
  if (name === 'sun') setTimeout(() => { if (GV.scaleName === 'sun' && S.view === 'galaxy') bridgeToSolar(); }, (dur || 3200) + 150);
}
// zoom-through: the smallest stop of the Galaxy scale bar is the Solar System itself, where the planets' helix lives
function bridgeToSolar() {
  const f = $('fade'); if (f) f.style.opacity = 1;
  setTimeout(() => { GV.follow = false; GV.scaleName = 'mw'; setView('system', { noFly: true }); setHelix(true); if (f) setTimeout(() => { f.style.opacity = 0; }, 150); }, 480);
}
