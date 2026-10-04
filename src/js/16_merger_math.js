// ===================== 16_merger_math.js — Milky Way x Andromeda: restricted N-body (no DOM, no THREE) =====================
// Units: kpc, km/s, mass in Msun; time unit TU = kpc/(km/s) = 977.79 Myr. Each galaxy is a softened, truncated isothermal halo
// (flat rotation curve v0 out to Rt) whose centre follows a two-body orbit with Chandrasekhar dynamical friction; the stars are
// massless test particles that feel both galaxies. This is Toomre-style "restricted three-body" physics: it reproduces the tidal
// tails, bridge and relaxed remnant qualitatively, and the orbit is tuned to the published timeline (Cox & Loeb 2008; van der
// Marel et al. 2012: first pericentre ~4 Gyr from now, second ~6 Gyr, coalescence ~7 Gyr). It is illustrative, not a full simulation.
const MG_G = 4.30091e-6, MG_TU = 977.792;
const MG_P = {
  v1: 225, v2: 250,          // km/s, flat rotation speeds of the Milky Way and Andromeda haloes
  rc: 3.0, Rt: 125,          // kpc, softening core and truncation radius of each halo
  rDF: 100, dfEta: 0.05, lnL: 3.0,     // dynamical-friction strength (tuned to the published timeline)
  dtMyr: 2.0,                // integration step
  tMaxMyr: 10000,            // simulated span
  vRad: -109.3, vTan: 28,    // km/s, M31 radial (towards us) and tangential velocity (Sohn+2012, van der Marel+2012)
};
function mgMass(v0, P = MG_P) { return v0 * v0 * P.Rt / MG_G; }
// acceleration magnitude of one halo at distance r (towards its centre)
function mgAccMag(v0, r, P = MG_P) { return r < P.Rt ? v0 * v0 * r / (r * r + P.rc * P.rc) : v0 * v0 * P.Rt / (P.Rt * P.Rt + P.rc * P.rc) * (P.Rt / r) * (P.Rt / r); }
function mgRho(v0, r, P = MG_P) { const f = r < 0.55 * P.rDF ? 1 : r > P.rDF ? 0 : (P.rDF - r) / (0.45 * P.rDF); return f * v0 * v0 / (4 * Math.PI * MG_G * (r * r + P.rc * P.rc)); }
function mgErf(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
// relative orbit of the two centres. R0 = position of M31 relative to the Milky Way (kpc, galaxy frame).
// Returns per-step tracks of both centres in the barycentre frame plus the detected close-approach times.
function mergerOrbit(R0, P = MG_P) {
  const n = Math.round(P.tMaxMyr / P.dtMyr), dt = P.dtMyr / MG_TU, m1 = mgMass(P.v1, P), m2 = mgMass(P.v2, P), mu1 = m1 / (m1 + m2), mu2 = m2 / (m1 + m2);
  const r0 = Math.hypot(R0[0], R0[1], R0[2]), rh = R0.map(x => x / r0);
  // tangential direction: perpendicular to the line of sight, in the horizontal plane (arbitrary but fixed)
  let tx = -rh[2], ty = 0, tz = rh[0]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
  const x = [R0[0], R0[1], R0[2]], v = [P.vRad * rh[0] + P.vTan * tx, P.vRad * rh[1] + P.vTan * ty, P.vRad * rh[2] + P.vTan * tz];
  const acc = (x, v, out) => {
    const r = Math.hypot(x[0], x[1], x[2]) + 1e-9, a = mgAccMag(P.v1, r, P) + mgAccMag(P.v2, r, P);
    let ax = -a * x[0] / r, ay = -a * x[1] / r, az = -a * x[2] / r;
    const sp = Math.hypot(v[0], v[1], v[2]);
    if (sp > 1e-6) { const rho = mgRho(P.v1, r, P) + mgRho(P.v2, r, P), sig = Math.max(P.v1, P.v2) / Math.SQRT2, X = sp / (Math.SQRT2 * sig), F = X < 0.3 ? 4 / (3 * Math.sqrt(Math.PI)) * X * X * X * (1 - 0.6 * X * X) : mgErf(X) - 2 * X * Math.exp(-X * X) / Math.sqrt(Math.PI);
      const d = P.dfEta * 4 * Math.PI * MG_G * MG_G * (m1 + m2) * P.lnL * rho * F / (sp * sp); ax -= d * v[0] / sp; ay -= d * v[1] / sp; az -= d * v[2] / sp; }
    if (r < 8) { const g = 14 * (1 - r / 8); ax -= g * v[0]; ay -= g * v[1]; az -= g * v[2]; }   // cores have merged: the last wobble dies out
    out[0] = ax; out[1] = ay; out[2] = az;
  };
  const c1 = new Float32Array((n + 1) * 3), c2 = new Float32Array((n + 1) * 3), rr = new Float32Array(n + 1), a = [0, 0, 0];
  const put = i => { c1[i * 3] = -mu2 * x[0]; c1[i * 3 + 1] = -mu2 * x[1]; c1[i * 3 + 2] = -mu2 * x[2]; c2[i * 3] = mu1 * x[0]; c2[i * 3 + 1] = mu1 * x[1]; c2[i * 3 + 2] = mu1 * x[2]; rr[i] = Math.hypot(x[0], x[1], x[2]); };
  put(0);
  for (let i = 1; i <= n; i++) {
    acc(x, v, a); for (let k = 0; k < 3; k++) v[k] += a[k] * dt * 0.5;
    for (let k = 0; k < 3; k++) x[k] += v[k] * dt;
    acc(x, v, a); for (let k = 0; k < 3; k++) v[k] += a[k] * dt * 0.5;
    put(i);
  }
  // close approaches = local minima of separation below 60 kpc
  const peri = []; for (let i = 2; i < n - 1; i++) if (rr[i] < rr[i - 1] && rr[i] <= rr[i + 1] && rr[i] < 60 && (!peri.length || (i - peri[peri.length - 1].i) * P.dtMyr > 400)) peri.push({ i, tMyr: i * P.dtMyr, r: rr[i] });
  let merged = n * P.dtMyr; for (let i = n; i > 0; i--) { if (rr[i] > 10) { merged = (i + 1) * P.dtMyr; break; } }
  return { n, dtMyr: P.dtMyr, dt, c1, c2, r: rr, peri, mergedMyr: merged, mu1, mu2, m1, m2, R0, r0 };
}
function mgRand(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// orthonormal basis (e1,e2,n) from a disc normal n
function mgBasis(n) { const nl = Math.hypot(n[0], n[1], n[2]); n = n.map(x => x / nl); const h = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let e1 = [h[1] * n[2] - h[2] * n[1], h[2] * n[0] - h[0] * n[2], h[0] * n[1] - h[1] * n[0]]; const l = Math.hypot(...e1); e1 = e1.map(x => x / l); const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]]; return { e1, e2, n }; }
// initial particles. nA stars for the Milky Way, nB for Andromeda. nM31 = M31 disc normal (spin axis) in the galaxy frame.
function mergerInit(nA, nB, orbit, normalM31, P = MG_P) {
  const N = nA + nB, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), own = new Uint8Array(N), kind = new Uint8Array(N), rnd = mgRand(2718);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) * 1.732; };
  const gal = [{ c: [orbit.c1[0], orbit.c1[1], orbit.c1[2]], v0: P.v1, Rd: 3.0, n: [0, -1, 0], N: nA, vc: [0, 0, 0] }, { c: [orbit.c2[0], orbit.c2[1], orbit.c2[2]], v0: P.v2, Rd: 5.3, n: normalM31, N: nB, vc: [0, 0, 0] }];
  // centre velocities from the first two orbit samples
  for (const [g, c] of [[gal[0], orbit.c1], [gal[1], orbit.c2]]) for (let k = 0; k < 3; k++) g.vc[k] = (c[3 + k] - c[k]) / orbit.dt;
  let idx = 0, sunIdx = -1;
  gal.forEach((g, gi) => {
    const B = mgBasis(g.n), Rmax = gi ? 30 : 22;
    for (let i = 0; i < g.N; i++, idx++) {
      let k = rnd() < 0.74 ? 0 : rnd() < 0.72 ? 1 : 2;               // 0 disc, 1 bulge, 2 halo
      let R, z, ph = rnd() * 6.2832, x, y, zz, sig = 0.06;
      if (k === 0) { let q = 0; do { q = -Math.log(1 - rnd()) ; } while (q * g.Rd > Rmax); R = q * g.Rd; zz = gauss() * 0.3 * (1 + R / 12) * (gi ? 1.2 : 1); sig = 0.07; }
      else if (k === 1) { R = Math.abs(gauss()) * 1.6 + 0.05; zz = gauss() * 1.0; sig = 0.55; }
      else { const r = Math.pow(rnd(), 1.4) * 70 + 1; const u = rnd() * 2 - 1, th = rnd() * 6.2832, s = Math.sqrt(1 - u * u); x = r * s * Math.cos(th); y = r * s * Math.sin(th); zz = r * u; R = -1; sig = 0.55; }
      let px, py, pz, vx, vy, vz;
      if (R >= 0) {
        const lx = R * Math.cos(ph), ly = R * Math.sin(ph), vcirc = g.v0 * R / Math.sqrt(R * R + P.rc * P.rc), vt = k === 1 ? vcirc * 0.35 : vcirc;
        px = lx * B.e1[0] + ly * B.e2[0] + zz * B.n[0]; py = lx * B.e1[1] + ly * B.e2[1] + zz * B.n[1]; pz = lx * B.e1[2] + ly * B.e2[2] + zz * B.n[2];
        // tangential direction: spin axis x radial (matches the prograde sense of each disc about its normal)
        const rx = Math.cos(ph) * B.e1[0] + Math.sin(ph) * B.e2[0], ry = Math.cos(ph) * B.e1[1] + Math.sin(ph) * B.e2[1], rz = Math.cos(ph) * B.e1[2] + Math.sin(ph) * B.e2[2];
        const tx = B.n[1] * rz - B.n[2] * ry, ty = B.n[2] * rx - B.n[0] * rz, tz = B.n[0] * ry - B.n[1] * rx;
        vx = tx * vt + gauss() * g.v0 * sig; vy = ty * vt + gauss() * g.v0 * sig; vz = tz * vt + gauss() * g.v0 * sig;
      } else { px = x; py = y; pz = zz; const r = Math.hypot(px, py, pz); const vc = g.v0 * r / Math.sqrt(r * r + P.rc * P.rc); vx = gauss() * vc * 0.6; vy = gauss() * vc * 0.6; vz = gauss() * vc * 0.6; }
      pos[idx * 3] = g.c[0] + px; pos[idx * 3 + 1] = g.c[1] + py; pos[idx * 3 + 2] = g.c[2] + pz;
      vel[idx * 3] = g.vc[0] + vx; vel[idx * 3 + 1] = g.vc[1] + vy; vel[idx * 3 + 2] = g.vc[2] + vz; own[idx] = gi; kind[idx] = k;
    }
  });
  // the Sun: a Milky Way disc test particle placed at R0 = 8.18 kpc on a circular orbit (so we can follow its fate)
  { sunIdx = 0; const i = sunIdx; const B = mgBasis(gal[0].n), R = 8.18, vc = P.v1 * R / Math.sqrt(R * R + P.rc * P.rc);
    pos[i * 3] = gal[0].c[0] + R * B.e1[0]; pos[i * 3 + 1] = gal[0].c[1] + R * B.e1[1]; pos[i * 3 + 2] = gal[0].c[2] + R * B.e1[2];
    const tx = B.n[1] * B.e1[2] - B.n[2] * B.e1[1], ty = B.n[2] * B.e1[0] - B.n[0] * B.e1[2], tz = B.n[0] * B.e1[1] - B.n[1] * B.e1[0];
    vel[i * 3] = gal[0].vc[0] + tx * vc; vel[i * 3 + 1] = gal[0].vc[1] + ty * vc; vel[i * 3 + 2] = gal[0].vc[2] + tz * vc; own[i] = 0; kind[i] = 0; }
  return { N, nA, nB, pos, vel, own, kind, sunIdx, k: 0 };
}
// advance n steps (n >= 1) forward (s = +1) or backward (s = -1) in time with a reversible, fused kick-drift-kick leapfrog:
// one force evaluation per step. Returns the number of steps actually taken (stops at the ends of the orbit track).
function mergerAdvance(st, orb, n, s, P = MG_P) {
  const i0 = st.k; n = Math.min(n, s > 0 ? orb.n - i0 : i0); if (n <= 0) return 0;
  const N = st.N, pos = st.pos, vel = st.vel, v1 = P.v1 * P.v1, v2 = P.v2 * P.v2, rc2 = P.rc * P.rc, Rt = P.Rt, Rt2 = Rt * Rt, c1 = orb.c1, c2 = orb.c2;
  const k1out = v1 * Rt * Rt * Rt / (Rt2 + rc2), k2out = v2 * Rt * Rt * Rt / (Rt2 + rc2), dts = s * orb.dt;
  const kick = (q, hh) => {
    const ax1 = c1[q * 3], ay1 = c1[q * 3 + 1], az1 = c1[q * 3 + 2], ax2 = c2[q * 3], ay2 = c2[q * 3 + 1], az2 = c2[q * 3 + 2];
    for (let p = 0, o = 0; p < N; p++, o += 3) {
      const px = pos[o], py = pos[o + 1], pz = pos[o + 2];
      let dx = px - ax1, dy = py - ay1, dz = pz - az1, r2 = dx * dx + dy * dy + dz * dz, f = r2 < Rt2 ? v1 / (r2 + rc2) : k1out / (r2 * Math.sqrt(r2));
      let ax = -f * dx, ay = -f * dy, az = -f * dz;
      dx = px - ax2; dy = py - ay2; dz = pz - az2; r2 = dx * dx + dy * dy + dz * dz; f = r2 < Rt2 ? v2 / (r2 + rc2) : k2out / (r2 * Math.sqrt(r2));
      vel[o] += (ax - f * dx) * hh; vel[o + 1] += (ay - f * dy) * hh; vel[o + 2] += (az - f * dz) * hh;
    }
  };
  kick(i0, dts * 0.5);
  for (let m = 1; m <= n; m++) {
    for (let p = 0; p < N * 3; p++) pos[p] += vel[p] * dts;
    kick(i0 + s * m, m === n ? dts * 0.5 : dts);
  }
  st.k = i0 + s * n; return n;
}
function mgCloneState(st) { return { N: st.N, nA: st.nA, nB: st.nB, pos: st.pos.slice(), vel: st.vel.slice(), own: st.own, kind: st.kind, sunIdx: st.sunIdx, k: st.k }; }
// summary of the remnant at step k: half-mass radius about the centre of mass, axis ratios from the inertia tensor, Sun's distance
function mergerRemnant(st, orb) {
  const N = st.N; let cx = 0, cy = 0, cz = 0; for (let p = 0; p < N; p++) { cx += st.pos[p * 3]; cy += st.pos[p * 3 + 1]; cz += st.pos[p * 3 + 2]; } cx /= N; cy /= N; cz /= N;
  const rs = new Float32Array(N); let Ixx = 0, Iyy = 0, Izz = 0, Ixy = 0, Ixz = 0, Iyz = 0, n = 0;
  for (let p = 0; p < N; p++) { const x = st.pos[p * 3] - cx, y = st.pos[p * 3 + 1] - cy, z = st.pos[p * 3 + 2] - cz, r = Math.hypot(x, y, z); rs[p] = r; if (r < 60) { Ixx += x * x; Iyy += y * y; Izz += z * z; Ixy += x * y; Ixz += x * z; Iyz += y * z; n++; } }
  const sorted = Array.from(rs).sort((a, b) => a - b), rh = sorted[N >> 1];
  // eigenvalues of the 3x3 second-moment tensor (Jacobi sweeps)
  let A = [[Ixx, Ixy, Ixz], [Ixy, Iyy, Iyz], [Ixz, Iyz, Izz]].map(r => r.map(v => v / Math.max(1, n)));
  for (let it = 0; it < 30; it++) for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) { if (Math.abs(A[a][b]) < 1e-12) continue; const th = 0.5 * Math.atan2(2 * A[a][b], A[b][b] - A[a][a]), c = Math.cos(th), s = Math.sin(th); for (let k = 0; k < 3; k++) { const x = A[a][k], y = A[b][k]; A[a][k] = c * x - s * y; A[b][k] = s * x + c * y; } for (let k = 0; k < 3; k++) { const x = A[k][a], y = A[k][b]; A[k][a] = c * x - s * y; A[k][b] = s * x + c * y; } }
  const ev = [A[0][0], A[1][1], A[2][2]].sort((a, b) => b - a), si = st.sunIdx, sd = si >= 0 ? Math.hypot(st.pos[si * 3] - cx, st.pos[si * 3 + 1] - cy, st.pos[si * 3 + 2] - cz) : NaN;
  return { rHalf: rh, ba: Math.sqrt(Math.max(0, ev[1]) / ev[0]), ca: Math.sqrt(Math.max(0, ev[2]) / ev[0]), sunDist: sd, center: [cx, cy, cz] };
}
