// Precompute every global solar + lunar eclipse 1000-3000 CE (Astronomy Engine) -> src/eclipses.js (delta-minutes + kind codes).
// ~9,000 events, a few minutes of CPU. Run once:  node scripts/build_eclipse_table.js
const A = require('astronomy-engine'), fs = require('fs'), path = require('path');
const BASE = Date.UTC(1000, 0, 1), END = Date.UTC(3001, 0, 1);
const setY = (y) => { const d = new Date(0); d.setUTCFullYear(y, 0, 1); d.setUTCHours(0, 0, 0, 0); return d; };
const base = setY(1000).getTime(), end = setY(3001).getTime();
const SK = { partial: 'P', annular: 'A', total: 'T', hybrid: 'H' }, LK = { penumbral: 'N', partial: 'P', total: 'T' };
function run(type) {
  const out = [], kinds = []; let prev = Math.round(base / 60000);
  let e = type === 'solar' ? A.SearchGlobalSolarEclipse(new A.AstroTime(new Date(base))) : A.SearchLunarEclipse(new A.AstroTime(new Date(base)));
  let n = 0;
  while (true) {
    const peak = type === 'solar' ? e.peak.date.getTime() : e.peak.date.getTime();
    if (peak >= end) break;
    const m = Math.round(peak / 60000);
    out.push(m - prev); prev = m; kinds.push((type === 'solar' ? SK : LK)[e.kind] || '?');
    e = type === 'solar' ? A.NextGlobalSolarEclipse(e.peak) : A.NextLunarEclipse(e.peak);
    if (++n % 500 === 0) console.log(type, n, new Date(peak).toISOString().slice(0, 10));
  }
  return { d: out, k: kinds.join('') };
}
const t0 = Date.now();
const solar = run('solar'), lunar = run('lunar');
const js = `const ECLIPSE_TABLE=${JSON.stringify({ base: Math.round(base / 60000), solar, lunar })};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'eclipses.js'), js);
console.log('solar', solar.d.length, 'lunar', lunar.d.length, 'bytes', js.length, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
