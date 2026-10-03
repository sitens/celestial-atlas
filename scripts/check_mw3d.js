// Quick numeric check of the 3-D Milky Way / galaxy generators (node).
global.Astronomy = require('astronomy-engine');
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['src/js/00_util.js', 'src/js/10_astro.js', 'src/js/15_galaxy_math.js'].map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
const ctx = vm.createContext({ Astronomy, console, Date, Math, Intl, Set, Object, Array, JSON, Number, String, isFinite, parseInt, Float32Array, Uint8Array });
vm.runInContext(src + '\n;this.__a={buildMilkyWay,buildMWDust,buildGalaxyCloud,galaxyBasis,GAL_SHAPES,lbToFrame,v3,LOCAL_GROUP};', ctx);
const X = ctx.__a;
const mw = X.buildMilkyWay(60000);
let s2 = 0, c = 0, mx = 0, up = 0, dn = 0;
for (let i = 0; i < mw.n; i++) { const R = Math.hypot(mw.pos[3 * i], mw.pos[3 * i + 2]), y = mw.pos[3 * i + 1]; if (R > 3 && R < 14) { s2 += y * y; c++; } mx = Math.max(mx, Math.abs(y)); if (R > 13) { const ph = Math.atan2(mw.pos[3 * i + 2], mw.pos[3 * i]); if (Math.sin(ph) > 0.8) { up += y; } else if (Math.sin(ph) < -0.8) { dn += y; } } }
console.log('MW stars', mw.n, ' rms z (3<R<14) kpc', Math.sqrt(s2 / c).toFixed(3), ' max|z|', mx.toFixed(2));
console.log('warp: mean z at R>13 toward l=90 vs l=270:', up.toFixed(0), dn.toFixed(0), '(should be +/-)');
const b = X.galaxyBasis(10.6847, 41.2687, 37.7, 77.5), n = X.v3.norm(X.lbToFrame(121.17, -21.57, 1));
console.log('M31 |cos(normal, line of sight)| =', Math.abs(X.v3.dot(b.y, n)).toFixed(3), ' expected cos(77.5deg) =', Math.cos(77.5 * Math.PI / 180).toFixed(3), ' |x|=', X.v3.len(b.x).toFixed(3), ' x.y=', X.v3.dot(b.x, b.y).toFixed(3));
const d = X.buildMWDust(5000); console.log('dust n', d.n);
const g = X.buildGalaxyCloud('spiral', 46, 4000, 3); console.log('M31 cloud', g.n);
for (const t of ['barred', 'irr', 'ell', 'dsph']) console.log(t, X.buildGalaxyCloud(t, 5, 800, 2).n);
