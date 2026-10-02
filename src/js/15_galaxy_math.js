// ===================== 15_galaxy_math.js — Milky Way model + the Sun's galactic orbit (no DOM, no THREE) =====================
// Galaxy frame (kpc, Myr): origin = Galactic Centre, +Y = north galactic pole, the Sun starts at (R0, y0, 0) and orbits
// CLOCKWISE seen from +Y (angle phi: x = R cos phi, z = R sin phi). Galactic (Xg toward GC, Yg toward l=90, Zg to NGP) maps to
// this frame as (x, y, z) = (-Xg, Zg, Yg).  l = 90 deg (direction of rotation) is +Z.
const GM = {
  R0: 8.18,            // kpc, Sun-GC distance (GRAVITY Collab. 2019)
  vc: 233,             // km/s, circular speed at the Sun (flat rotation curve)
  U: 11.1, V: 12.24, W: 7.25,   // km/s, solar peculiar motion (Schoenrich+2010): toward GC, along rotation, toward NGP
  z0: 0.0208,          // kpc, Sun's height above the plane (20.8 pc)
  vertPeriod: 70,      // Myr, vertical oscillation period (literature 64-90)
  kms: 1.0227e-3,      // kpc/Myr per km/s
  cmbSpeed: 369.82, cmbL: 264.021, cmbB: 48.253, // Sun's velocity w.r.t. the CMB (Planck 2018 dipole)
  barAngle: 27 * Math.PI / 180, barHalf: 4.6,
  armPitch: 13 * Math.PI / 180, perseusR0: 10.1,
  discR: 16,
};
function galToFrame(xg, yg, zg) { return [-xg, zg, yg]; }
function lbToFrame(l, b, mag) { const L = l * Math.PI / 180, B = b * Math.PI / 180; return galToFrame(mag * Math.cos(B) * Math.cos(L), mag * Math.cos(B) * Math.sin(L), mag * Math.sin(B)); }

// ---- the Sun's orbit: flat-rotation-curve potential in the plane (RK4) + harmonic vertical motion ----
let _sunOrbit = null;
function sunOrbit() {
  if (_sunOrbit) return _sunOrbit;
  const tMin = -700, tMax = 700, dt = 0.5, sub = 5, h = dt / sub, vc = GM.vc * GM.kms, K = vc * vc;
  const nu = 2 * Math.PI / GM.vertPeriod, w0 = GM.W * GM.kms;
  const acc = (x, z) => { const r2 = x * x + z * z; return [-K * x / r2, -K * z / r2]; };
  const run = (dir) => {
    let x = GM.R0, z = 0, vx = -GM.U * GM.kms, vz = (GM.vc + GM.V) * GM.kms;
    if (dir < 0) { vx = -vx; vz = -vz; }
    const out = [], n = Math.round((dir > 0 ? tMax : -tMin) / dt);
    for (let i = 0; i <= n; i++) {
      out.push([x, z, dir > 0 ? vx : -vx, dir > 0 ? vz : -vz]);
      for (let s = 0; s < sub; s++) {
        const k1 = acc(x, z), x2 = x + vx * h / 2, z2 = z + vz * h / 2, vx2 = vx + k1[0] * h / 2, vz2 = vz + k1[1] * h / 2;
        const k2 = acc(x2, z2), x3 = x + vx2 * h / 2, z3 = z + vz2 * h / 2, vx3 = vx + k2[0] * h / 2, vz3 = vz + k2[1] * h / 2;
        const k3 = acc(x3, z3), x4 = x + vx3 * h, z4 = z + vz3 * h, vx4 = vx + k3[0] * h, vz4 = vz + k3[1] * h;
        const k4 = acc(x4, z4);
        x += h * (vx + 2 * vx2 + 2 * vx3 + vx4) / 6; z += h * (vz + 2 * vz2 + 2 * vz3 + vz4) / 6;
        vx += h * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6; vz += h * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
      }
    }
    return out;
  };
  const fwd = run(1), bwd = run(-1), t = [], P = [];
  for (let i = bwd.length - 1; i >= 1; i--) { t.push(-i * dt); P.push(bwd[i]); }
  for (let i = 0; i < fwd.length; i++) { t.push(i * dt); P.push(fwd[i]); }
  const y = t.map(tt => GM.z0 * Math.cos(nu * tt) + (w0 / nu) * Math.sin(nu * tt));
  const vy = t.map(tt => -GM.z0 * nu * Math.sin(nu * tt) + w0 * Math.cos(nu * tt));
  _sunOrbit = { t, x: P.map(p => p[0]), z: P.map(p => p[1]), vx: P.map(p => p[2]), vz: P.map(p => p[3]), y, vy, dt, tMin, tMax, nu };
  return _sunOrbit;
}
// Sun's position (kpc, galaxy frame) and speed at time t (Myr from now); linear interpolation
function sunAt(tMyr) {
  const o = sunOrbit(), f = (Math.max(o.tMin, Math.min(o.tMax - 1e-6, tMyr)) - o.tMin) / o.dt, i = Math.floor(f), a = f - i, L = (arr) => arr[i] * (1 - a) + arr[i + 1] * a;
  const x = L(o.x), z = L(o.z), y = L(o.y), vx = L(o.vx), vz = L(o.vz), vy = L(o.vy);
  const R = Math.hypot(x, z);
  return { x, y, z, R, phi: Math.atan2(z, x), speed: Math.hypot(vx, vy, vz) / GM.kms, vR: (x * vx + z * vz) / R / GM.kms };
}
// Milky Way's velocity through space relative to the CMB (km/s, galaxy frame) = Sun-CMB dipole velocity minus the Sun's galactocentric velocity
function galaxyDrift() {
  const sc = lbToFrame(GM.cmbL, GM.cmbB, GM.cmbSpeed);                       // Sun w.r.t. CMB, in frame coords
  const sg = galToFrame(GM.U, GM.vc + GM.V, GM.W);                            // Sun w.r.t. GC
  const v = [sc[0] - sg[0], sc[1] - sg[1], sc[2] - sg[2]], sp = Math.hypot(v[0], v[1], v[2]);
  const lb = (() => { const xg = -v[0], yg = v[2], zg = v[1]; return { l: ((Math.atan2(yg, xg) * 180 / Math.PI) + 360) % 360, b: Math.asin(zg / sp) * 180 / Math.PI }; })();
  return { v: [v[0] * GM.kms, v[1] * GM.kms, v[2] * GM.kms], speed: sp, l: lb.l, b: lb.b };   // v in kpc/Myr
}

// ---- spiral arms: four logarithmic arms (R = R0j * exp(-beta*tan(pitch)), beta clockwise from the Sun-GC line) ----
const ARMS = [
  { name: 'Perseus Arm', R0: 10.1, color: [0.62, 0.78, 1.0], w: 1.0 },
  { name: 'Sagittarius–Carina Arm', R0: 10.1 * Math.exp(-(Math.PI / 2) * Math.tan(GM.armPitch)), color: [0.72, 0.84, 1.0], w: 1.15 },
  { name: 'Scutum–Centaurus Arm', R0: 10.1 * Math.exp(-Math.PI * Math.tan(GM.armPitch)), color: [0.66, 0.8, 1.0], w: 1.2 },
  { name: 'Norma–Outer Arm', R0: 10.1 * Math.exp(-1.5 * Math.PI * Math.tan(GM.armPitch)), color: [0.6, 0.76, 1.0], w: 1.0 },
];
function armBeta(arm, R) { return -Math.log(R / arm.R0) / Math.tan(GM.armPitch); }
function armXZ(arm, R) { const b = armBeta(arm, R); return [R * Math.cos(b), R * Math.sin(b)]; }
// Orion Spur (Local Arm), Reid+2019: R = 8.26 exp(-(beta-9deg) tan 11.4deg)
function spurXZ(betaDeg) { const b = betaDeg * Math.PI / 180, R = 8.26 * Math.exp(-(b - 9 * Math.PI / 180) * Math.tan(11.4 * Math.PI / 180)); return [R * Math.cos(b), R * Math.sin(b)]; }

// ---- procedural Milky Way: stars as [x,y,z] kpc + rgb + size. Deterministic. ----
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function buildMilkyWay(total = 110000, seed = 7) {
  const rnd = mulberry32(seed), gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) * 1.732; };
  const lap = () => { const u = rnd() - 0.5; return -Math.sign(u) * Math.log(1 - 2 * Math.abs(u)); };
  const n = Math.round(total), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), kind = new Uint8Array(n);
  let k = 0;
  const put = (x, y, z, r, g, b, s, kd) => { if (k >= n) return; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b; size[k] = s; kind[k] = kd; k++; };
  const nBulge = Math.round(n * 0.12), nBar = Math.round(n * 0.13), nDisc = Math.round(n * 0.12), nSpur = Math.round(n * 0.03), nHalo = Math.round(n * 0.02);
  const ca = Math.cos(GM.barAngle), sa = Math.sin(GM.barAngle);
  for (let i = 0; i < nBulge; i++) { const r = 1.3 * Math.pow(rnd(), 0.6), th = Math.acos(2 * rnd() - 1), ph = rnd() * 6.2832; put(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th) * 0.7, r * Math.sin(th) * Math.sin(ph), 1.0, 0.82 + 0.1 * rnd(), 0.52 + 0.15 * rnd(), 1.0 + rnd(), 0); }
  for (let i = 0; i < nBar; i++) { const a = gauss() * GM.barHalf * 0.42, b = gauss() * 0.75, y = gauss() * 0.28; const xx = a * ca - b * sa, zz = a * sa + b * ca; put(xx, y, zz, 1.0, 0.8 + 0.12 * rnd(), 0.5 + 0.2 * rnd(), 1.0 + rnd(), 1); }
  for (let i = 0; i < nDisc; i++) { const R = -2.6 * Math.log(1 - rnd() * 0.998), ph = rnd() * 6.2832; if (R > GM.discR) { i--; continue; } put(R * Math.cos(ph), lap() * 0.12, R * Math.sin(ph), 0.95, 0.88 + 0.08 * rnd(), 0.75 + 0.15 * rnd(), 0.8 + rnd() * 0.8, 2); }
  const nArm = n - nBulge - nBar - nDisc - nSpur - nHalo;
  for (let i = 0; i < nArm; i++) {
    const arm = ARMS[(rnd() * ARMS.length) | 0]; let R = 2.8 + 12.6 * Math.pow(rnd(), 1.15); if (rnd() < 0.55) R = 3 + 11 * Math.pow(rnd(), 1.7);
    const b = armBeta(arm, R) + gauss() * (0.028 + 0.012 * (R / 10)), sc = 0.15 + 0.03 * R, off = gauss() * sc; // scatter across the arm
    const x = R * Math.cos(b), z = R * Math.sin(b), nx = Math.cos(b), nz = Math.sin(b);
    const young = rnd(), dens = Math.exp(-R / 7.5);
    let r, g, bl, s;
    if (young < 0.05) { r = 1.0; g = 0.5 + 0.2 * rnd(); bl = 0.62 + 0.2 * rnd(); s = 1.4 + rnd() * 1.0; }            // HII regions
    else if (young < 0.62) { r = 0.55 + 0.15 * rnd(); g = 0.72 + 0.12 * rnd(); bl = 1.0; s = 1.1 + rnd() * 1.2; }     // young blue stars
    else { r = 0.9; g = 0.88; bl = 0.85 + 0.1 * rnd(); s = 0.8 + rnd() * 0.8; }
    put(x + nx * off, lap() * 0.1, z + nz * off, r * (0.7 + dens), g * (0.7 + dens), bl * (0.7 + dens), s * arm.w, 3);
  }
  for (let i = 0; i < nSpur; i++) { const be = -35 + 80 * rnd(), p = spurXZ(be), off = gauss() * 0.22; put(p[0] + off, lap() * 0.09, p[1] + off, 0.7, 0.82, 1.0, 1.0 + rnd(), 3); }
  for (let i = 0; i < nHalo; i++) { const r = 2 + 18 * Math.pow(rnd(), 1.3), th = Math.acos(2 * rnd() - 1), ph = rnd() * 6.2832; put(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph), 0.9, 0.82, 0.62, 0.9, 4); }
  return { n: k, pos, col, size, kind };
}

// ---- spiral-arm crossings: the arm pattern rotates rigidly at Omega_p, the Sun at its own (faster/slower) angular speed ----
GM.armHalf = 0.5;      // kpc, half-width of an arm (Reid+2019: ~0.4-0.6)
GM.omegaP = 28.2;      // km/s/kpc, pattern speed (Dias+2019 28.2; Dias&Lepine 2005 ~20; literature 20-30)
function armAngle(arm, R, tMyr, omegaKmSKpc) { return armBeta(arm, R) + omegaKmSKpc * GM.kms * tMyr; }
function wrapPiG(a) { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; }
// signed distance (kpc) from the Sun to the centre line of each arm at time t (negative = arm lies behind the Sun's direction of motion)
function sunArmDistances(tMyr, omega = GM.omegaP) {
  const s = sunAt(tMyr), out = [];
  for (const arm of ARMS) { const d = wrapPiG(s.phi - armAngle(arm, s.R, tMyr, omega)); out.push(d * s.R * Math.sin(GM.armPitch)); }
  return { sun: s, d: out };
}
function nearestArm(tMyr, omega = GM.omegaP) {
  const r = sunArmDistances(tMyr, omega); let k = 0; for (let i = 1; i < r.d.length; i++) if (Math.abs(r.d[i]) < Math.abs(r.d[k])) k = i;
  return { arm: k, dist: r.d[k], inside: Math.abs(r.d[k]) < GM.armHalf, R: r.sun.R };
}
function armCrossings(omega = GM.omegaP, tMin = -650, tMax = 650, dt = 0.5) {
  const segs = []; let cur = null;
  for (let t = tMin; t <= tMax + 1e-9; t += dt) {
    const n = nearestArm(t, omega);
    if (n.inside) { if (cur && cur.arm === n.arm) { cur.t1 = t; cur.min = Math.min(cur.min, Math.abs(n.dist)); } else { if (cur) segs.push(cur); cur = { arm: n.arm, t0: t, t1: t, min: Math.abs(n.dist) }; } }
    else if (cur) { segs.push(cur); cur = null; }
  }
  if (cur) segs.push(cur);
  return segs.filter(s => s.t1 - s.t0 >= 1);
}
// "Big Five" mass extinctions (Myr before present) — shown for context; any link to arm passages is a hypothesis, not established
const MASS_EXT = [[445, 'Ordovician–Silurian'], [372, 'Late Devonian'], [252, 'Permian–Triassic'], [201, 'Triassic–Jurassic'], [66, 'Cretaceous–Paleogene']];

// ---- Local Group & beyond (galactic l, b in degrees; distance in kpc from the Sun) — positions are catalogue values (McConnachie 2012, NED) ----
const LOCAL_GROUP = [
  { n: 'Large Magellanic Cloud', l: 280.47, b: -32.89, d: 49.6, size: 4.3, type: 'irr', tier: 1 },
  { n: 'Small Magellanic Cloud', l: 302.8, b: -44.3, d: 62.1, size: 2.5, type: 'irr', tier: 1 },
  { n: 'Sagittarius dwarf', l: 5.6, b: -14.2, d: 26, size: 3, type: 'dsph', tier: 1 },
  { n: 'Draco', l: 86.37, b: 34.72, d: 76, size: 0.5, type: 'dsph', tier: 1 },
  { n: 'Ursa Minor', l: 104.97, b: 44.8, d: 76, size: 0.6, type: 'dsph', tier: 1 },
  { n: 'Sculptor', l: 287.5, b: -83.16, d: 86, size: 0.6, type: 'dsph', tier: 1 },
  { n: 'Carina', l: 260.1, b: -22.2, d: 105, size: 0.5, type: 'dsph', tier: 1 },
  { n: 'Fornax', l: 237.1, b: -65.65, d: 147, size: 1.6, type: 'dsph', tier: 1 },
  { n: 'Leo I', l: 226.0, b: 49.1, d: 254, size: 0.6, type: 'dsph', tier: 1 },
  { n: 'Andromeda (M31)', l: 121.17, b: -21.57, d: 765, size: 46, type: 'spiral', tier: 2, vr: -110 },
  { n: 'Triangulum (M33)', l: 133.61, b: -31.33, d: 840, size: 18, type: 'spiral', tier: 2 },
  { n: 'M32', l: 121.15, b: -22.0, d: 760, size: 2.2, type: 'ell', tier: 2 },
  { n: 'NGC 205', l: 120.72, b: -21.14, d: 820, size: 5, type: 'ell', tier: 2 },
  { n: 'IC 10', l: 118.97, b: -3.34, d: 790, size: 2.5, type: 'irr', tier: 2 },
  { n: 'NGC 6822 (Barnard’s)', l: 25.3, b: -18.4, d: 500, size: 2.5, type: 'irr', tier: 2 },
  { n: 'IC 1613', l: 129.74, b: -60.58, d: 730, size: 3, type: 'irr', tier: 2 },
  { n: 'WLM', l: 75.85, b: -73.63, d: 930, size: 2.5, type: 'irr', tier: 2 },
];
// Mpc, galactic coords from the Sun; the Local Group is at the origin of this list
const LANIAKEA = [
  { n: 'Virgo Cluster', l: 283.78, b: 74.46, d: 16.5, r: 2.4, w: 1.0 },
  { n: 'Fornax Cluster', l: 236.7, b: -53.6, d: 19.3, r: 1.2, w: 0.5 },
  { n: 'Hydra Cluster', l: 269.5, b: 26.5, d: 51, r: 2.0, w: 0.6 },
  { n: 'Centaurus Cluster', l: 302.4, b: 21.6, d: 52, r: 2.2, w: 0.7 },
  { n: 'Great Attractor (Norma Cluster)', l: 325.3, b: -7.2, d: 69, r: 4.5, w: 1.4, ga: true },
  { n: 'Pavo–Indus', l: 331, b: -35, d: 70, r: 3, w: 0.7 },
  { n: 'Perseus–Pisces', l: 150.6, b: -13.3, d: 73, r: 3, w: 0.8, outside: true },
  { n: 'Coma Cluster', l: 58.1, b: 88.0, d: 99, r: 3, w: 0.8, outside: true },
  { n: 'Shapley Concentration', l: 311.9, b: 30.6, d: 200, r: 8, w: 1.2, outside: true },
];
const LANIAKEA_INFO = { diameterMpc: 160, massSuns: 1e17, galaxies: 100000, lgVelKms: 620, lgL: 271.9, lgB: 29.6 };
function lbToXYZ(l, b, d) { return lbToFrame(l, b, d); }  // returns frame coords (kpc or Mpc) RELATIVE to the Sun
