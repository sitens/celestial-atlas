// ===================== 40_weather.js — geocoding + time-aware weather (Open-Meteo) =====================
const WX_VARS = 'temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,precipitation,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
const WMO = {
  0: ['Clear sky', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'], 45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Dense drizzle', '🌧️'], 56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
  61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'], 66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '❄️'], 80: ['Rain showers', '🌦️'], 81: ['Rain showers', '🌧️'], 82: ['Violent showers', '⛈️'],
  85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '❄️'], 95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm + hail', '⛈️'], 99: ['Severe thunderstorm', '⛈️'],
};
const wmo = c => WMO[c] || ['—', '·'];
const compass16 = d => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((d % 360) + 360) % 360 / 22.5) % 16];

async function fetchJSON(url, ms = 12000) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(to); }
}
async function geocode(q) {
  const j = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`);
  return (j.results || []).map(r => ({ name: r.name, admin: r.admin1 || '', country: r.country || '', cc: r.country_code || '', lat: r.latitude, lon: r.longitude, elev: r.elevation != null ? r.elevation : 0, tz: r.timezone || null }));
}
async function resolveTz(lat, lon) {
  try { const j = await fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`, 8000); return { tz: j.timezone, elev: j.elevation }; }
  catch (e) { return { tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', elev: null, fallback: true }; }
}

const WXC = {};
const dstr = ms => { const p = partsInZone(ms, 'UTC'); return fmtDateParts(p); };
function pickHour(j, tms) {
  const h = j.hourly; if (!h || !h.time) return null;
  const start = Date.parse(h.time[0] + ':00Z'), idx = Math.round((tms - start) / 3600000);
  if (idx < 0 || idx >= h.time.length) return null;
  const o = { timeMs: start + idx * 3600000 };
  for (const k of Object.keys(h)) if (k !== 'time') o[k] = h[k][idx];
  return o;
}
async function getWeather(lat, lon, tms) {
  const now = Date.now(), la = lat.toFixed(2), lo = lon.toFixed(2);
  if (tms < utcFromParts(1940, 1, 1)) return { kind: 'none', msg: 'No weather data before 1940.' };
  if (tms > now + 15.5 * MS_DAY) return getClimatology(lat, lon, tms);
  const day0 = dstr(tms - MS_DAY), day1 = dstr(tms + MS_DAY);
  let kind, url;
  if (tms >= now - 85 * MS_DAY) { kind = tms > now + 1800000 ? 'forecast' : 'recent'; url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${day0}&end_date=${day1}&hourly=${WX_VARS}&timezone=UTC&wind_speed_unit=kmh`; }
  else { kind = 'archive'; url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${day0}&end_date=${day1}&hourly=${WX_VARS}&timezone=UTC&wind_speed_unit=kmh`; }
  const key = `${kind}|${la},${lo}|${day0}`;
  let j = WXC[key];
  if (!j) { j = await fetchJSON(url); WXC[key] = j; }
  const o = pickHour(j, tms);
  if (!o) return { kind: 'none', msg: 'No data returned for that hour.' };
  return { kind, data: o, source: kind === 'archive' ? 'Historical · ERA5 reanalysis (Open-Meteo)' : kind === 'forecast' ? 'Forecast · Open-Meteo' : 'Recent analysis · Open-Meteo' };
}
async function getClimatology(lat, lon, tms) {
  const p = partsInZone(tms, 'UTC'), nowY = new Date().getUTCFullYear(), years = [];
  for (let y = nowY - 10; y <= nowY - 1; y++) years.push(y);
  const key = `clim|${lat.toFixed(2)},${lon.toFixed(2)}|${p.mo}-${p.d}`;
  let rows = WXC[key];
  if (!rows) {
    rows = (await Promise.all(years.map(async y => {
      const d = `${y}-${pad(p.mo)}-${pad(p.d === 29 && p.mo === 2 && !isLeap(y) ? 28 : p.d)}`;
      try { return await fetchJSON(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${d}&end_date=${d}&hourly=temperature_2m,cloud_cover,precipitation,wind_speed_10m&timezone=UTC&wind_speed_unit=kmh`, 10000); } catch (e) { return null; }
    }))).filter(Boolean);
    WXC[key] = rows;
  }
  const hr = p.h, vals = k => rows.map(r => r.hourly && r.hourly[k] ? r.hourly[k][hr] : null).filter(v => v != null);
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  if (!rows.length) return { kind: 'none', msg: 'No forecast available this far ahead (climatology unavailable).' };
  return { kind: 'climatology', years: [years[0], years[years.length - 1]], clim: { temperature_2m: mean(vals('temperature_2m')), cloud_cover: mean(vals('cloud_cover')), precipitation: mean(vals('precipitation')), wind_speed_10m: mean(vals('wind_speed_10m')), pRain: vals('precipitation').filter(v => v > 0.1).length / Math.max(1, vals('precipitation').length) }, source: 'Climatology · ERA5 average (not a forecast)' };
}
function skyRating(cloud, vis, precip, code) {
  if (cloud == null) return { label: 'Unknown', cls: 'tt', pct: 50 };
  let c = cloud; if (precip > 0.2) c = Math.max(c, 90); if ([45, 48].includes(code)) c = Math.max(c, 80);
  if (c < 15) return { label: 'Clear — excellent', cls: 'ok', pct: 100 - c };
  if (c < 40) return { label: 'Mostly clear — good', cls: 'ok', pct: 100 - c };
  if (c < 70) return { label: 'Partly cloudy — fair', cls: 'acc', pct: 100 - c };
  if (c < 90) return { label: 'Mostly cloudy — poor', cls: 'warn', pct: 100 - c };
  return { label: 'Overcast — unlikely', cls: 'warn', pct: 100 - c };
}

// ===================== live cloud cover on the globe (coarse Open-Meteo grid -> data texture) =====================
const CG = { lats: [-70, -50, -30, -10, 10, 30, 50, 70], lons: Array.from({ length: 18 }, (_, i) => -180 + i * 20) };
const CLOUD = { tex: null, mix: 0, target: 0, cache: {}, key: '', status: 'Earth clouds: static texture', busy: false, timer: 0, token: 0 };
function cloudTexture() {
  if (!CLOUD.tex) {
    const t = new THREE.DataTexture(new Uint8Array(72 * 36 * 4).fill(128), 72, 36, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; CLOUD.tex = t;
  }
  return CLOUD.tex;
}
async function fetchCloudDay(kind, dayStr) {
  const key = kind + '|' + dayStr; if (CLOUD.cache[key]) return CLOUD.cache[key];
  const la = [], lo = [];
  for (const a of CG.lats) for (const b of CG.lons) { la.push(a); lo.push(b); }
  const base = kind === 'archive' ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  const j = await fetchJSON(`${base}?latitude=${la.join(',')}&longitude=${lo.join(',')}&hourly=cloud_cover&start_date=${dayStr}&end_date=${dayStr}&timezone=UTC`, 25000);
  const arr = (Array.isArray(j) ? j : [j]).map(r => (r.hourly && r.hourly.cloud_cover) || []);
  if (arr.length !== la.length) throw new Error('grid size');
  CLOUD.cache[key] = arr; return arr;
}
function paintCloudTexture(arr, hour) {
  const nl = CG.lats.length, no = CG.lons.length, data = cloudTexture().image.data;
  const g = (i, j) => { const v = arr[i * no + ((j % no) + no) % no][hour]; return v == null ? 50 : v; };
  for (let y = 0; y < 36; y++) {
    const lat = -90 + (y + 0.5) * 5, fi = Math.min(nl - 1, Math.max(0, (lat - CG.lats[0]) / 20)), i0 = Math.floor(fi), i1 = Math.min(nl - 1, i0 + 1), ti = fi - i0;
    for (let x = 0; x < 72; x++) {
      const lon = -180 + (x + 0.5) * 5, fj = (lon + 180) / 20 - 0.0, j0 = Math.floor(fj), tj = fj - j0;
      const v = (g(i0, j0) * (1 - tj) + g(i0, j0 + 1) * tj) * (1 - ti) + (g(i1, j0) * (1 - tj) + g(i1, j0 + 1) * tj) * ti;
      const k = (y * 72 + x) * 4, b = Math.max(0, Math.min(255, Math.round(v * 2.55))); data[k] = b; data[k + 1] = b; data[k + 2] = b; data[k + 3] = 255;
    }
  }
  cloudTexture().needsUpdate = true;
}
function scheduleClouds() {
  clearTimeout(CLOUD.timer);
  CLOUD.timer = setTimeout(async () => {
    if (!S.tg.liveClouds) { CLOUD.target = 0; CLOUD.status = 'Earth clouds: static texture (Live clouds off)'; return; }
    if (S.playing && S.speed >= 86400) return;
    const now = Date.now(), t = S.t; let kind = null;
    if (t >= now - 85 * MS_DAY && t <= now + 15 * MS_DAY) kind = 'forecast'; else if (t < now - 85 * MS_DAY && t >= utcFromParts(1940, 1, 1)) kind = 'archive';
    if (!kind) { CLOUD.target = 0; CLOUD.status = t > now ? 'Earth clouds: static texture (no cloud forecast this far ahead)' : 'Earth clouds: static texture (no cloud data before 1940)'; return; }
    const p = partsInZone(t, 'UTC'), day = fmtDateParts(p), hr = p.h, my = ++CLOUD.token;
    try {
      const arr = await fetchCloudDay(kind, day); if (my !== CLOUD.token) return;
      paintCloudTexture(arr, hr); CLOUD.target = 1;
      CLOUD.status = `Earth clouds: live Open-Meteo grid (20°), ${pad(hr)}:00 UTC · ${kind === 'archive' ? 'ERA5 history' : 'forecast/analysis'}`;
    } catch (e) { if (my === CLOUD.token) { CLOUD.target = 0; CLOUD.status = 'Earth clouds: static texture (cloud grid unavailable)'; } }
  }, 900);
}
