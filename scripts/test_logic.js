// Node harness: evaluates the pure-logic modules (no DOM/THREE) and checks them against known events.
const fs = require('fs'), path = require('path'), vm = require('vm');
global.Astronomy = require('astronomy-engine');
const src = ['src/assets.js', 'src/eclipses.js', 'src/js/00_util.js', 'src/js/10_astro.js', 'src/js/15_galaxy_math.js'].map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
const ctx = vm.createContext({ Astronomy: global.Astronomy, console, Date, Math, Intl, Set, Object, Array, JSON, Number, String, isFinite, parseInt });
vm.runInContext(src + '\n;this.__api={sunOrbit,sunAt,galaxyDrift,buildMilkyWay,ARMS,armXZ,spurXZ,GM,ECLIPSE_TABLE,STARS,runTimeSelfTests,computeState,solarEclipseNow,lunarEclipseNow,mkObs,timeOf,utcFromParts,localToUTC,partsInZone,eclipseList,findEvent,stepGlobal,localSolar,upTonight,skyBody,earthAxes,geoDir,BODY,v3,SATS,fmtUTC,fmtLocal,findMeteor,moonAxes,discCoverFrac,globalSolarAfter,lunarAfter,localLunar,AU_KM,J2000_MS,nightWindow};', ctx);
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
  ok('galaxy: procedural stars built (count, disc radius < 22 kpc)', mw.n === 20000 && rr < 22, `${mw.n} stars, rmax ${rr.toFixed(1)}`);
  const p = X.armXZ(X.ARMS[0], 10.1); ok('galaxy: Perseus arm crosses the Sun line at ~10 kpc', Math.abs(p[0] - 10.1) < 0.01 && Math.abs(p[1]) < 0.01);
  const sg = X.armXZ(X.ARMS[1], X.ARMS[1].R0); ok('galaxy: Sagittarius-Carina arm ~ 7 kpc on the Sun line', Math.abs(sg[0] - 7.0) < 0.3, sg[0].toFixed(2));
}
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED'); process.exit(fail ? 1 : 0);
