// Node harness: evaluates the pure-logic modules (no DOM/THREE) and checks them against known events.
const fs = require('fs'), path = require('path'), vm = require('vm');
global.Astronomy = require('astronomy-engine');
const src = ['src/assets.js', 'src/eclipses.js', 'src/js/00_util.js', 'src/js/10_astro.js', 'src/js/15_galaxy_math.js', 'src/js/16_merger_math.js', 'src/js/17_sun_life.js'].map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
const ctx = vm.createContext({ Astronomy: global.Astronomy, console, Date, Math, Intl, Set, Object, Array, JSON, Number, String, isFinite, parseInt, Float32Array, Uint8Array });
vm.runInContext(src + '\n;this.__api={mergerOrbit,mergerInit,mergerAdvance,mergerRemnant,MG_P,lifeState,LIFE_PHASES,LIFE_KEYS,LIFE_PLANETS,lifeUofT,bbColor,R_SUN_AU,galaxyBasis,armCrossings,nearestArm,LOCAL_GROUP,LANIAKEA,lbToFrame,MASS_EXT,sunOrbit,sunAt,galaxyDrift,buildMilkyWay,ARMS,armXZ,spurXZ,GM,ECLIPSE_TABLE,STARS,runTimeSelfTests,computeState,solarEclipseNow,lunarEclipseNow,mkObs,timeOf,utcFromParts,localToUTC,partsInZone,eclipseList,findEvent,stepGlobal,localSolar,upTonight,skyBody,earthAxes,geoDir,BODY,v3,SATS,fmtUTC,fmtLocal,findMeteor,moonAxes,discCoverFrac,globalSolarAfter,lunarAfter,localLunar,AU_KM,J2000_MS,nightWindow};', ctx);
const X = ctx.__api;
let fail = 0;
const ok = (n, c, i = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '  — ' + i : '')); if (!c) fail++; };
// time self tests
for (const r of X.runTimeSelfTests()) ok(r.name, r.ok, r.info);
// ephemeris sanity
const t = X.utcFromParts(2024, 4, 8, 18, 42, 37);
const st = X.computeState(t);
const dE = X.v3.len(st.pos.Earth) / X.AU_KM; ok('Earth heliocentric distance ~1 AU', Math.abs(dE - 1.0) < 0.02, dE.toFixed(4));
const dM = X.v3.len(X.v3.sub(st.pos.Moon, st.pos.Earth)); ok('Moon distance 356-407k km', dM > 356000 && dM < 407000, dM.toFixed(0));
for (const n of Object.keys(X.SATS)) { const d = X.v3.len(X.v3.sub(st.pos[n], st.pos[X.SATS[n][0]])); const a = X.SATS[n][1]; ok(`${n} orbit radius ~a`, Math.abs(d / a - 1) < 0.1, `${d.toFixed(0)} vs a=${a}`); }
const io = X.v3.len(X.v3.sub(st.pos.Io, st.pos.Jupiter)); ok('Io distance ~421,800 km', Math.abs(io / 421800 - 1) < 0.02, io.toFixed(0));
// eclipses
const dallas = X.mkObs(32.7767, -96.797, 131);
const e = X.solarEclipseNow(X.timeOf(t), dallas); ok('Dallas 2024-04-08 18:42:37 UTC obscuration ≈ 1', e.obsc > 0.999, e.obsc.toFixed(5) + ' mag ' + e.mag.toFixed(4));
const e2 = X.solarEclipseNow(X.timeOf(X.utcFromParts(2024, 4, 8, 17, 30)), dallas); ok('Dallas 17:30 UTC partial 0<obsc<0.3', e2.obsc > 0 && e2.obsc < 0.3, e2.obsc.toFixed(3));
const loc = X.localSolar(X.globalSolarAfter(X.utcFromParts(2024, 3, 1)).peak, dallas);
console.log('  Dallas local: total begin', X.fmtUTC(loc.tb.ms), 'peak', X.fmtUTC(loc.peak.ms), 'end', X.fmtUTC(loc.te.ms));
ok('Dallas totality begins ~18:40 UTC (NASA 1:40 pm CDT=18:40)', Math.abs(loc.tb.ms - X.utcFromParts(2024, 4, 8, 18, 40, 20)) < 120000);
// 2017 Carbondale
const carb = X.mkObs(37.7273, -89.2168, 120);
const g17 = X.globalSolarAfter(X.utcFromParts(2017, 6, 1)); const l17 = X.localSolar(g17.peak, carb);
console.log('  2017 greatest (global)', X.fmtUTC(g17.peak), 'Carbondale peak', X.fmtUTC(l17.peak.ms), l17.kind);
// 2026-08-12 Spain
const spain = X.mkObs(42.35, -3.7, 850);
const g26 = X.globalSolarAfter(X.utcFromParts(2026, 7, 1)); const l26 = X.localSolar(g26.peak, spain);
console.log('  2026 greatest (global)', X.fmtUTC(g26.peak), g26.kind, 'Burgos peak', X.fmtUTC(l26.peak.ms), l26.kind, 'obsc', l26.obsc.toFixed(4));
// 2027 Luxor
const luxor = X.mkObs(25.69, 32.64, 80);
const g27 = X.globalSolarAfter(X.utcFromParts(2027, 6, 1)); const l27 = X.localSolar(g27.peak, luxor);
console.log('  2027 greatest (global)', X.fmtUTC(g27.peak), g27.kind, 'Luxor peak', X.fmtUTC(l27.peak.ms), l27.kind, 'dur', ((l27.te.ms - l27.tb.ms) / 1000).toFixed(0) + 's');
// lunar
const L25 = X.lunarAfter(X.utcFromParts(2025, 8, 1)); console.log('  2025 lunar', L25.kind, X.fmtUTC(L25.peak));
const ln = X.lunarEclipseNow(X.timeOf(L25.peak)); ok('2025-09-07 umbral magnitude ≈ 1.36', Math.abs(ln.umbMag - 1.36) < 0.1, ln.umbMag.toFixed(3));
const L26 = X.lunarAfter(X.utcFromParts(2026, 8, 1)); console.log('  2026 lunar', L26.kind, X.fmtUTC(L26.peak));
// 1969 moon
const s69 = X.computeState(X.utcFromParts(1969, 7, 20, 20, 17)); 
const mp = Astronomy.MoonPhase(X.timeOf(X.utcFromParts(1969, 7, 20, 20, 17))); console.log('  1969-07-20 20:17 UTC moon phase angle', mp.toFixed(1));
// list
const t0 = Date.now(); const lst = X.eclipseList(X.utcFromParts(2026, 1, 1), X.utcFromParts(2028, 12, 31), dallas); console.log('  eclipse list 2026-2028:', lst.length, 'in', Date.now() - t0, 'ms');
lst.forEach(x => console.log('   ', X.fmtUTC(x.peak), x.type, x.kind, x.visible ? 'visible' : '-'));
// events
console.log('  next full moon after 2026-09-30:', X.fmtUTC(X.findEvent('fullMoon', X.utcFromParts(2026, 9, 30), 1)));
console.log('  prev new moon before 2026-09-30:', X.fmtUTC(X.findEvent('newMoon', X.utcFromParts(2026, 9, 30), -1)));
console.log('  next opposition Mars:', X.fmtUTC(X.findEvent('opp_Mars', X.utcFromParts(2026, 9, 30), 1)), ' prev:', X.fmtUTC(X.findEvent('opp_Mars', X.utcFromParts(2026, 9, 30), -1)));
console.log('  prev solar global before 2026-09-30:', X.fmtUTC(X.stepGlobal('solar', X.utcFromParts(2026, 9, 30), -1).peak));
console.log('  upTonight Madrid 2026-09-30:', JSON.stringify(X.upTonight(X.utcFromParts(2026, 9, 30, 18), X.mkObs(40.4, -3.7, 650), 'Europe/Madrid').rows.map(r => r.id + ' ' + r.maxAlt.toFixed(0))));
// earth axes sanity: at 12:00 UTC on equinox the lon-0 point faces the Sun
const eq = X.utcFromParts(2025, 3, 20, 12, 0); const se = X.computeState(eq); const ax = X.earthAxes(se.time);
const sunDir = X.v3.norm(X.v3.mul(se.pos.Earth, -1)); const lon0 = X.v3.dot(ax.x, sunDir);
console.log('  Earth lon0·sun at 2025-03-20 12:00 UTC =', lon0.toFixed(3), '(expect ~ +0.98: noon at Greenwich)');
ok('Greenwich faces Sun near 12:00 UTC (equinox)', lon0 > 0.97);
const sunMad = X.v3.dot(X.geoDir(ax, 0, 90), sunDir); console.log('  lon 90E·sun =', sunMad.toFixed(3), '(expect ~ 0)');
// precomputed eclipse table (src/eclipses.js)
{
  const T = X.ECLIPSE_TABLE, decode = tab => { let t = T.base; return tab.d.map((d, i) => ({ ms: (t += d) * 60000, k: tab.k[i] })); };
  const so = decode(T.solar), lu = decode(T.lunar);
  ok('eclipse table: counts', so.length > 4700 && lu.length > 4800, `${so.length} solar, ${lu.length} lunar`);
  const near = (arr, iso) => arr.find(e => Math.abs(e.ms - Date.parse(iso)) < 3600e3);
  const e24 = near(so, '2024-04-08T18:17:00Z'); ok('eclipse table: 2024-04-08 total solar', e24 && e24.k === 'T', e24 && e24.k);
  const e17 = near(so, '2017-08-21T18:26:00Z'); ok('eclipse table: 2017-08-21 total solar', e17 && e17.k === 'T');
  const l25 = near(lu, '2025-09-07T18:12:00Z'); ok('eclipse table: 2025-09-07 total lunar', l25 && l25.k === 'T');
  const a27 = near(so, '2027-02-06T16:00:00Z'); ok('eclipse table: 2027-02-06 annular', a27 && a27.k === 'A');
  ok('eclipse table: sorted & within 1000-3000', so.every((e, i) => i === 0 || e.ms > so[i - 1].ms) && so[0].ms >= Date.UTC(1000, 0, 1) && so[so.length - 1].ms < Date.UTC(3001, 0, 1));
  const live = X.globalSolarAfter(Date.UTC(1999, 0, 1)); const t99 = near(so, new Date(live.peak).toISOString()); ok('eclipse table agrees with live search (1999)', !!t99);
  // proper motion data present
  const sir = X.STARS.reduce((a, s) => s[2] < a[2] ? s : a); ok('stars carry proper motion (Sirius)', Math.abs(sir[4] + 546) < 30 && Math.abs(sir[5] + 1223) < 30, `${sir[4]},${sir[5]}`);
}
// ---- Galaxy model ----
{
  const o = X.sunOrbit(), s0 = X.sunAt(0);
  ok('galaxy: Sun starts at R0 = 8.18 kpc, z = +20.8 pc', Math.abs(s0.R - 8.18) < 0.005 && Math.abs(s0.y - 0.0208) < 1e-4, `${s0.R.toFixed(3)} kpc, ${(s0.y * 1000).toFixed(1)} pc`);
  ok('galaxy: Sun speed ~245 km/s (233 + 12.2 V_sun, + U, W)', Math.abs(s0.speed - 246) < 4, s0.speed.toFixed(1) + ' km/s');
  // azimuth advance 2 pi -> galactic year
  let t = 0, phi0 = Math.atan2(o.z[o.t.indexOf(0)], o.x[o.t.indexOf(0)]), prev = phi0, acc = 0, T2 = null;
  for (let i = o.t.indexOf(0); i < o.t.length; i++) { const p = Math.atan2(o.z[i], o.x[i]); let d = p - prev; if (d < -Math.PI) d += 2 * Math.PI; if (d > Math.PI) d -= 2 * Math.PI; acc += d; prev = p; if (acc >= 2 * Math.PI) { T2 = o.t[i]; break; } }
  ok('galaxy: one galactic year ~ 215-240 Myr', T2 > 215 && T2 < 240, T2 + ' Myr');
  let ymax = 0, zc = []; for (let i = 0; i < o.t.length; i++) { ymax = Math.max(ymax, Math.abs(o.y[i])); if (i && o.y[i - 1] * o.y[i] < 0 && o.t[i] > 0) zc.push(o.t[i]); }
  ok('galaxy: vertical amplitude ~ 85 pc', Math.abs(ymax * 1000 - 85) < 6, (ymax * 1000).toFixed(1) + ' pc');
  ok('galaxy: plane crossings every ~35 Myr', zc.length > 8 && Math.abs((zc[3] - zc[1]) / 2 - 35) < 1.5, zc.slice(0, 4).join(', '));
  let rmin = 99, rmax = 0; for (let i = 0; i < o.t.length; i++) { const R = Math.hypot(o.x[i], o.z[i]); rmin = Math.min(rmin, R); rmax = Math.max(rmax, R); }
  ok('galaxy: radial excursion 8.1-9.2 kpc (epicycle about a 8.6 kpc guiding radius)', rmin > 8.0 && rmax < 9.3, `${rmin.toFixed(2)}-${rmax.toFixed(2)}`);
  const d = X.galaxyDrift(); ok('galaxy: drift ~ 560 km/s toward l~266 b~29 (Great Attractor side)', Math.abs(d.speed - 560) < 15 && Math.abs(d.l - 265.7) < 3 && Math.abs(d.b - 28.7) < 3, `${d.speed.toFixed(0)} km/s l=${d.l.toFixed(1)} b=${d.b.toFixed(1)}`);
  const mw = X.buildMilkyWay(20000); let rr = 0; for (let i = 0; i < mw.n; i++) rr = Math.max(rr, Math.hypot(mw.pos[3 * i], mw.pos[3 * i + 2]));
  ok('galaxy: procedural stars built (count, disc+halo radius < 30 kpc)', mw.n === 20000 && rr < 30, `${mw.n} stars, rmax ${rr.toFixed(1)}`);
  const p = X.armXZ(X.ARMS[0], 10.1); ok('galaxy: Perseus arm crosses the Sun line at ~10 kpc', Math.abs(p[0] - 10.1) < 0.01 && Math.abs(p[1]) < 0.01);
  const sg = X.armXZ(X.ARMS[1], X.ARMS[1].R0); ok('galaxy: Sagittarius-Carina arm ~ 7 kpc on the Sun line', Math.abs(sg[0] - 7.0) < 0.3, sg[0].toFixed(2));
}
// ---- arm crossings / Local Group / Laniakea ----
{
  for (const om of [20, 28.2]) { const c = X.armCrossings(om); ok(`arms: Omega_p ${om} gives 4-9 crossings in +-650 Myr, ordered`, c.length >= 4 && c.length <= 9 && c.every((s, i) => i === 0 || s.t0 >= c[i - 1].t0), c.length + ' crossings'); }
  const n = X.nearestArm(0); ok('arms: the Sun is between arms today (nearest 1-3 kpc)', !n.inside && Math.abs(n.dist) > 0.8 && Math.abs(n.dist) < 3.2, n.dist.toFixed(2) + ' kpc');
  const sun0 = [8.18, 0.0208, 0], gc = (o, k = 1) => { const v = X.lbToFrame(o.l, o.b, o.d * k); return Math.hypot(v[0] + sun0[0], v[1] + sun0[1], v[2] + sun0[2]); };
  const L = n => X.LOCAL_GROUP.find(o => o.n.startsWith(n));
  ok('local group: LMC ~50 kpc from the Galactic Centre', Math.abs(gc(L('Large')) - 50) < 3, gc(L('Large')).toFixed(1));
  ok('local group: Andromeda ~780 kpc from the Galactic Centre', Math.abs(gc(L('Andromeda')) - 780) < 25, gc(L('Andromeda')).toFixed(0));
  const ga = X.LANIAKEA.find(o => o.ga); ok('laniakea: Great Attractor ~69 Mpc away', Math.abs(Math.hypot(...X.lbToFrame(ga.l, ga.b, ga.d)) - 69) < 0.01);
  ok('mass extinction table has the Big Five', X.MASS_EXT.length === 5 && X.MASS_EXT.some(m => m[0] === 66 && m[0] < m[0] + 1));
}
// ---- Milky Way x Andromeda restricted merger + the Sun's life
{
  const m31 = X.lbToFrame(121.17, -21.57, 770), R0 = [m31[0] + X.GM.R0, m31[1], m31[2]], P = X.MG_P; P.dtMyr = 2;
  const o = X.mergerOrbit(R0, P), pr = o.peri.filter(p => p.r < 60);
  ok('merger: separation today ~ 770 kpc', Math.abs(o.r0 - 774) < 10, o.r0.toFixed(0));
  ok('merger: first pericentre 3.2-4.4 Gyr from now (literature ~3.9-4.3)', pr[0] && pr[0].tMyr > 3200 && pr[0].tMyr < 4400, pr[0] && (pr[0].tMyr / 1000).toFixed(2) + ' Gyr @' + pr[0].r.toFixed(0) + ' kpc');
  ok('merger: first pericentre distance 15-45 kpc', pr[0] && pr[0].r > 15 && pr[0].r < 45);
  ok('merger: second pass 5.0-6.4 Gyr (literature ~5.9)', pr[1] && pr[1].tMyr > 5000 && pr[1].tMyr < 6400, pr[1] && (pr[1].tMyr / 1000).toFixed(2));
  ok('merger: merged by 5.8-7.6 Gyr', o.mergedMyr > 5800 && o.mergedMyr < 7600, (o.mergedMyr / 1000).toFixed(2));
  const nb = X.galaxyBasis(10.6847, 41.2687, 37.7, 77.5).y, st = X.mergerInit(500, 500, o, nb, P), p0 = st.pos.slice();
  X.mergerAdvance(st, o, 1500, 1, P);
  X.mergerAdvance(st, o, 1500, -1, P); let err = 0; for (let i = 0; i < p0.length; i++) err = Math.max(err, Math.abs(p0[i] - st.pos[i]));
  ok('merger: leapfrog is time-reversible (3 Gyr forth and back, max error < 0.1 kpc, float32)', err < 0.1 && st.k === 0, err.toExponential(2) + ' kpc');
  X.mergerAdvance(st, o, 5000, 1, P); const fin = X.mergerRemnant(st, o);
  ok('merger: remnant after 10 Gyr is compact (half-mass radius 2-12 kpc) and finite', isFinite(fin.rHalf) && fin.rHalf > 2 && fin.rHalf < 12 && isFinite(fin.sunDist), 'rHalf ' + fin.rHalf.toFixed(1) + ' kpc, b/a ' + fin.ba.toFixed(2) + ', c/a ' + fin.ca.toFixed(2));
  const s0 = X.lifeState(0.17), tip = X.lifeState(0.64), wd = X.lifeState(0.95), mid2 = X.lifeState(0.217);
  ok('sun life: today L=1, R=1, T≈5772 K, main sequence', Math.abs(s0.L - 1) < 0.01 && Math.abs(s0.R - 1) < 0.01 && Math.abs(s0.T - 5772) < 30 && s0.phase[2] === 'Main sequence', s0.T.toFixed(0));
  ok('sun life: habitable zone today 0.95-1.67 AU (Kopparapu)', Math.abs(s0.hzIn - 0.95) < 0.02 && Math.abs(s0.hzOut - 1.676) < 0.03, s0.hzIn.toFixed(2) + '-' + s0.hzOut.toFixed(2));
  ok('sun life: Earth leaves the habitable zone ~+1.1 Gyr (inner edge reaches 1 AU)', mid2.hzIn > 0.995 && mid2.hzIn < 1.01, mid2.hzIn.toFixed(3));
  ok('sun life: RGB tip +7.59 Gyr, 256 Rsun, 2730 Lsun, 0.67 Msun (Schroder & Smith 2008)', Math.abs(tip.t - 7.59) < 0.01 && Math.abs(tip.R - 256) < 1 && Math.abs(tip.L - 2730) < 10 && Math.abs(tip.M - 0.67) < 0.01, tip.t.toFixed(3));
  ok('sun life: white dwarf ~0.54 Msun, Earth-sized, hot then cooling', wd.M === 0.54 && wd.R < 0.02 && wd.phase[2] === 'White dwarf' && wd.T > 8000, wd.T.toFixed(0) + ' K');
  const lost = {}; for (const [id, a, , f] of X.LIFE_PLANETS) { lost[id] = false; for (let u = 0; u <= 1; u += 0.0005) { const q = X.lifeState(u); if (q.RAU >= a / q.M * f) { lost[id] = true; break; } } }
  ok('sun life: Mercury, Venus (and, with tidal drag, Earth) are swallowed; Mars and beyond survive', lost.Mercury && lost.Venus && lost.Earth && !lost.Mars && !lost.Jupiter, JSON.stringify(lost));
  let mono = true; for (let t = -4.5; t < 12; t += 0.25) if (!(X.lifeUofT(t + 0.25) >= X.lifeUofT(t))) mono = false;
  ok('sun life: dock-strip axis is monotonic', mono);
  const c = X.bbColor(5772), cb = X.bbColor(100000); ok('sun life: blackbody colours (Sun warm-white, hot WD blue)', c[0] > 0.95 && c[2] > 0.8 && cb[2] > cb[0], c.map(v => v.toFixed(2)).join(','));
}
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED'); process.exit(fail ? 1 : 0);
