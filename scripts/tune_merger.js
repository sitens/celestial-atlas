// Node: tune/check the MW-M31 restricted merger against published timeline (first pericentre ~4 Gyr, 2nd ~6 Gyr, merged ~7 Gyr)
const fs = require('fs'), vm = require('vm');
const src = ['src/js/15_galaxy_math.js', 'src/js/16_merger_math.js'].map(f => fs.readFileSync(f, 'utf8')).join('\n');
const ctx = vm.createContext({ Math, console, Float32Array, Uint8Array, Array, Number });
vm.runInContext(src + '\n;this.api={lbToFrame,mergerOrbit,mergerInit,mergerStep,mergerRemnant,MG_P,mgCloneState,GM}', ctx);
const A = ctx.api, P = A.MG_P;
const s = A.lbToFrame(121.17, -21.57, 770), R0 = [s[0] + A.GM.R0, s[1], s[2]];
for (const eta of (process.argv[2] ? [+process.argv[2]] : [0.2, 0.3, 0.42, 0.6, 0.9])) {
  P.dfEta = eta; const o = A.mergerOrbit(R0, P);
  console.log('eta', eta, 'r0', o.r0.toFixed(0), 'peri', o.peri.map(p => (p.tMyr / 1000).toFixed(2) + ' Gyr @' + p.r.toFixed(0) + 'kpc').join(' | '), 'merged', (o.mergedMyr / 1000).toFixed(2));
}
if (process.argv[3]) { P.vTan = +process.argv[3]; P.dfEta = +process.argv[2]; const o = A.mergerOrbit(R0, P); let line = ''; for (let g = 0; g <= 10; g += 0.25) line += g.toFixed(2) + ':' + o.r[Math.round(g * 1000)].toFixed(0) + ' '; console.log('r(t) Gyr:kpc', line); console.log('peri', o.peri.map(p => (p.tMyr / 1000).toFixed(2) + '@' + p.r.toFixed(0)).join(' ')); }
