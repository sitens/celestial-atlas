// ===================== 10_astro.js — ephemeris, orientation, eclipses (no DOM, no THREE) =====================
// Scene axes: ecliptic J2000 mapped (x, y, z)_ecl -> (x, z, -y)_scene so Three's +Y is ecliptic north.
// All positions are KILOMETRES in scene axes, heliocentric unless stated.
const A = Astronomy;
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

let SX, SY, SZ;
(function initFrames() {
  const r = A.Rotation_EQJ_ECL(), t0 = A.MakeTime(new Date(0));
  const f = (x, y, z) => { const v = A.RotateVector(r, new A.Vector(x, y, z, t0)); return [v.x, v.z, -v.y]; };
  SX = f(1, 0, 0); SY = f(0, 1, 0); SZ = f(0, 0, 1);
})();
function eqj2scene(x, y, z) {
  return [x * SX[0] + y * SY[0] + z * SZ[0], x * SX[1] + y * SY[1] + z * SZ[1], x * SX[2] + y * SY[2] + z * SZ[2]];
}
const vecAU2scene = v => { const s = eqj2scene(v.x, v.y, v.z); return [s[0] * AU_KM, s[1] * AU_KM, s[2] * AU_KM]; };

// ---------------- body catalogue ----------------
// R = mean/volumetric radius km. info strings for the UI card.
const BODY_DEFS = [
  { id: 'Sun', R: 695700, tex: 'sun', color: '#ffcf6b', info: { dia: '1,391,400 km', mass: '1.989×10³⁰ kg', day: '25.4 d (equator)', year: '≈230 My around the galaxy', moons: '—' } },
  { id: 'Mercury', R: 2439.7, tex: 'mercury', color: '#b5aca4', info: { dia: '4,879 km', mass: '3.30×10²³ kg', day: '58.6 d', year: '87.97 d', moons: '0' } },
  { id: 'Venus', R: 6051.8, tex: 'venus', color: '#e8c98f', info: { dia: '12,104 km', mass: '4.87×10²⁴ kg', day: '243 d (retrograde)', year: '224.7 d', moons: '0' } },
  { id: 'Earth', R: 6371.0, tex: 'earth', color: '#4aa3ff', info: { dia: '12,742 km', mass: '5.97×10²⁴ kg', day: '23 h 56 m (sidereal)', year: '365.25 d', moons: '1' } },
  { id: 'Mars', R: 3389.5, tex: 'mars', color: '#d9694a', info: { dia: '6,779 km', mass: '6.42×10²³ kg', day: '24 h 37 m', year: '687 d', moons: '2' } },
  { id: 'Jupiter', R: 69911, tex: 'jupiter', color: '#d8b48b', info: { dia: '139,822 km', mass: '1.90×10²⁷ kg', day: '9 h 56 m', year: '11.86 y', moons: '95+' } },
  { id: 'Saturn', R: 58232, tex: 'saturn', color: '#e6d3a1', info: { dia: '116,464 km', mass: '5.68×10²⁶ kg', day: '10 h 33 m', year: '29.46 y', moons: '146+' } },
  { id: 'Uranus', R: 25362, tex: 'uranus', color: '#a6e3e9', info: { dia: '50,724 km', mass: '8.68×10²⁵ kg', day: '17 h 14 m (retrograde)', year: '84.0 y', moons: '28' } },
  { id: 'Neptune', R: 24622, tex: 'neptune', color: '#5b7cff', info: { dia: '49,244 km', mass: '1.02×10²⁶ kg', day: '16 h 6 m', year: '164.8 y', moons: '16' } },
  { id: 'Pluto', R: 1188.3, tex: null, color: '#c9b8a6', info: { dia: '2,377 km', mass: '1.30×10²² kg', day: '6.39 d (retrograde)', year: '248 y', moons: '5' } },
  { id: 'Moon', R: 1737.4, parent: 'Earth', tex: 'moon', color: '#cfcfcf', info: { dia: '3,474 km', mass: '7.35×10²² kg', day: '27.3 d (tidally locked)', year: '27.3 d around Earth', moons: '—' } },
  { id: 'Phobos', R: 11.1, parent: 'Mars', color: '#9a8a7a', sat: true, info: { dia: '22 km', mass: '1.07×10¹⁶ kg', day: '7.7 h (locked)', year: '0.32 d around Mars', moons: '—' } },
  { id: 'Deimos', R: 6.2, parent: 'Mars', color: '#a39484', sat: true, info: { dia: '12 km', mass: '1.5×10¹⁵ kg', day: '30.3 h (locked)', year: '1.26 d around Mars', moons: '—' } },
  { id: 'Io', R: 1821.6, parent: 'Jupiter', color: '#e8d27a', gal: 'io', info: { dia: '3,643 km', mass: '8.93×10²² kg', day: '1.77 d (locked)', year: '1.77 d around Jupiter', moons: '—' } },
  { id: 'Europa', R: 1560.8, parent: 'Jupiter', color: '#d9cdb8', gal: 'europa', info: { dia: '3,122 km', mass: '4.80×10²² kg', day: '3.55 d (locked)', year: '3.55 d around Jupiter', moons: '—' } },
  { id: 'Ganymede', R: 2634.1, parent: 'Jupiter', color: '#b9ad9d', gal: 'ganymede', info: { dia: '5,268 km', mass: '1.48×10²³ kg', day: '7.15 d (locked)', year: '7.15 d around Jupiter', moons: '—' } },
  { id: 'Callisto', R: 2410.3, parent: 'Jupiter', color: '#8f8579', gal: 'callisto', info: { dia: '4,821 km', mass: '1.08×10²³ kg', day: '16.7 d (locked)', year: '16.7 d around Jupiter', moons: '—' } },
  { id: 'Mimas', R: 198.2, parent: 'Saturn', color: '#bdbdbd', sat: true, info: { dia: '396 km', mass: '3.8×10¹⁹ kg', day: '0.94 d (locked)', year: '0.94 d around Saturn', moons: '—' } },
  { id: 'Enceladus', R: 252.1, parent: 'Saturn', color: '#f2f6fa', sat: true, info: { dia: '504 km', mass: '1.08×10²⁰ kg', day: '1.37 d (locked)', year: '1.37 d around Saturn', moons: '—' } },
  { id: 'Tethys', R: 531.1, parent: 'Saturn', color: '#e0e0e0', sat: true, info: { dia: '1,062 km', mass: '6.2×10²⁰ kg', day: '1.89 d (locked)', year: '1.89 d around Saturn', moons: '—' } },
  { id: 'Dione', R: 561.4, parent: 'Saturn', color: '#d8d8d8', sat: true, info: { dia: '1,123 km', mass: '1.1×10²¹ kg', day: '2.74 d (locked)', year: '2.74 d around Saturn', moons: '—' } },
  { id: 'Rhea', R: 763.8, parent: 'Saturn', color: '#cfcfcf', sat: true, info: { dia: '1,527 km', mass: '2.3×10²¹ kg', day: '4.52 d (locked)', year: '4.52 d around Saturn', moons: '—' } },
  { id: 'Titan', R: 2574.7, parent: 'Saturn', color: '#e3a85c', sat: true, info: { dia: '5,149 km', mass: '1.35×10²³ kg', day: '15.9 d (locked)', year: '15.9 d around Saturn', moons: '—' } },
  { id: 'Iapetus', R: 734.5, parent: 'Saturn', color: '#a89f94', sat: true, info: { dia: '1,469 km', mass: '1.8×10²¹ kg', day: '79.3 d (locked)', year: '79.3 d around Saturn', moons: '—' } },
  { id: 'Miranda', R: 235.8, parent: 'Uranus', color: '#c9c9c9', sat: true, info: { dia: '472 km', mass: '6.6×10¹⁹ kg', day: '1.41 d (locked)', year: '1.41 d around Uranus', moons: '—' } },
  { id: 'Ariel', R: 578.9, parent: 'Uranus', color: '#d6d6d6', sat: true, info: { dia: '1,158 km', mass: '1.25×10²¹ kg', day: '2.52 d (locked)', year: '2.52 d around Uranus', moons: '—' } },
  { id: 'Umbriel', R: 584.7, parent: 'Uranus', color: '#8f8f8f', sat: true, info: { dia: '1,169 km', mass: '1.28×10²¹ kg', day: '4.14 d (locked)', year: '4.14 d around Uranus', moons: '—' } },
  { id: 'Titania', R: 788.4, parent: 'Uranus', color: '#bfb7ad', sat: true, info: { dia: '1,577 km', mass: '3.4×10²¹ kg', day: '8.71 d (locked)', year: '8.71 d around Uranus', moons: '—' } },
  { id: 'Oberon', R: 761.4, parent: 'Uranus', color: '#a69b90', sat: true, info: { dia: '1,523 km', mass: '3.1×10²¹ kg', day: '13.5 d (locked)', year: '13.5 d around Uranus', moons: '—' } },
  { id: 'Triton', R: 1353.4, parent: 'Neptune', color: '#d9c9c0', sat: true, info: { dia: '2,707 km', mass: '2.14×10²² kg', day: '5.88 d (locked, retrograde)', year: '5.88 d around Neptune', moons: '—' } },
];
const BODY = {}; BODY_DEFS.forEach(b => BODY[b.id] = b);
const PLANETS = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const SKY_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const NAKED_EYE = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']);
const GALILEAN = ['Io', 'Europa', 'Ganymede', 'Callisto'];
const MOONS_OF = {};
BODY_DEFS.forEach(b => { if (b.parent) (MOONS_OF[b.parent] = MOONS_OF[b.parent] || []).push(b.id); });
const SATURN_RING = { inner: 74500, outer: 140220 }; // km (C ring inner edge .. F ring)

// IAU WGCCRE rotation elements: pole RA/Dec (deg, + per Julian century), prime meridian W0 + Wd*days since J2000
const IAU = {
  Sun: { a0: 286.13, d0: 63.87, W0: 84.176, Wd: 14.1844 },
  Mercury: { a0: 281.0103, a0c: -0.0328, d0: 61.4155, d0c: -0.0049, W0: 329.5988, Wd: 6.1385108 },
  Venus: { a0: 272.76, d0: 67.16, W0: 160.20, Wd: -1.4813688 },
  Mars: { a0: 317.269202, a0c: -0.10927547, d0: 54.432516, d0c: -0.05827105, W0: 176.049863, Wd: 350.891982443297 },
  Jupiter: { a0: 268.056595, a0c: -0.006499, d0: 64.495303, d0c: 0.002413, W0: 284.95, Wd: 870.536642 },
  Saturn: { a0: 40.589, a0c: -0.036, d0: 83.537, d0c: -0.004, W0: 38.90, Wd: 810.7939024 },
  Uranus: { a0: 257.311, d0: -15.175, W0: 203.81, Wd: -501.1600928 },
  Neptune: { a0: 299.36, d0: 43.46, W0: 249.978, Wd: 541.1397757, nep: true },
  Pluto: { a0: 132.993, d0: -6.163, W0: 302.695, Wd: 56.3625225 },
};
function iauPole(id, tms) {
  const e = IAU[id], T = (tms - J2000_MS) / MS_DAY / 36525;
  let a0 = e.a0 + (e.a0c || 0) * T, d0 = e.d0 + (e.d0c || 0) * T, W = e.W0 + e.Wd * (tms - J2000_MS) / MS_DAY;
  if (e.nep) { const N = (357.85 + 52.316 * T) * DEG; a0 += 0.70 * Math.sin(N); d0 -= 0.51 * Math.cos(N); W -= 0.48 * Math.sin(N); }
  return { a0, d0, W };
}
function axesFromPole(a0, d0, W) {
  const a = a0 * DEG, d = d0 * DEG, w = W * DEG;
  const z = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const n = [-Math.sin(a), Math.cos(a), 0];
  const zn = v3.cross(z, n);
  const x = v3.add(v3.mul(n, Math.cos(w)), v3.mul(zn, Math.sin(w)));
  const y = v3.cross(z, x);
  return { x, y, z }; // EQJ
}
const axesToScene = ax => ({ x: eqj2scene(...ax.x), y: eqj2scene(...ax.y), z: eqj2scene(...ax.z) });
function poleEqj(id, tms) { const p = iauPole(id, tms); const a = p.a0 * DEG, d = p.d0 * DEG; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; }
function poleScene(id, tms) { return eqj2scene(...poleEqj(id, tms)); }

// ---------------- mean-element satellites (JPL SSD, epoch J2000) ----------------
function solveKepler(M, e) { let E = M + e * Math.sin(M); for (let i = 0; i < 8; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
function satFrameEqj(name, tms) {
  const s = SATS[name];
  let ra = s[10], dec = s[11];
  if (ra == null) { const p = iauPole(s[0], tms); ra = p.a0; dec = p.d0; }
  const a = ra * DEG, d = dec * DEG;
  const z = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const x = [-Math.sin(a), Math.cos(a), 0];
  return { x, y: v3.cross(z, x), z };
}
// returns offset from parent in km, EQJ axes
function satOffsetEqj(name, tms) {
  const s = SATS[name]; // [parent,a,e,w,M,i,node,P,Pw,Pnode,ra,dec]
  const dd = (tms - J2000_MS) / MS_DAY;
  const a = s[1], e = s[2];
  const w = (s[3] + (s[8] ? 360 * dd / (s[8] * 365.25) : 0)) * DEG;
  const node = (s[6] - (s[9] ? 360 * dd / (s[9] * 365.25) : 0)) * DEG;
  const inc = s[5] * DEG;
  const M = (((s[4] + 360 * dd / s[7]) % 360) + 360) % 360 * DEG;
  const E = solveKepler(M, e);
  const xo = a * (Math.cos(E) - e), yo = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cn = Math.cos(node), sn = Math.sin(node), ci = Math.cos(inc), si = Math.sin(inc);
  const X = xo * (cw * cn - sw * ci * sn) - yo * (sw * cn + cw * ci * sn);
  const Y = xo * (cw * sn + sw * ci * cn) - yo * (sw * sn - cw * ci * cn);
  const Z = xo * (sw * si) + yo * (cw * si);
  const F = satFrameEqj(name, tms);
  return v3.add(v3.add(v3.mul(F.x, X), v3.mul(F.y, Y)), v3.mul(F.z, Z));
}
function satOrbitPathSceneKm(name, tms, n = 120) {
  const P = SATS[name][7], out = [];
  for (let i = 0; i <= n; i++) { const o = satOffsetEqj(name, tms + (i / n) * P * MS_DAY); out.push(eqj2scene(...o)); }
  return out;
}

// ---------------- ephemeris state ----------------
const timeOf = ms => A.MakeTime(new Date(ms));
function computeState(tms) {
  const time = timeOf(tms);
  const pos = { Sun: [0, 0, 0] };
  const earthH = A.HelioVector(A.Body.Earth, time);
  for (const id of PLANETS) {
    const v = id === 'Earth' ? earthH : A.HelioVector(A.Body[id], time);
    pos[id] = vecAU2scene(v);
  }
  const gm = A.GeoMoon(time);
  pos.Moon = v3.add(pos.Earth, vecAU2scene(gm));
  const jm = A.JupiterMoons(time);
  for (const id of GALILEAN) {
    const sv = jm[id.toLowerCase()];
    pos[id] = v3.add(pos.Jupiter, vecAU2scene(sv));
  }
  for (const name in SATS) {
    const o = satOffsetEqj(name, tms);
    pos[name] = v3.add(pos[SATS[name][0]], eqj2scene(...o));
  }
  return { tms, time, pos, moonGeoKm: vecAU2scene(gm) };
}

// ---------------- orientation (axes in scene coords) ----------------
function earthAxes(time) {
  const g = A.SiderealTime(time) * 15 * DEG, r = A.Rotation_EQD_EQJ(time), t0 = time;
  const rot = (x, y, z) => { const v = A.RotateVector(r, new A.Vector(x, y, z, t0)); return eqj2scene(v.x, v.y, v.z); };
  return { x: rot(Math.cos(g), Math.sin(g), 0), y: rot(-Math.sin(g), Math.cos(g), 0), z: rot(0, 0, 1) };
}
// unit "up" vector at geographic lat/lon on Earth (scene axes)
function geoDir(ax, latDeg, lonDeg) {
  const p = latDeg * DEG, l = lonDeg * DEG;
  return v3.add(v3.add(v3.mul(ax.x, Math.cos(p) * Math.cos(l)), v3.mul(ax.y, Math.cos(p) * Math.sin(l))), v3.mul(ax.z, Math.sin(p)));
}
function moonAxes(time, moonGeoKm) {
  const u = v3.norm(v3.mul(moonGeoKm, -1)); // Moon -> Earth, scene
  const eclN = [0, 1, 0];
  const n0 = v3.norm(v3.sub(eclN, v3.mul(u, v3.dot(eclN, u))));
  const F0 = { x: u, y: v3.cross(n0, u), z: n0 };
  const lib = A.Libration(time), phi = lib.elat * DEG, lam = lib.elon * DEG;
  const Rz = (v, t) => [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t), v[2]];
  const Ry = (v, t) => [v[0] * Math.cos(t) + v[2] * Math.sin(t), v[1], -v[0] * Math.sin(t) + v[2] * Math.cos(t)];
  const Q = v => Ry(Rz(v, -lam), phi);
  const toScene = f => v3.add(v3.add(v3.mul(F0.x, f[0]), v3.mul(F0.y, f[1])), v3.mul(F0.z, f[2]));
  return { x: toScene(Q([1, 0, 0])), y: toScene(Q([0, 1, 0])), z: toScene(Q([0, 0, 1])) };
}
function satAxes(name, st) {
  // tidally locked: +X body axis (lon 0) toward parent
  const par = BODY[name].parent;
  const u = v3.norm(v3.sub(st.pos[par], st.pos[name]));
  const pole = v3.norm(v3.sub([0, 1, 0], v3.mul(u, u[1])));
  return { x: u, y: v3.cross(pole, u), z: pole };
}
function bodyAxes(id, st) {
  if (id === 'Earth') return earthAxes(st.time);
  if (id === 'Moon') return moonAxes(st.time, st.moonGeoKm);
  if (IAU[id]) { const p = iauPole(id, st.tms); return axesToScene(axesFromPole(p.a0, p.d0, p.W)); }
  if (BODY[id] && BODY[id].parent) return satAxes(id, st);
  return { x: [1, 0, 0], y: [0, 0, -1], z: [0, 1, 0] };
}

// ---------------- topocentric sky ----------------
const mkObs = (lat, lon, elev) => new A.Observer(lat, lon, elev || 0);
function skyBody(id, time, obs) {
  const body = A.Body[id];
  const eqd = A.Equator(body, time, obs, true, true);
  const hor = A.Horizon(time, obs, eqd.ra, eqd.dec, 'normal');
  const eqj = A.Equator(body, time, obs, false, true);
  const dist = eqj.dist; // AU
  return { id, ra: eqd.ra, dec: eqd.dec, alt: hor.altitude, az: hor.azimuth, distAU: dist, eqj: v3.norm([eqj.vec.x, eqj.vec.y, eqj.vec.z]) };
}
function angRadius(Rkm, distAU) { return Math.asin(Math.min(1, Rkm / (distAU * AU_KM))); }
function moonPhaseName(deg) {
  const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  return names[Math.floor(((deg + 22.5) % 360) / 45)];
}
function illum(id, time) { try { return A.Illumination(A.Body[id], time); } catch (e) { return null; } }

// overlap of two discs (angular radii a=sun, b=other, separation d) -> fraction of disc A covered
function discCoverFrac(a, b, d) {
  if (d >= a + b) return 0;
  if (d <= Math.abs(a - b)) return b >= a ? 1 : (b * b) / (a * a);
  const k1 = Math.acos(Math.max(-1, Math.min(1, (d * d + a * a - b * b) / (2 * d * a))));
  const k2 = Math.acos(Math.max(-1, Math.min(1, (d * d + b * b - a * a) / (2 * d * b))));
  const area = a * a * k1 + b * b * k2 - 0.5 * Math.sqrt(Math.max(0, (-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b)));
  return Math.min(1, Math.max(0, area / (Math.PI * a * a)));
}
// instantaneous solar-eclipse state at observer (exact disc geometry)
function solarEclipseNow(time, obs) {
  const s = skyBody('Sun', time, obs), m = skyBody('Moon', time, obs);
  const rs = angRadius(BODY.Sun.R, s.distAU), rm = angRadius(BODY.Moon.R, m.distAU);
  const dot = Math.max(-1, Math.min(1, v3.dot(s.eqj, m.eqj)));
  const cr = v3.len(v3.cross(s.eqj, m.eqj));
  const sep = Math.atan2(cr, dot);
  const obsc = discCoverFrac(rs, rm, sep);
  const mag = Math.max(0, (rs + rm - sep) / (2 * rs));
  return { obsc, mag, sep, rs, rm, sunAlt: s.alt, moonAlt: m.alt, sun: s, moon: m };
}
// Earth shadow geometry at the Moon (geocentric, km). Atmosphere-enlarged Earth (x1.02).
function lunarEclipseNow(time) {
  const m = A.GeoMoon(time), s = A.GeoVector(A.Body.Sun, time, true);
  const mk = [m.x * AU_KM, m.y * AU_KM, m.z * AU_KM], sk = [s.x * AU_KM, s.y * AU_KM, s.z * AU_KM];
  const dS = v3.len(sk), ax = v3.mul(sk, -1 / dS);
  const Re = BODY.Earth.R * 1.02, Rs = BODY.Sun.R, Rm = BODY.Moon.R;
  const x = v3.dot(mk, ax);
  const rho = v3.len(v3.sub(mk, v3.mul(ax, x)));
  const au = Math.asin((Rs - Re) / dS), ap = Math.asin((Rs + Re) / dS);
  const ru = Re - x * Math.tan(au), rp = Re + x * Math.tan(ap);
  return { umbMag: (ru + Rm - rho) / (2 * Rm), penMag: (rp + Rm - rho) / (2 * Rm), rho, ru, rp, behind: x > 0 };
}

// ---------------- searches ----------------
function globalSolarAfter(tms) { const e = A.SearchGlobalSolarEclipse(timeOf(tms)); return { type: 'solar', kind: e.kind, peak: e.peak.date.getTime(), obsc: e.obscuration, lat: e.latitude, lon: e.longitude }; }
function nextGlobalSolar(prevPeakMs) { const e = A.NextGlobalSolarEclipse(timeOf(prevPeakMs)); return { type: 'solar', kind: e.kind, peak: e.peak.date.getTime(), obsc: e.obscuration, lat: e.latitude, lon: e.longitude }; }
function lunarAfter(tms) { const e = A.SearchLunarEclipse(timeOf(tms)); return lunarInfo(e); }
function nextLunar(prevPeakMs) { return lunarInfo(A.NextLunarEclipse(timeOf(prevPeakMs))); }
function lunarInfo(e) {
  const p = e.peak.date.getTime();
  return { type: 'lunar', kind: e.kind, peak: p, obsc: e.obscuration, sdPen: e.sd_penum, sdPart: e.sd_partial, sdTot: e.sd_total };
}
// next (dir=+1) / previous (dir=-1) global eclipse of a type
function stepGlobal(type, tms, dir) {
  const first = type === 'solar' ? globalSolarAfter : lunarAfter, nxt = type === 'solar' ? nextGlobalSolar : nextLunar;
  if (dir > 0) return first(tms + 1000);
  let start = tms - 210 * MS_DAY, e = first(start), last = null;
  for (let guard = 0; guard < 6; guard++) {
    while (e.peak < tms - 1000) { last = e; e = nxt(e.peak + 3600000); }
    if (last) return last;
    start -= 210 * MS_DAY; e = first(start);
  }
  return last;
}
// local visibility of a solar eclipse (observer sees any phase with Sun above horizon)
function localSolar(peakMs, obs) {
  const e = A.SearchLocalSolarEclipse(timeOf(peakMs - 3 * MS_DAY), obs);
  const pk = e.peak.time.date.getTime();
  if (Math.abs(pk - peakMs) > 2 * MS_DAY) return null;
  const ph = x => x ? { ms: x.time.date.getTime(), alt: x.altitude } : null;
  return { kind: e.kind, obsc: e.obscuration, peak: ph(e.peak), pb: ph(e.partial_begin), pe: ph(e.partial_end), tb: ph(e.total_begin), te: ph(e.total_end) };
}
function moonAltAt(ms, obs) { const t = timeOf(ms); const q = A.Equator(A.Body.Moon, t, obs, true, true); return A.Horizon(t, obs, q.ra, q.dec, 'normal').altitude; }
function localLunar(ev, obs) {
  const pts = { pen0: ev.peak - ev.sdPen * 60000, par0: ev.sdPart > 0 ? ev.peak - ev.sdPart * 60000 : null, tot0: ev.sdTot > 0 ? ev.peak - ev.sdTot * 60000 : null, peak: ev.peak, tot1: ev.sdTot > 0 ? ev.peak + ev.sdTot * 60000 : null, par1: ev.sdPart > 0 ? ev.peak + ev.sdPart * 60000 : null, pen1: ev.peak + ev.sdPen * 60000 };
  const out = {};
  let anyUp = false;
  for (const k in pts) { if (pts[k] == null) continue; const alt = moonAltAt(pts[k], obs); out[k] = { ms: pts[k], alt }; if (alt > 0) anyUp = true; }
  return { visible: anyUp, peakAlt: out.peak.alt, pts: out };
}
function eclipseList(t0, t1, obs) {
  const res = [];
  let e = globalSolarAfter(t0);
  for (let g = 0; e.peak <= t1 && g < 400; g++) { const l = localSolar(e.peak, obs); e.visible = !!l && (l.peak.alt > -1 || (l.pb && l.pb.alt > 0) || (l.pe && l.pe.alt > 0)); e.local = l; res.push(e); e = nextGlobalSolar(e.peak + 3600000); }
  let l = lunarAfter(t0);
  for (let g = 0; l.peak <= t1 && g < 400; g++) { const lo = localLunar(l, obs); l.visible = lo.visible; l.local = lo; res.push(l); l = nextLunar(l.peak + 3600000); }
  return res.sort((a, b) => a.peak - b.peak);
}
// kind label
function kindLabel(ev) {
  const k = ev.kind; const nm = k[0].toUpperCase() + k.slice(1);
  return `${nm} ${ev.type === 'solar' ? 'solar' : 'lunar'}`;
}

// generic "previous by forward search" helper
function prevByForward(searchFn, tms, windowMs) {
  let start = tms - windowMs, best = null, guard = 0;
  let r = searchFn(start);
  while (r != null && r < tms - 1000 && guard++ < 40) { best = r; r = searchFn(r + 3600000); }
  return best;
}
const T2MS = t => (t && t.date ? t.date.getTime() : null);
const EVENT_SEARCH = {
  // each returns ms of first event strictly after tms (forward), or null
  newMoon: t => T2MS(A.SearchMoonPhase(0, timeOf(t), 40)),
  firstQuarter: t => T2MS(A.SearchMoonPhase(90, timeOf(t), 40)),
  fullMoon: t => T2MS(A.SearchMoonPhase(180, timeOf(t), 40)),
  lastQuarter: t => T2MS(A.SearchMoonPhase(270, timeOf(t), 40)),
  equinoxMar: t => seasonAfter(t, 'mar_equinox'), solsticeJun: t => seasonAfter(t, 'jun_solstice'),
  equinoxSep: t => seasonAfter(t, 'sep_equinox'), solsticeDec: t => seasonAfter(t, 'dec_solstice'),
  perihelion: t => T2MS(A.SearchPlanetApsis(A.Body.Earth, timeOf(t)).time),
  aphelion: t => { let a = A.SearchPlanetApsis(A.Body.Earth, timeOf(t)); if (a.kind === 0) a = A.NextPlanetApsis(A.Body.Earth, a); return T2MS(a.time); },
};
function seasonAfter(t, key) {
  const y = new Date(t).getUTCFullYear();
  for (let yy = y; yy <= y + 1; yy++) { const v = T2MS(A.Seasons(yy)[key]); if (v > t) return v; }
  return null;
}
['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].forEach(p => { EVENT_SEARCH['opp_' + p] = t => T2MS(A.SearchRelativeLongitude(A.Body[p], 180, timeOf(t))); });
['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].forEach(p => { EVENT_SEARCH['conj_' + p] = t => T2MS(A.SearchRelativeLongitude(A.Body[p], 0, timeOf(t))); });
['Mercury', 'Venus'].forEach(p => { EVENT_SEARCH['elong_' + p] = t => T2MS(A.SearchMaxElongation(A.Body[p], timeOf(t)).time); });
const EVENT_WINDOW = { newMoon: 31 * MS_DAY, firstQuarter: 31 * MS_DAY, fullMoon: 31 * MS_DAY, lastQuarter: 31 * MS_DAY, equinoxMar: 400 * MS_DAY, solsticeJun: 400 * MS_DAY, equinoxSep: 400 * MS_DAY, solsticeDec: 400 * MS_DAY, perihelion: 400 * MS_DAY, aphelion: 400 * MS_DAY };
function findEvent(key, tms, dir) {
  const f = EVENT_SEARCH[key];
  if (!f) return null;
  if (dir > 0) return f(tms + 1000);
  return prevByForward(f, tms, EVENT_WINDOW[key] || 800 * MS_DAY);
}
// meteor shower peaks (APPROXIMATE: fixed UTC calendar dates; radiants J2000 deg)
const METEORS = [
  { name: 'Quadrantids', mo: 1, d: 3, h: 14, ra: 230, dec: 49.5, zhr: 80 },
  { name: 'Lyrids', mo: 4, d: 22, h: 6, ra: 271, dec: 34, zhr: 18 },
  { name: 'Eta Aquariids', mo: 5, d: 6, h: 6, ra: 338, dec: -1, zhr: 50 },
  { name: 'Delta Aquariids', mo: 7, d: 30, h: 6, ra: 340, dec: -16, zhr: 25 },
  { name: 'Perseids', mo: 8, d: 12, h: 18, ra: 48, dec: 58, zhr: 100 },
  { name: 'Orionids', mo: 10, d: 21, h: 12, ra: 95, dec: 16, zhr: 20 },
  { name: 'Southern Taurids', mo: 11, d: 5, h: 12, ra: 52, dec: 13, zhr: 5 },
  { name: 'Leonids', mo: 11, d: 17, h: 12, ra: 152, dec: 22, zhr: 15 },
  { name: 'Geminids', mo: 12, d: 14, h: 12, ra: 112, dec: 33, zhr: 150 },
  { name: 'Ursids', mo: 12, d: 22, h: 12, ra: 217, dec: 76, zhr: 10 },
];
function meteorPeak(m, year) { return utcFromParts(year, m.mo, m.d, m.h); }
function findMeteor(tms, dir) {
  const y = new Date(tms).getUTCFullYear(); const all = [];
  for (let yy = y - 1; yy <= y + 1; yy++) METEORS.forEach(m => all.push({ ...m, ms: meteorPeak(m, yy) }));
  all.sort((a, b) => a.ms - b.ms);
  if (dir > 0) return all.find(m => m.ms > tms + 1000);
  return [...all].reverse().find(m => m.ms < tms - 1000);
}

// ---------------- night window / "what's up" ----------------
function nightWindow(tms, obs, tz) {
  // evening of the picked local date: sunset after local noon, then next sunrise
  const p = partsInZone(tms, tz);
  const noon = localToUTC(p.y, p.mo, p.d, 12, 0, 0, tz).ms;
  const set = A.SearchRiseSet(A.Body.Sun, obs, -1, timeOf(noon), 1.2);
  if (!set) return null;
  const rise = A.SearchRiseSet(A.Body.Sun, obs, +1, set, 1.2);
  if (!rise) return null;
  return { from: set.date.getTime(), to: rise.date.getTime() };
}
function upTonight(tms, obs, tz) {
  const w = nightWindow(tms, obs, tz);
  if (!w) return { window: null, rows: [] };
  const rows = [];
  for (const id of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']) {
    let upSteps = 0, steps = 0, first = null, last = null, maxAlt = -90;
    for (let t = w.from; t <= w.to; t += 20 * 60000) {
      const tt = timeOf(t), q = A.Equator(A.Body[id], tt, obs, true, true), alt = A.Horizon(tt, obs, q.ra, q.dec, 'normal').altitude;
      steps++; if (alt > 8) { upSteps++; if (first == null) first = t; last = t; } if (alt > maxAlt) maxAlt = alt;
    }
    if (upSteps) rows.push({ id, first, last, maxAlt, all: upSteps === steps, naked: NAKED_EYE.has(id) });
  }
  return { window: w, rows };
}
