// Compare Astronomy Engine (the app's ephemeris) against JPL Horizons (DE441) for topocentric Sun/Moon/planets.
const A = require('astronomy-engine');
const CASES = [
  ['2024-04-08T18:42:37Z', 'Dallas TX (total solar)', 32.7767, -96.797, 131],
  ['2017-08-21T18:21:23Z', 'Carbondale IL (total solar)', 37.7273, -89.2168, 120],
  ['2026-08-12T18:29:08Z', 'Burgos ES (total solar)', 42.3439, -3.6969, 860],
  ['2025-09-07T18:11:41Z', 'Madrid (total lunar)', 40.4168, -3.7038, 650],
  ['1969-07-20T20:17:40Z', 'Houston (Apollo 11)', 29.76, -95.37, 15],
  ['1750-06-15T12:00:00Z', 'Madrid 1750 (in range)', 40.4168, -3.7038, 650],
  ['2150-06-15T12:00:00Z', 'Madrid 2150 (in range)', 40.4168, -3.7038, 650],
  ['1500-06-15T12:00:00Z', 'Madrid 1500 (reduced)', 40.4168, -3.7038, 650],
  ['2500-06-15T12:00:00Z', 'Madrid 2500 (reduced)', 40.4168, -3.7038, 650],
];
const BODIES = [['Sun', '10', A.Body.Sun], ['Moon', '301', A.Body.Moon], ['Jupiter', '599', A.Body.Jupiter], ['Mars', '499', A.Body.Mars]];
async function horizons(cmd, jd, lat, lon, eleM) {
  const q = new URLSearchParams({ format: 'json', COMMAND: `'${cmd}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'", CENTER: "'coord@399'", COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${lon},${lat},${eleM / 1000}'`, TLIST: `'${jd}'`, TIME_TYPE: "'UT'", QUANTITIES: "'2,4'", ANG_FORMAT: "'DEG'", CSV_FORMAT: "'YES'", EXTRA_PREC: "'YES'" });
  const r = await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + q); const j = await r.json();
  const m = /\$\$SOE\s*([\s\S]*?)\s*\$\$EOE/.exec(j.result || ''); if (!m) throw new Error((j.result || j.error || '').slice(0, 300));
  const f = m[1].split('\n')[0].split(',').map(s => s.trim()); // date, solar flag, lunar flag, RA, DEC, Az, El
  return { ra: +f[3], dec: +f[4], az: +f[5], el: +f[6] };
}
const angSep = (ra1, de1, ra2, de2) => { const r = Math.PI / 180, a = Math.sin((de2 - de1) * r / 2) ** 2 + Math.cos(de1 * r) * Math.cos(de2 * r) * Math.sin((ra2 - ra1) * r / 2) ** 2; return 2 * Math.asin(Math.sqrt(a)) / r * 3600; };
(async () => {
  console.log('case'.padEnd(30), 'body'.padEnd(8), 'ΔRA/Dec sep (arcsec)'.padEnd(22), 'ΔAlt (")'.padEnd(10), 'ΔAz (")');
  const rows = [];
  for (const [iso, name, lat, lon, ele] of CASES) {
    const ms = Date.parse(iso), d = new Date(ms), jd = ms / 86400000 + 2440587.5, obs = new A.Observer(lat, lon, ele), t = A.MakeTime(d);
    for (const [bn, cmd, body] of BODIES) {
      try {
        const H = await horizons(cmd, jd, lat, lon, ele);
        const eq = A.Equator(body, t, obs, true, true), hor = A.Horizon(t, obs, eq.ra, eq.dec, null);
        const sep = angSep(eq.ra * 15, eq.dec, H.ra, H.dec);
        const dAlt = (hor.altitude - H.el) * 3600, dAz = ((hor.azimuth - H.az + 540) % 360 - 180) * 3600 * Math.cos(H.el * Math.PI / 180);
        rows.push({ name, bn, sep, dAlt, dAz });
        console.log(name.padEnd(30), bn.padEnd(8), sep.toFixed(2).padEnd(22), dAlt.toFixed(2).padEnd(10), dAz.toFixed(2));
      } catch (e) { console.log(name.padEnd(30), bn.padEnd(8), 'ERR', e.message.slice(0, 80)); }
      await new Promise(r => setTimeout(r, 250));
    }
  }
  require('fs').writeFileSync(__dirname + '/../data/horizons_check.json', JSON.stringify(rows, null, 1));
})();
