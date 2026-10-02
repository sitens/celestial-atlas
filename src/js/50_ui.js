// ===================== 50_ui.js — HUD, time-travel picker, timeline, panels =====================
const U = { zone: 'local', lastClock: 0, lastPanel: 0, lastSlow: 0, wxToken: 0, wxKey: '', wxRes: null, cache: {}, hashT: 0, eclKey: '' };
const fmt1 = (v, d = 1) => v == null || isNaN(v) ? '—' : v.toFixed(d);
const hms = h => { const a = ((h % 24) + 24) % 24, hh = Math.floor(a), m = (a - hh) * 60; return `${pad(hh)}h ${pad(Math.floor(m))}m`; };
const sgn = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d) + '°';
const obsNow = () => mkObs(S.loc.lat, S.loc.lon, S.loc.elev);
const tz = () => S.loc.tz || 'UTC';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ===== time picker =====
function zoneParts(ms) { return partsInZone(ms, U.zone === 'utc' ? 'UTC' : tz()); }
function syncPicker(force) {
  const act = document.activeElement, p = zoneParts(S.t);
  const set = (el, v) => { if (el !== act || force) el.value = v; };
  set($('tmDate'), fmtDateParts(p)); set($('tmTime'), fmtTimeParts(p)); set($('tmISO'), `${fmtDateParts(p)} ${fmtTimeParts(p)}`);
  if (force) for (const id of ['tmDate', 'tmTime', 'tmISO']) if (!U.badUntil || performance.now() > U.badUntil) $(id).classList.remove('bad');
}
function applyWall(y, mo, d, h, mi, s, srcEl) {
  const zone = U.zone === 'utc' ? 'UTC' : tz();
  let ms, gap = false;
  if (zone === 'UTC') ms = utcFromParts(y, mo, d, h, mi, s); else { const r = localToUTC(y, mo, d, h, mi, s, zone); ms = r.ms; gap = r.gap; }
  const st = rangeStatus(ms);
  if (st === 'invalid') {
    if (srcEl) { srcEl.classList.add('bad'); U.badUntil = performance.now() + 2500; setTimeout(() => srcEl.classList.remove('bad'), 2600); }
    toast('Outside 1000–3000 CE the planetary and lunar theories are not valid — date rejected. Try a year between 1000 and 3000.', 5200);
    syncPicker(true); return false;
  }
  if (gap) toast('That wall-clock time does not exist (DST spring-forward) — moved to the next valid time.', 4200);
  setTime(ms); syncPicker(true); return true;
}
function wire_picker() {
  $('tmDate').addEventListener('change', e => {
    const m = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(e.target.value); if (!m) { syncPicker(true); return; }
    const p = zoneParts(S.t); applyWall(+m[1], +m[2], +m[3], p.h, p.mi, p.s, e.target);
  });
  $('tmTime').addEventListener('change', e => {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(e.target.value); if (!m) { syncPicker(true); return; }
    const p = zoneParts(S.t); applyWall(p.y, p.mo, p.d, +m[1], +m[2], +(m[3] || 0), e.target);
  });
  const iso = () => {
    const v = $('tmISO').value.trim(), p = parseISO(v);
    if (!p) { $('tmISO').classList.add('bad'); U.badUntil = performance.now() + 2500; setTimeout(() => $('tmISO').classList.remove('bad'), 2600); toast('Use ISO format, e.g. 1969-07-20 20:17:00 (add Z for UTC).', 3800); return; }
    if (p.z) { const ms = utcFromParts(p.y, p.mo, p.d, p.h, p.mi, p.s); if (rangeStatus(ms) === 'invalid') { toast('Outside 1000–3000 CE — date rejected.', 4200); return; } setTime(ms); syncPicker(true); }
    else applyWall(p.y, p.mo, p.d, p.h, p.mi, p.s, $('tmISO'));
  };
  $('tmISO').addEventListener('keydown', e => { if (e.key === 'Enter') { iso(); e.target.blur(); } });
  $('tmISO').addEventListener('change', iso);
  document.querySelectorAll('#zoneSeg button').forEach(b => b.addEventListener('click', () => {
    U.zone = b.dataset.z; document.querySelectorAll('#zoneSeg button').forEach(x => x.classList.toggle('on', x === b)); syncPicker(true);
  }));
  const mk = (box, sign) => {
    for (const [k] of (sign < 0 ? [...STEP_DEFS].reverse() : STEP_DEFS)) {
      const b = document.createElement('button'); b.textContent = (sign < 0 ? '−' : '+') + (k === 'syn' ? 'syn' : k); b.title = (sign < 0 ? 'Back ' : 'Forward ') + (k === 'syn' ? '1 synodic month (29.53 d)' : k);
      b.addEventListener('click', () => stepTime(k, sign)); box.appendChild(b);
    }
  };
  mk($('stepsBack'), -1); mk($('stepsFwd'), 1);
  $('btnNow').addEventListener('click', goLive); $('bannerNow').addEventListener('click', goLive);
  // speeds
  $('spdSel').innerHTML = SPEEDS.map(s => `<option value="${s[1]}">${s[0]}</option>`).join('');
  $('spdSel').addEventListener('change', e => setSpeed(+e.target.value));
  $('btnPlay').addEventListener('click', togglePlay);
  $('btnRev').addEventListener('click', () => { S.dir = -S.dir; if (S.live) { S.live = false; S.playing = true; } syncPlayUI(); uiTimeChanged(); });
}

// ===== events / presets =====
const EVENT_OPTS = [
  ['Eclipses', [['solar-any', 'Solar eclipse — anywhere'], ['solar-here', 'Solar eclipse — visible here'], ['lunar-any', 'Lunar eclipse — anywhere'], ['lunar-here', 'Lunar eclipse — visible here']]],
  ['Moon phases', [['newMoon', 'New Moon'], ['firstQuarter', 'First quarter'], ['fullMoon', 'Full Moon'], ['lastQuarter', 'Last quarter']]],
  ['Sun & Earth', [['equinoxMar', 'March equinox'], ['solsticeJun', 'June solstice'], ['equinoxSep', 'September equinox'], ['solsticeDec', 'December solstice'], ['perihelion', 'Earth perihelion'], ['aphelion', 'Earth aphelion']]],
  ['Planets', [...['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].map(p => ['opp_' + p, `${p} opposition`]), ...['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].map(p => ['conj_' + p, `${p} conjunction with Sun`]), ['elong_Mercury', 'Mercury greatest elongation'], ['elong_Venus', 'Venus greatest elongation']]],
  ['Meteors', [['meteor', 'Meteor shower peak (approx.)']]],
];
function jumpEvent(dir) {
  const key = $('evSel').value; let ms = null, msg = '';
  toast('Searching…', 1200);
  setTimeout(() => {
    try {
      const obs = obsNow();
      if (key === 'meteor') { const m = findMeteor(S.t, dir); ms = m.ms; msg = `${m.name} peak (approximate, ZHR≈${m.zhr})`; }
      else if (key.endsWith('-any') || key.endsWith('-here')) {
        const type = key.startsWith('solar') ? 'solar' : 'lunar', here = key.endsWith('here'); let t = S.t, ev = null;
        for (let i = 0; i < 80; i++) {
          ev = stepGlobal(type, t, dir); if (!ev) break;
          if (!here) break;
          if (type === 'solar') { const l = localSolar(ev.peak, obs); if (l && (l.peak.alt > -1 || (l.pb && l.pb.alt > 0) || (l.pe && l.pe.alt > 0))) { ev.localMs = l.peak.ms; ev.local = l; break; } }
          else { const l = localLunar(ev, obs); if (l.visible) { ev.local = l; break; } }
          t = ev.peak + dir * 3 * MS_DAY; ev = null;
        }
        if (!ev) { toast('No matching eclipse found within the search limit.'); return; }
        ms = ev.localMs || ev.peak; msg = `${kindLabel(ev)} eclipse${here ? ' — visible here' : ''}`;
      } else { ms = findEvent(key, S.t, dir); msg = $('evSel').selectedOptions[0].textContent; }
      if (ms == null) { toast('No event found.'); return; }
      if (rangeStatus(ms) === 'invalid') { toast('That event lies outside the supported 1000–3000 CE range.'); return; }
      setTime(ms); toast(`${msg} · ${fmtNice(ms, tz())}`, 3800);
    } catch (e) { console.error(e); toast('Event search failed: ' + e.message); }
  }, 20);
}
const PRESETS = [
  ['', 'Famous moments…'],
  ['apollo', 'Apollo 11 landing · 1969-07-20 20:17 UTC'],
  ['e1919', 'Eddington eclipse · 1919-05-29 · Príncipe'],
  ['e2017', 'Total solar eclipse · 2017-08-21 · Carbondale, IL'],
  ['e2024', 'Total solar eclipse · 2024-04-08 · Dallas, TX'],
  ['l2025', 'Total lunar eclipse · 2025-09-07'],
  ['e2026', 'Total solar eclipse · 2026-08-12 · Spain'],
  ['l2026', 'Partial lunar eclipse · 2026-08-28'],
  ['e2027', 'Total solar eclipse · 2027-08-02 · Luxor, Egypt'],
  ['birth', 'My birth sky / a birthday…'],
];
const PLACES = {
  e1919: { name: 'Príncipe, São Tomé and Príncipe', lat: 1.6, lon: 7.4, elev: 50, tz: 'Africa/Sao_Tome', t: utcFromParts(1919, 5, 29, 13, 0) },
  e2017: { name: 'Carbondale, Illinois, USA', lat: 37.7273, lon: -89.2168, elev: 120, tz: 'America/Chicago', t: utcFromParts(2017, 8, 21, 18, 0) },
  e2024: { name: 'Dallas, Texas, USA', lat: 32.7767, lon: -96.797, elev: 131, tz: 'America/Chicago', t: utcFromParts(2024, 4, 8, 18, 0) },
  e2026: { name: 'Burgos, Spain', lat: 42.3439, lon: -3.6969, elev: 860, tz: 'Europe/Madrid', t: utcFromParts(2026, 8, 12, 18, 0) },
  e2027: { name: 'Luxor, Egypt', lat: 25.6872, lon: 32.6396, elev: 80, tz: 'Africa/Cairo', t: utcFromParts(2027, 8, 2, 10, 0) },
};
function applyPreset(k) {
  if (!k) return;
  if (k === 'birth') { openBirth(); return; }
  if (k === 'apollo') { setTime(utcFromParts(1969, 7, 20, 20, 17, 40)); toast('Apollo 11 touchdown, Sea of Tranquility — the sky from your location.'); return; }
  if (k === 'l2025' || k === 'l2026') { const ev = lunarAfter(k === 'l2025' ? utcFromParts(2025, 8, 20) : utcFromParts(2026, 8, 15)); setTime(ev.peak); return; }
  const P = PLACES[k]; setLocation({ name: P.name, lat: P.lat, lon: P.lon, elev: P.elev, tz: P.tz }, { silent: true });
  const g = globalSolarAfter(P.t - 3 * MS_DAY), l = localSolar(g.peak, mkObs(P.lat, P.lon, P.elev));
  setTime(l ? l.peak.ms : g.peak); toast(`${P.name} — ${l ? l.kind : g.kind} solar eclipse, local maximum`, 4200);
  if (S.view !== 'sky') setView('sky', { reaim: true }); else SKY.needAim = true;
}
function openBirth() {
  const p = zoneParts(S.t); $('bDate').value = fmtDateParts(p); $('bPlace').textContent = S.loc.name;
  const saved = (() => { try { return JSON.parse(localStorage.getItem('ca.birth') || 'null'); } catch (e) { return null; } })(); if (saved) { $('bDate').value = saved.d; $('bTime').value = saved.t; }
  $('mBirth').classList.add('open');
}
function wire_events() {
  $('evSel').innerHTML = EVENT_OPTS.map(g => `<optgroup label="${g[0]}">${g[1].map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</optgroup>`).join('');
  $('evPrev').addEventListener('click', () => jumpEvent(-1)); $('evNext').addEventListener('click', () => jumpEvent(1));
  $('preSel').innerHTML = PRESETS.map(p => `<option value="${p[0]}">${p[1]}</option>`).join('');
  $('preSel').addEventListener('change', e => { applyPreset(e.target.value); e.target.value = ''; });
  $('bGo').addEventListener('click', () => {
    const d = parseISO($('bDate').value), t = /^(\d{1,2}):(\d{2})/.exec($('bTime').value || '12:00');
    if (!d) { toast('Enter a valid date.'); return; }
    try { localStorage.setItem('ca.birth', JSON.stringify({ d: $('bDate').value, t: $('bTime').value })); } catch (e) { }
    const r = localToUTC(d.y, d.mo, d.d, +(t ? t[1] : 12), +(t ? t[2] : 0), 0, tz());
    if (rangeStatus(r.ms) === 'invalid') { toast('Outside 1000–3000 CE.'); return; }
    $('mBirth').classList.remove('open'); setTime(r.ms); setView('sky', { reaim: true }); toast(`The sky over ${S.loc.name} on ${fmtNice(r.ms, tz())}`, 4200);
  });
  $('bYear').addEventListener('click', () => {
    const d = parseISO($('bDate').value); if (!d) return; const y = new Date().getFullYear();
    const r = localToUTC(y, d.mo, d.d, 12, 0, 0, tz()); $('mBirth').classList.remove('open'); setTime(r.ms);
  });
}

// ===== search / location =====
function defaultLocation() {
  const z = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const M = { 'America/New_York': ['New York, NY, USA', 40.7128, -74.006, 10], 'America/Chicago': ['Chicago, IL, USA', 41.8781, -87.6298, 180], 'America/Denver': ['Denver, CO, USA', 39.7392, -104.9903, 1609], 'America/Los_Angeles': ['Los Angeles, CA, USA', 34.0522, -118.2437, 90], 'Europe/London': ['London, UK', 51.5074, -0.1278, 11], 'Europe/Paris': ['Paris, France', 48.8566, 2.3522, 35], 'Europe/Berlin': ['Berlin, Germany', 52.52, 13.405, 34], 'Europe/Madrid': ['Madrid, Spain', 40.4168, -3.7038, 650], 'Asia/Tokyo': ['Tokyo, Japan', 35.6762, 139.6503, 40], 'Australia/Sydney': ['Sydney, Australia', -33.8688, 151.2093, 58], 'Asia/Kolkata': ['New Delhi, India', 28.6139, 77.209, 216] };
  const m = M[z]; return m ? { name: m[0], lat: m[1], lon: m[2], elev: m[3], tz: z } : { name: 'Madrid, Spain', lat: 40.4168, lon: -3.7038, elev: 650, tz: 'Europe/Madrid' };
}
function wire_search() {
  const q = $('q'), box = $('sugg'); let items = [], hi = -1, timer = 0, tok = 0;
  const close = () => { box.style.display = 'none'; hi = -1; };
  const render = () => { box.innerHTML = items.map((r, i) => `<div data-i="${i}" class="${i === hi ? 'hi' : ''}">${esc(r.name)}<small>${esc([r.admin, r.country].filter(Boolean).join(', '))}</small></div>`).join('') || '<div>No matches</div>'; box.style.display = 'block'; };
  const pick = r => {
    close(); q.value = ''; q.blur();
    setLocation({ name: [r.name, r.admin, r.country].filter(Boolean).join(', '), lat: r.lat, lon: r.lon, elev: r.elev, tz: r.tz || 'UTC' }, {});
    if (S.view === 'sky') SKY.needAim = false; else flyToLocation();
  };
  q.addEventListener('input', () => {
    clearTimeout(timer); const v = q.value.trim(); if (v.length < 2) { close(); return; }
    timer = setTimeout(async () => {
      const my = ++tok;
      try { const r = await geocode(v); if (my !== tok) return; items = r; hi = items.length ? 0 : -1; render(); }
      catch (e) { box.innerHTML = '<div>Geocoding unavailable — try “Lat/Lon”.</div>'; box.style.display = 'block'; items = []; }
    }, 260);
  });
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { hi = Math.min(items.length - 1, hi + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (items[hi]) pick(items[hi]); else if (q.value.trim().length > 1) { geocode(q.value.trim()).then(r => { if (r[0]) pick(r[0]); else toast('No place found.'); }).catch(() => toast('Geocoding unavailable.')); } }
    else if (e.key === 'Escape') close();
    e.stopPropagation();
  });
  box.addEventListener('mousedown', e => { const d = e.target.closest('[data-i]'); if (d) pick(items[+d.dataset.i]); });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) close(); });
  $('btnGeo').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Geolocation is not available in this browser.'); return; }
    toast('Locating…', 5000);
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude, r = await resolveTz(lat, lon);
      setLocation({ name: `My location (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`, lat, lon, elev: pos.coords.altitude != null ? pos.coords.altitude : (r.elev || 0), tz: r.tz }); if (S.view !== 'sky') flyToLocation();
    }, err => toast('Location unavailable: ' + err.message, 4000), { timeout: 8000, maximumAge: 600000 });
  });
  $('btnManual').addEventListener('click', () => { $('mErr').textContent = ''; $('mLat').value = S.loc.lat.toFixed(4); $('mLon').value = S.loc.lon.toFixed(4); $('mEle').value = Math.round(S.loc.elev || 0); $('mName').value = ''; $('mManual').classList.add('open'); });
  $('mGo').addEventListener('click', async () => {
    const lat = parseFloat($('mLat').value), lon = parseFloat($('mLon').value), ele = parseFloat($('mEle').value) || 0;
    if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) { $('mErr').textContent = 'Latitude −90…90 and longitude −180…180, please.'; return; }
    $('mErr').textContent = 'Resolving time zone…'; const r = await resolveTz(lat, lon);
    $('mManual').classList.remove('open');
    setLocation({ name: $('mName').value.trim() || `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`, lat, lon, elev: ele, tz: r.tz }); if (S.view !== 'sky') flyToLocation();
  });
}
function flyToLocation() {
  const e = OB.Earth; const ax = e.axes; if (!ax) return;
  const up = geoDir(ax, S.loc.lat, S.loc.lon);
  flyTo({ focus: 'Earth', dist: rVis('Earth') * 3.0, pitch: Math.asin(clamp(up[1], -1, 1)), yaw: Math.atan2(up[0], up[2]), dur: 2200 });
  if (S.view === 'system') { S.view = 'planet'; markView(); }
}
function uiLocationChanged() {
  const L = S.loc;
  $('locName').textContent = L.name; $('locLat').textContent = `${Math.abs(L.lat).toFixed(4)}° ${L.lat >= 0 ? 'N' : 'S'}`; $('locLon').textContent = `${Math.abs(L.lon).toFixed(4)}° ${L.lon >= 0 ? 'E' : 'W'}`;
  $('locElev').textContent = `${Math.round(L.elev || 0)} m`; $('locTz').textContent = tz(); $('tzName').textContent = tz().split('/').pop().replace(/_/g, ' ');
  $('bPlace').textContent = L.name;
  U.cache = {}; U.eclKey = ''; U.wxKey = ''; syncPicker(true); U.lastPanel = 0; U.lastSlow = 0; scheduleHash(); refreshWeather();
}

// ===== weather / observing =====
let wxTimer = 0;
function refreshWeather(immediate) {
  clearTimeout(wxTimer);
  wxTimer = setTimeout(async () => {
    const hourKey = Math.round(S.t / 3600000) + '|' + S.loc.lat.toFixed(2) + S.loc.lon.toFixed(2);
    if (hourKey === U.wxKey && U.wxRes) return; U.wxKey = hourKey; const my = ++U.wxToken;
    $('wxSrc').textContent = '…'; if (!U.wxRes) $('wxBody').innerHTML = '<div class="note">Loading…</div>';
    try { const r = await getWeather(S.loc.lat, S.loc.lon, S.t); if (my !== U.wxToken) return; U.wxRes = r; renderWx(r); }
    catch (e) { if (my !== U.wxToken) return; U.wxRes = { kind: 'error' }; $('wxSrc').textContent = 'offline'; $('wxBody').innerHTML = `<div class="note warn">Weather unavailable (${esc(e.message)}). The rest of the app is unaffected.</div>`; }
    U.lastSlow = 0;
  }, immediate ? 0 : 650);
}
function renderWx(r) {
  const el = $('wxBody'); $('wxSrc').textContent = r.source || '';
  if (r.kind === 'none') { el.innerHTML = `<div class="note">${esc(r.msg)}</div>`; return; }
  if (r.kind === 'climatology') {
    const c = r.clim; el.innerHTML = `<div class="note warn" style="margin:0 0 6px">No forecast available this far ahead.</div>
      <div class="big">${fmt1(c.temperature_2m, 0)}<small>°C typical</small></div>
      <div class="kv" style="margin-top:8px"><span>Mean cloud cover</span><span>${fmt1(c.cloud_cover, 0)} %</span><span>Chance of rain</span><span>${(c.pRain * 100).toFixed(0)} %</span><span>Typical wind</span><span>${fmt1(c.wind_speed_10m, 0)} km/h</span></div>
      <div class="note">Climatology, not a forecast — mean of ${r.years[0]}–${r.years[1]} for this date and hour (ERA5).</div>`; return;
  }
  const d = r.data, w = wmo(d.weather_code);
  el.innerHTML = `<div class="row"><div class="big">${fmt1(d.temperature_2m, 0)}<small>°C</small></div><div style="text-align:right;font-size:26px">${w[1]}<div style="font-size:12px;color:var(--dim)">${w[0]}</div></div></div>
    <div class="kv" style="margin-top:8px"><span>Feels like</span><span>${fmt1(d.apparent_temperature, 0)} °C</span><span>Humidity</span><span>${fmt1(d.relative_humidity_2m, 0)} %</span>
    <span>Wind</span><span>${fmt1(d.wind_speed_10m, 0)} km/h ${d.wind_direction_10m != null ? compass16(d.wind_direction_10m) : ''}${d.wind_gusts_10m != null ? ' · gust ' + fmt1(d.wind_gusts_10m, 0) : ''}</span>
    <span>Pressure</span><span>${fmt1(d.pressure_msl, 0)} hPa</span><span>Precipitation</span><span>${fmt1(d.precipitation, 1)} mm/h</span>
    <span>Cloud cover</span><span>${fmt1(d.cloud_cover, 0)} %</span><span>low · mid · high</span><span>${fmt1(d.cloud_cover_low, 0)} · ${fmt1(d.cloud_cover_mid, 0)} · ${fmt1(d.cloud_cover_high, 0)} %</span>
    <span>Visibility</span><span>${d.visibility != null ? fmt1(d.visibility / 1000, 1) + ' km' : 'n/a'}</span></div>
    <div class="note">Valid ${fmtNice(d.timeMs, 'UTC')} UTC${r.kind === 'archive' ? ' · historical reanalysis at this exact hour' : r.kind === 'forecast' ? ' · forecast' : ''}</div>`;
}
let obsToken = 0;
function renderObserving(sunAlt, moon, up) {
  const el = $('obsBody'); const wx = U.wxRes && U.wxRes.data ? U.wxRes.data : null;
  const twi = sunAlt > 0 ? 'Daytime' : sunAlt > -6 ? 'Civil twilight' : sunAlt > -12 ? 'Nautical twilight' : sunAlt > -18 ? 'Astronomical twilight' : 'Night';
  let html = `<div class="row"><span>${twi}</span><b class="${sunAlt < -12 ? 'ok' : 'acc'}">Sun ${sgn(sunAlt)}</b></div>`;
  html += `<div class="row"><span>${moon.name}</span><span>${moon.pct.toFixed(0)}% lit · ${moon.alt > 0 ? 'up ' + sgn(moon.alt, 0) : 'below horizon'}</span></div>`;
  if (wx) { const r = skyRating(wx.cloud_cover, wx.visibility, wx.precipitation, wx.weather_code); html += `<div class="bar"><i style="width:${r.pct}%"></i></div><div class="row"><span>Sky clarity</span><b class="${r.cls}">${r.label}</b></div><div class="note">Cloud ${fmt1(wx.cloud_cover, 0)}% (${U.wxRes.kind}) at this hour.</div>`; }
  else if (U.wxRes && U.wxRes.kind === 'climatology') html += `<div class="note">Typical cloud for this date: ${fmt1(U.wxRes.clim.cloud_cover, 0)}% (climatology).</div>`;
  else html += `<div class="note">No cloud data for this time.</div>`;
  if (up && up.window) {
    html += `<div class="note" style="margin-top:8px;color:var(--txt)"><b>Up tonight</b> (${fmtShort(up.window.from, tz())}–${fmtShort(up.window.to, tz())} ${tz().split('/').pop().replace(/_/g, ' ')})</div>`;
    html += up.rows.length ? up.rows.map(r => `<div class="row" style="font-size:12px"><span><span class="dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${BODY[r.id].color};margin-right:6px"></span>${r.id}${r.naked ? '' : ' <small style="color:var(--faint)">(optics)</small>'}</span><span style="color:var(--dim);font-family:var(--mono)">${r.all ? 'all night' : fmtShort(r.first, tz()) + '–' + fmtShort(r.last, tz())} · max ${r.maxAlt.toFixed(0)}°</span></div>`).join('') : '<div class="note">No planets above 8° during the night.</div>';
  } else if (up) html += '<div class="note">No sunset/sunrise at this latitude/date.</div>';
  html += `<div id="obsEcl"></div>`;
  el.innerHTML = html; renderObsEclipse();
}
async function renderObsEclipse() {
  const box = $('obsEcl'); if (!box || !U.ecl) return; const my = ++obsToken;
  const cands = [U.ecl.solarPrev, U.ecl.solarNext, U.ecl.lunarPrev, U.ecl.lunarNext].filter(e => e && e.visible && Math.abs(e.peak - S.t) < 36 * 3600000);
  if (!cands.length) { box.innerHTML = ''; return; }
  const e = cands.sort((a, b) => Math.abs(a.peak - S.t) - Math.abs(b.peak - S.t))[0], when = e.type === 'solar' && e.local ? e.local.peak.ms : e.peak;
  box.innerHTML = `<div class="note" style="margin-top:8px;color:var(--txt)"><b>${kindLabel(e)} eclipse</b> ${fmtRel(when, S.t)}<br>Cloud forecast at maximum: <span class="tt">loading…</span></div>`;
  try {
    const r = await getWeather(S.loc.lat, S.loc.lon, when); if (my !== obsToken) return;
    if (r.data) { const rt = skyRating(r.data.cloud_cover, r.data.visibility, r.data.precipitation, r.data.weather_code); box.innerHTML = `<div class="note" style="margin-top:8px;color:var(--txt)"><b>${kindLabel(e)} eclipse</b> ${fmtRel(when, S.t)} · ${fmtNice(when, tz())}<br>${r.kind === 'archive' ? 'Cloud cover at maximum (historical)' : 'Cloud at maximum'}: <b class="${rt.cls}">${fmt1(r.data.cloud_cover, 0)}% — ${rt.label}</b></div>`; }
    else box.innerHTML = `<div class="note" style="margin-top:8px"><b>${kindLabel(e)} eclipse</b> ${fmtRel(when, S.t)}<br>${esc(r.msg || 'Cloud forecast not available for that time.')}</div>`;
  } catch (er) { if (my === obsToken) box.innerHTML = `<div class="note" style="margin-top:8px"><b>${kindLabel(e)} eclipse</b> ${fmtRel(when, S.t)}<br>Cloud data unavailable.</div>`; }
}

// ===== sun/moon, planets, eclipses panels =====
function hmm(ms) { return ms == null ? '—' : fmtShort(ms, tz()); }
function riseSetFor(id, obs, tms) {
  const p = partsInZone(tms, tz()), key = `${id}|${p.y}-${p.mo}-${p.d}|${S.loc.lat}|${S.loc.lon}`;
  if (U.cache[key]) return U.cache[key];
  const start = localToUTC(p.y, p.mo, p.d, 0, 0, 0, tz()).ms, tt = timeOf(start), b = A.Body[id];
  const r = { rise: T2MS(A.SearchRiseSet(b, obs, +1, tt, 1)), set: T2MS(A.SearchRiseSet(b, obs, -1, tt, 1)), transit: null };
  try { const h = A.SearchHourAngle(b, obs, 0, tt); r.transit = h.time.date.getTime(); if (r.transit > start + MS_DAY) r.transit = null; } catch (e) { }
  const win = x => x != null && x >= start && x < start + MS_DAY ? x : null;
  r.rise = win(r.rise); r.set = win(r.set); return (U.cache[key] = r);
}
function renderSunMoon(time, obs) {
  const sun = skyBody('Sun', time, obs), moon = skyBody('Moon', time, obs);
  const ph = A.MoonPhase(time), il = A.Illumination(A.Body.Moon, time), age = ph / 360 * 29.530588853;
  const rsS = riseSetFor('Sun', obs, S.t), rsM = riseSetFor('Moon', obs, S.t);
  const moonInfo = { name: moonPhaseName(ph), pct: il.phase_fraction * 100, alt: moon.alt };
  const lib = A.Libration(time);
  let html = `<div class="row"><b class="acc">☀ Sun</b><span style="font-family:var(--mono)">${sgn(sun.alt)} alt · ${sun.az.toFixed(0)}° ${compass16(sun.az)}</span></div>
   <div class="kv" style="margin:4px 0 10px"><span>Rise · Transit · Set</span><span>${hmm(rsS.rise)} · ${hmm(rsS.transit)} · ${hmm(rsS.set)}</span><span>Distance</span><span>${(sun.distAU).toFixed(4)} AU</span><span>RA · Dec</span><span>${hms(sun.ra)} · ${sgn(sun.dec)}</span></div>
   <div class="row"><b class="acc2">☾ Moon</b><span style="font-family:var(--mono)">${sgn(moon.alt)} alt · ${moon.az.toFixed(0)}° ${compass16(moon.az)}</span></div>
   <div class="kv" style="margin-top:4px"><span>Phase</span><span>${moonInfo.name}</span><span>Illuminated · age</span><span>${moonInfo.pct.toFixed(1)}% · ${age.toFixed(1)} d</span><span>Rise · Transit · Set</span><span>${hmm(rsM.rise)} · ${hmm(rsM.transit)} · ${hmm(rsM.set)}</span><span>Distance</span><span>${Math.round(moon.distAU * AU_KM).toLocaleString()} km</span><span>Angular size</span><span>${(2 * angRadius(BODY.Moon.R, moon.distAU) / DEG * 60).toFixed(1)}′ (Sun ${(2 * angRadius(BODY.Sun.R, sun.distAU) / DEG * 60).toFixed(1)}′)</span><span>Libration lon/lat</span><span>${lib.elon.toFixed(1)}° / ${lib.elat.toFixed(1)}°</span></div>`;
  const sk = solarEclipseNowLite(time, obs);
  if (sk && sk.obsc > 0 && sun.alt > -1) html += `<div class="note" style="color:var(--acc);margin-top:8px"><b>Solar eclipse in progress here:</b> ${(sk.obsc * 100).toFixed(1)}% of the Sun covered · magnitude ${sk.mag.toFixed(3)}</div>`;
  const lu = lunarEclipseNow(time);
  if (lu.behind && lu.penMag > 0) html += `<div class="note" style="color:#9fc5ff;margin-top:8px"><b>Lunar eclipse in progress:</b> ${lu.umbMag > 0 ? 'umbral magnitude ' + lu.umbMag.toFixed(3) : 'penumbral magnitude ' + lu.penMag.toFixed(3)}</div>`;
  $('sunmoonBody').innerHTML = html; return { sun, moon: moonInfo };
}
function solarEclipseNowLite(time, obs) { try { return solarEclipseNow(time, obs); } catch (e) { return null; } }
function renderPlanets(time, obs, sunAlt) {
  const rows = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].map(id => {
    const p = skyBody(id, time, obs), il = illum(id, time), mag = il ? il.mag : null;
    const naked = NAKED_EYE.has(id) && (mag == null || mag < 6.2), dark = sunAlt < -6;
    const vis = p.alt > 3 && dark && naked ? 2 : p.alt > 0 ? 1 : 0;
    return `<tr data-id="${id}" class="${vis === 2 ? 'up' : ''}" title="${id}: RA ${hms(p.ra)} Dec ${sgn(p.dec)} · mag ${mag != null ? mag.toFixed(1) : '—'} · ${(p.distAU).toFixed(3)} AU">
      <td><span class="dot" style="background:${BODY[id].color}"></span>${id}</td><td>${hms(p.ra)}</td><td>${sgn(p.dec, 0)}</td><td>${p.alt.toFixed(0)}°</td><td>${p.az.toFixed(0)}°</td><td>${p.distAU.toFixed(2)}</td><td class="${vis === 2 ? 'vis' : 'nov'}">${vis === 2 ? '✔' : vis === 1 ? '☼' : '—'}</td></tr>`;
  }).join('');
  $('planetBody').innerHTML = `<table class="t"><tr><th>Body</th><th>RA</th><th>Dec</th><th>Alt</th><th>Az</th><th>AU</th><th>Vis</th></tr>${rows}</table><div class="note">✔ visible now (dark sky, above horizon, naked eye) · ☼ up in daylight/twilight · — below horizon. Hover for magnitude.</div>`;
  $('planetBody').querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', () => { selectBody(tr.dataset.id); focusBody(tr.dataset.id); }));
}
function ensureEclipses() {
  const obs = obsNow(), key = S.loc.lat + ',' + S.loc.lon, E = U.ecl;
  const need = !E || E.key !== key || ['solarPrev', 'solarNext', 'lunarPrev', 'lunarNext'].some(k => !E[k]) || S.t < E.solarPrev.peak - MS_DAY || S.t > E.solarNext.peak + MS_DAY || S.t < E.lunarPrev.peak - MS_DAY || S.t > E.lunarNext.peak + MS_DAY
    || !(S.t >= E.solarPrev.peak - 3600000 && S.t <= E.solarNext.peak + 3600000) || !(S.t >= E.lunarPrev.peak - 3600000 && S.t <= E.lunarNext.peak + 3600000);
  if (!need) return;
  const mkS = ev => { if (!ev) return ev; ev.local = localSolar(ev.peak, obs); ev.visible = !!ev.local && (ev.local.peak.alt > -1 || (ev.local.pb && ev.local.pb.alt > 0) || (ev.local.pe && ev.local.pe.alt > 0)); return ev; };
  const mkL = ev => { if (!ev) return ev; ev.local = localLunar(ev, obs); ev.visible = ev.local.visible; return ev; };
  try {
    U.ecl = { key, solarPrev: mkS(stepGlobal('solar', S.t, -1)), solarNext: mkS(stepGlobal('solar', S.t, 1)), lunarPrev: mkL(stepGlobal('lunar', S.t, -1)), lunarNext: mkL(stepGlobal('lunar', S.t, 1)) };
  } catch (e) { console.error(e); }
}
function eclRow(ev, label) {
  if (!ev) return '';
  const when = ev.type === 'solar' && ev.visible && ev.local ? ev.local.peak.ms : ev.peak;
  const kind = ev.kind[0].toUpperCase() + ev.kind.slice(1);
  let detail = '';
  if (ev.type === 'solar') {
    if (ev.visible && ev.local) { const l = ev.local; detail = `max ${(l.obsc * 100).toFixed(1)}% covered · Sun ${l.peak.alt.toFixed(0)}° high<br>C1 ${hmm(l.pb && l.pb.ms)}${l.tb ? ' · totality ' + hmm(l.tb.ms) + '–' + hmm(l.te.ms) + ' (' + Math.round((l.te.ms - l.tb.ms) / 1000) + ' s)' : ''} · C4 ${hmm(l.pe && l.pe.ms)}`; }
    else detail = isFinite(ev.lat) ? `greatest eclipse near ${Math.abs(ev.lat).toFixed(0)}°${ev.lat >= 0 ? 'N' : 'S'}, ${Math.abs(ev.lon).toFixed(0)}°${ev.lon >= 0 ? 'E' : 'W'}` : 'partial eclipse — shadow axis misses Earth (polar regions favoured)';
  } else {
    const l = ev.local; detail = `${l.pts.tot0 ? 'totality ' + hmm(l.pts.tot0.ms) + '–' + hmm(l.pts.tot1.ms) + ' · ' : ''}${l.pts.par0 ? 'partial ' + hmm(l.pts.par0.ms) + '–' + hmm(l.pts.par1.ms) + ' · ' : ''}penumbral ${hmm(l.pts.pen0.ms)}–${hmm(l.pts.pen1.ms)}${l.visible ? '<br>Moon ' + l.peakAlt.toFixed(0) + '° at maximum' : ''}`;
  }
  return `<div class="ecl" data-ms="${when}"><div class="h"><b>${label} · ${kind} ${ev.type}</b><span class="tag ${ev.visible ? 'v' : ''}">${ev.visible ? 'visible here' : 'not visible here'}</span></div><small>${fmtNice(when, tz())} · ${fmtRel(when, S.t)}</small><div class="note" style="margin:3px 0 0">${detail}</div></div>`;
}
function renderEclipses() {
  ensureEclipses(); const E = U.ecl; if (!E) { $('eclBody').innerHTML = '<div class="note">Computing…</div>'; return; }
  const t = S.t; let live = '';
  const sp = E.solarPrev, sn = E.solarNext;
  for (const ev of [sp, sn]) if (ev && ev.visible && ev.local && ev.local.pb && ev.local.pe && t >= ev.local.pb.ms && t <= ev.local.pe.ms) {
    const s = solarEclipseNowLite(timeOf(t), obsNow()); const total = ev.local.tb && t >= ev.local.tb.ms && t <= ev.local.te.ms;
    live += `<div class="note" style="background:rgba(255,180,84,.14);border:1px solid #a8742a;border-radius:8px;padding:6px 8px;margin:0 0 8px;color:var(--txt)"><b class="acc">${total ? '● TOTALITY' : 'Solar eclipse in progress'}</b> — ${(s.obsc * 100).toFixed(2)}% of the Sun covered, magnitude ${s.mag.toFixed(4)}, Sun ${s.sunAlt.toFixed(0)}° high. Phase: ${total ? 'total' : t < ev.local.peak.ms ? 'partial, approaching maximum' : 'partial, after maximum'}.</div>`;
  }
  for (const ev of [E.lunarPrev, E.lunarNext]) if (ev && Math.abs(t - ev.peak) < ev.sdPen * 60000) {
    const lu = lunarEclipseNow(timeOf(t)), ph = lu.umbMag >= 1 ? 'total (umbral)' : lu.umbMag > 0 ? 'partial (umbral)' : 'penumbral';
    live += `<div class="note" style="background:rgba(106,160,255,.12);border:1px solid #3d6ab0;border-radius:8px;padding:6px 8px;margin:0 0 8px;color:var(--txt)"><b style="color:#9fc5ff">Lunar eclipse in progress</b> — ${ph} phase, umbral magnitude ${lu.umbMag.toFixed(3)}, penumbral ${lu.penMag.toFixed(3)}.</div>`;
  }
  const rows = [['Next', sn], ['Previous', sp]].map(r => eclRow(r[1], r[0])).join('') + [['Next', E.lunarNext], ['Previous', E.lunarPrev]].map(r => eclRow(r[1], r[0])).join('');
  $('eclBody').innerHTML = live + rows + '<div class="note">Click an entry to jump there. Times are in the location’s time zone.</div>';
  $('eclBody').querySelectorAll('.ecl').forEach(el => el.addEventListener('click', () => { setTime(+el.dataset.ms); if (S.view !== 'sky') setView('sky', { reaim: true }); }));
}
function renderInfo(id) {
  const d = BODY[id]; if (!d || !ST) return; const p = ST.pos[id];
  const dS = v3.len(p), dE = id === 'Earth' ? 0 : v3.len(v3.sub(p, ST.pos.Earth)), lightMin = dE / 299792.458 / 60;
  const moons = (MOONS_OF[id] || []).map(m => `<button class="chip" data-m="${m}">${m}</button>`).join(' ');
  const acc = d.parent && id !== 'Moon' && !GALILEAN.includes(id) ? '<div class="note">Mean-element accuracy (JPL SSD): fine for visuals, not for precise phenomena.</div>' : '';
  $('infoBody').innerHTML = `<div class="row"><b style="font-size:16px"><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${d.color};margin-right:7px"></span>${id}</b><button class="btn" id="infoFly" style="padding:3px 10px">Fly to</button></div>
   <div class="kv" style="margin-top:7px"><span>Diameter</span><span>${d.info.dia}</span><span>Mass</span><span>${d.info.mass}</span><span>Day length</span><span>${d.info.day}</span><span>Orbital period</span><span>${d.info.year}</span>
   <span>From Sun</span><span>${(dS / AU_KM).toFixed(id === 'Sun' ? 0 : 3)} AU</span><span>From Earth</span><span>${id === 'Earth' ? '—' : fmtKm(dE) + ' · ' + (lightMin < 120 ? lightMin.toFixed(1) + ' light-min' : (lightMin / 60).toFixed(2) + ' light-h')}</span></div>
   ${moons ? '<div class="note" style="color:var(--txt)">Moons: ' + moons + '</div>' : ''}${acc}`;
  $('infoFly').addEventListener('click', () => focusBody(id));
  $('infoBody').querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { selectBody(b.dataset.m); focusBody(b.dataset.m); }));
}
function uiSelect(id) { renderInfo(id); }

// ===== eclipse finder modal =====
function openFinder() { $('mEcl').classList.add('open'); runFinder(); }
function runFinder() {
  const yrs = +$('fWin').value, onlyVis = $('fVis').checked; $('fList').innerHTML = '<div class="note">Computing every eclipse in the window…</div>';
  setTimeout(() => {
    const t0 = performance.now(), obs = obsNow();
    let L = eclipseList(S.t - yrs * 365.25 * MS_DAY, S.t + yrs * 365.25 * MS_DAY, obs); const total = L.length; if (onlyVis) L = L.filter(e => e.visible);
    $('fSum').textContent = `${L.length}${onlyVis ? ' visible of ' + total : ''} eclipses · ${(performance.now() - t0).toFixed(0)} ms`;
    $('fList').innerHTML = `<table class="t" id="fTbl"><tr><th>Date (${tz().split('/').pop()})</th><th>Type</th><th>Kind</th><th>Here</th><th>Detail</th></tr>${L.map(e => {
      const when = e.type === 'solar' && e.visible && e.local ? e.local.peak.ms : e.peak;
      const det = e.type === 'solar' ? (e.visible && e.local ? `${(e.local.obsc * 100).toFixed(0)}% covered` : (isFinite(e.lat) ? `greatest ${Math.abs(e.lat).toFixed(0)}°${e.lat >= 0 ? 'N' : 'S'} ${Math.abs(e.lon).toFixed(0)}°${e.lon >= 0 ? 'E' : 'W'}` : 'partial only')) : (e.visible ? `Moon ${e.local.peakAlt.toFixed(0)}° up` : 'Moon down');
      return `<tr data-ms="${when}"><td>${fmtNice(when, tz())}</td><td><span class="tag ${e.type === 'solar' ? 's' : 'l'}">${e.type}</span></td><td>${e.kind}</td><td class="${e.visible ? 'vis' : 'nov'}">${e.visible ? 'yes' : '—'}</td><td style="text-align:left;font-family:var(--sans)">${det}</td></tr>`;
    }).join('')}</table>`;
    $('fList').querySelectorAll('tr[data-ms]').forEach(tr => tr.addEventListener('click', () => { setTime(+tr.dataset.ms); $('mEcl').classList.remove('open'); }));
  }, 30);
}

// ===== timeline =====
const ECL_LIST = (() => {
  const T = ECLIPSE_TABLE, out = [], SK = { P: 'partial', A: 'annular', T: 'total', H: 'hybrid' }, LK = { N: 'penumbral', P: 'partial', T: 'total' };
  for (const [type, tab, K] of [['solar', T.solar, SK], ['lunar', T.lunar, LK]]) { let t = T.base; tab.d.forEach((d, i) => { t += d; out.push({ ms: t * 60000, type, kind: K[tab.k[i]] || 'partial' }); }); }
  return out.sort((a, b) => a.ms - b.ms);
})();
const TL = { span: 30 * MS_DAY, events: [], cover: null, token: 0, canvas: $('tl'), hover: null, drag: null };
const TL_MIN = MS_DAY, TL_MAX = 500 * 365.2425 * MS_DAY;
function tlSizing() { const c = TL.canvas, r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); } return { w: r.width, h: r.height, dpr }; }
async function tlCompute() {
  const yrs = TL.span / (365.2425 * MS_DAY), mg = yrs > 40 ? 0.58 : 1.1, my = ++TL.token, lo = S.t - TL.span * mg, hi = S.t + TL.span * mg;
  TL.busy = true; TL.target = { lo, hi, span: TL.span };
  const base = []; let sliceT = performance.now();
  const yieldNow = async (force) => { if (force || performance.now() - sliceT > 6) { await new Promise(r => setTimeout(r, 9)); sliceT = performance.now(); if (my !== TL.token) throw 'cancel'; } };
  try {
    if (yrs <= 3.2) for (const [ph, key] of [[0, 'newmoon'], [180, 'fullmoon']]) { let t = lo, n = 0; while (n++ < 90) { const q = A.SearchMoonPhase(ph, timeOf(t), 40); if (!q) break; const ms = q.date.getTime(); if (ms > hi) break; base.push({ ms, type: key }); t = ms + 3600000; } }
    if (yrs <= 520) { const y0 = new Date(Math.max(lo, RANGE.validMin)).getUTCFullYear(), y1 = new Date(Math.min(hi, RANGE.validMax)).getUTCFullYear(); for (let y = y0; y <= y1; y++) { const s = A.Seasons(y); for (const [k, n] of [['mar_equinox', 'Mar equinox'], ['jun_solstice', 'Jun solstice'], ['sep_equinox', 'Sep equinox'], ['dec_solstice', 'Dec solstice']]) if (yrs <= 40 || k === 'mar_equinox') base.push({ ms: s[k].date.getTime(), type: 'season', kind: n }); } }
    TL.events = base.slice();
    // eclipses: instant lookup in the precomputed 1000-3000 CE table (scripts/build_eclipse_table.js)
    let i0 = 0, i1 = ECL_LIST.length; while (i0 < i1) { const m = (i0 + i1) >> 1; if (ECL_LIST[m].ms < lo) i0 = m + 1; else i1 = m; }
    const ecl = []; for (let i = i0; i < ECL_LIST.length && ECL_LIST[i].ms <= hi; i++) ecl.push(ECL_LIST[i]);
    TL.events = base.concat(ecl);
  } catch (e) { if (e !== 'cancel') console.warn('timeline events', e); else return; }
  if (my !== TL.token) return; TL.cover = { lo, hi, span: TL.span }; TL.busy = false;
}
function tlEnsure() {
  const c = TL.cover, tg = TL.target;
  const covered = c && Math.abs(c.span / TL.span - 1) < 0.01 && S.t - TL.span * 0.45 > c.lo && S.t + TL.span * 0.45 < c.hi;
  if (covered) return;
  if (TL.busy && tg && Math.abs(tg.span / TL.span - 1) < 0.01 && S.t - TL.span * 0.45 > tg.lo && S.t + TL.span * 0.45 < tg.hi) return; // the running job still fits
  if (TL.pending) return;
  TL.pending = true; clearTimeout(TL.timer);
  TL.timer = setTimeout(() => { TL.pending = false; tlCompute(); }, 140);
}
const TL_STEPS = [[60e3, 'm'], [5 * 60e3, 'm'], [15 * 60e3, 'm'], [3600e3, 'h'], [3 * 3600e3, 'h'], [6 * 3600e3, 'h'], [MS_DAY, 'd'], [2 * MS_DAY, 'd'], [7 * MS_DAY, 'd'], ['M1', 'M'], ['M3', 'M'], ['Y1', 'Y'], ['Y5', 'Y'], ['Y10', 'Y'], ['Y50', 'Y'], ['Y100', 'Y']];
function tlTicks(t0, t1, w) {
  const out = [], zone = tz(), per = (t1 - t0) / w; let chosen = null;
  for (const s of TL_STEPS) { const ms = typeof s[0] === 'number' ? s[0] : (s[0][0] === 'M' ? +s[0].slice(1) * 30.4375 * MS_DAY : +s[0].slice(1) * 365.2425 * MS_DAY); if (ms / per >= 64) { chosen = s; break; } }
  chosen = chosen || TL_STEPS[TL_STEPS.length - 1];
  const kind = chosen[1];
  if (kind === 'M' || kind === 'Y') {
    const step = typeof chosen[0] === 'string' ? +chosen[0].slice(1) : 1, y0 = new Date(Math.max(t0, RANGE.validMin)).getUTCFullYear();
    if (kind === 'Y') for (let y = Math.floor(y0 / step) * step; ; y += step) { const ms = utcFromParts(y, 1, 1); if (ms > t1) break; if (ms >= t0) out.push({ ms, label: String(y), major: y % (step * 2) === 0 }); }
    else { for (let y = y0 - 1; y <= y0 + 4; y++) for (let m = 1; m <= 12; m += step) { const ms = utcFromParts(y, m, 1); if (ms >= t0 && ms <= t1) out.push({ ms, label: m === 1 ? String(y) : MONTHS[m - 1], major: m === 1 }); } }
  } else {
    const stepMs = chosen[0], p0 = partsInZone(t0, zone), wall0 = utcFromParts(p0.y, p0.mo, p0.d, p0.h, p0.mi, p0.s), wallT1 = wall0 + (t1 - t0) + 2 * 3600000;
    const toUTC = w => { let ms = w - offsetMs(w, zone); ms = w - offsetMs(ms, zone); return ms; };
    for (let w = Math.ceil(wall0 / stepMs) * stepMs; w <= wallT1; w += stepMs) {
      const ms = toUTC(w); if (ms < t0 || ms > t1) continue;
      const q = new Date(w), h = q.getUTCHours(), mi = q.getUTCMinutes(), midnight = h === 0 && mi === 0;
      out.push({ ms, label: kind === 'd' ? (midnight ? `${q.getUTCDate()} ${MONTHS[q.getUTCMonth()]}` : `${pad(h)}:${pad(mi)}`) : `${pad(h)}:${pad(mi)}`, major: midnight });
    }
  }
  return out;
}
function drawTimeline() {
  const key = [TL.span, TL.hover ? TL.hover.e.ms : 0, TL.events.length, tz(), S.live ? 0 : 1, innerWidth].join('|');
  const wpx = TL.canvas.clientWidth || 800, moved = Math.abs(S.t - (TL.lastT || 0)) / TL.span * wpx;
  const nowPx = Math.abs(Date.now() - (TL.lastNow || 0)) / TL.span * wpx;
  if (key === TL.lastKey && moved < 0.35 && nowPx < 0.35) return;
  TL.lastKey = key; TL.lastT = S.t; TL.lastNow = Date.now();
  const { w, h, dpr } = tlSizing(), g = TL.canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const t0 = S.t - TL.span / 2, t1 = S.t + TL.span / 2, X = ms => (ms - t0) / TL.span * w;
  // out-of-range shading
  g.fillStyle = 'rgba(255,90,70,.10)'; if (t0 < RANGE.validMin) g.fillRect(0, 0, X(RANGE.validMin), h); if (t1 > RANGE.validMax) g.fillRect(X(RANGE.validMax), 0, w, h);
  g.fillStyle = 'rgba(255,180,84,.07)'; for (const [a, b] of [[RANGE.validMin, RANGE.accMin], [RANGE.accMax, RANGE.validMax]]) { const x0 = Math.max(0, X(a)), x1 = Math.min(w, X(b)); if (x1 > x0) g.fillRect(x0, 0, x1 - x0, h); }
  // ticks
  g.font = '10px ui-monospace,Consolas,monospace'; g.textBaseline = 'alphabetic';
  for (const t of tlTicks(t0, t1, w)) { const x = X(t.ms); g.strokeStyle = t.major ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x + .5, h - (t.major ? 22 : 14)); g.lineTo(x + .5, h); g.stroke(); g.fillStyle = t.major ? '#cfd8ea' : '#7d89a3'; g.fillText(t.label, x + 3, h - 4); }
  // events
  TL.pins = [];
  for (const e of TL.events) {
    if (e.ms < t0 || e.ms > t1) continue; const x = X(e.ms); let y, r;
    const dense = TL.span > 25 * 365.2425 * MS_DAY;
    if (e.type === 'solar' && dense) { y = 15; r = 2.2; g.fillStyle = '#ffb454'; g.fillRect(x - 1, y - 5, 2, 10); }
    else if (e.type === 'lunar' && dense) { y = 15; r = 2.2; g.fillStyle = '#8fb6ff'; g.fillRect(x - 1, y + 1, 2, 7); }
    else if (e.type === 'solar') { y = 15; r = 5.5; g.fillStyle = '#ffb454'; g.strokeStyle = '#fff3d0'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.lineWidth = 1.5; g.stroke(); g.lineWidth = 1; }
    else if (e.type === 'lunar') { y = 15; r = 5.5; g.fillStyle = '#16213a'; g.strokeStyle = '#8fb6ff'; g.lineWidth = 1.8; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); g.lineWidth = 1; }
    else if (e.type === 'newmoon') { y = 33; r = 3.5; g.fillStyle = '#0b0f1a'; g.strokeStyle = '#8b97ae'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); }
    else if (e.type === 'fullmoon') { y = 33; r = 3.5; g.fillStyle = '#f4f0dc'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    else { y = 33; r = 4; g.fillStyle = '#6ee7a1'; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.fill(); }
    TL.pins.push({ x, y, r: r + 4, e });
  }
  // now marker
  const nowX = X(Date.now()); if (nowX > 0 && nowX < w) { g.strokeStyle = 'rgba(106,209,255,.7)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(nowX + .5, 0); g.lineTo(nowX + .5, h); g.stroke(); g.setLineDash([]); g.fillStyle = '#6ad1ff'; g.fillText('now', nowX + 4, 10); }
  // cursor (picked time)
  g.strokeStyle = '#ffb454'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); g.lineWidth = 1;
  g.fillStyle = '#ffb454'; g.beginPath(); g.moveTo(w / 2 - 5, 0); g.lineTo(w / 2 + 5, 0); g.lineTo(w / 2, 7); g.fill();
  g.fillStyle = 'rgba(8,12,22,.7)'; g.fillRect(4, 3, 150, 14); g.fillStyle = '#8b97ae'; g.fillText(`span ${fmtDur(TL.span)}${''}`, 8, 13);
  if (TL.hover) { const p = TL.hover; const txt = `${p.e.type === 'solar' || p.e.type === 'lunar' ? p.e.kind + ' ' + p.e.type + ' eclipse (global)' : p.e.type === 'season' ? p.e.kind : p.e.type === 'newmoon' ? 'New Moon' : 'Full Moon'} · ${fmtNice(p.e.ms, tz())}`; const tw = g.measureText(txt).width + 14, tx = Math.min(w - tw - 4, Math.max(4, p.x - tw / 2)); g.fillStyle = 'rgba(8,12,22,.92)'; g.fillRect(tx, 38, tw, 18); g.strokeStyle = '#fff3'; g.strokeRect(tx + .5, 38.5, tw, 18); g.fillStyle = '#e9eef8'; g.fillText(txt, tx + 7, 51); }
}
function wire_timeline() {
  const wrap = $('tlwrap'); let d = null;
  wrap.addEventListener('pointerdown', e => { wrap.setPointerCapture(e.pointerId); d = { x: e.clientX, moved: 0, t: S.t }; tourCancel(); });
  wrap.addEventListener('pointermove', e => {
    const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (d) { const dx = e.clientX - d.x; d.moved = Math.max(d.moved, Math.abs(dx)); if (d.moved > 3) { const wasPlaying = S.playing; setTime(clampTime(d.t - dx / r.width * TL.span), { keepPlaying: false }); S.playing = false; syncPlayUI(); } return; }
    TL.hover = (TL.pins || []).find(p => Math.hypot(p.x - x, p.y - y) < p.r) || null; wrap.style.cursor = TL.hover ? 'pointer' : 'ew-resize';
  });
  wrap.addEventListener('pointerup', e => {
    if (d && d.moved <= 3) { const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, pin = (TL.pins || []).find(p => Math.hypot(p.x - x, p.y - y) < p.r); if (pin) setTime(pin.e.ms); }
    d = null;
  });
  wrap.addEventListener('pointerleave', () => { TL.hover = null; });
  wrap.addEventListener('wheel', e => { e.preventDefault(); TL.span = clamp(TL.span * Math.exp(clamp(e.deltaY, -250, 250) * 0.0016), TL_MIN, TL_MAX); tlEnsure(); }, { passive: false });
  wrap.addEventListener('dblclick', () => { TL.span = 30 * MS_DAY; tlEnsure(); });
}

// ===== toggles / views / misc =====
const TOGGLES = [['helix', 'Helix'], ['bloom', 'Bloom'], ['orbits', 'Orbits'], ['trails', 'Trails'], ['labels', 'Labels'], ['moons', 'Moons'], ['constellations', 'Constellations'], ['trueScale', 'True scale'], ['shadows', 'Shadows'], ['clouds', 'Clouds'], ['liveClouds', 'Live clouds']];
function wire_toggles() {
  const box = $('toggles');
  for (const [k, n] of TOGGLES) {
    const b = document.createElement('button'); b.className = 'chip' + ((k === 'trueScale' ? S.trueScale : S.tg[k]) ? ' on' : ''); b.dataset.tg = k; b.textContent = n;
    b.title = k === 'trueScale' ? 'Real sizes and distances (1 unit = 1000 km)' : k === 'shadows' ? 'Shadow cones (true scale). Pixel shadows are always on.' : n;
    b.addEventListener('click', () => { if (k === 'helix') { setHelix(!HX.on); } else if (k === 'trueScale') { setScale(!S.trueScale); hxNote(); } else { S.tg[k] = !S.tg[k]; b.classList.toggle('on', S.tg[k]); if (k === 'trails') { trailAnchor = null; $('trSpan').style.display = S.tg.trails ? '' : 'none'; } if (k === 'liveClouds') scheduleClouds(); } scheduleHash(); });
    box.appendChild(b);
    if (k === 'trails') { const s = document.createElement('select'); s.id = 'trSpan'; s.className = 'fld'; s.style.cssText = 'height:26px;display:none;font-size:11px'; s.innerHTML = '<option value="30">±30 d</option><option value="365" selected>±1 y</option><option value="3650">±10 y</option>'; s.addEventListener('change', () => { S.trailSpan = +s.value; trailAnchor = null; }); box.appendChild(s); }
  }
  document.querySelectorAll('.vbtn[data-v]').forEach(b => b.addEventListener('click', () => { setView(b.dataset.v, { reaim: b.dataset.v === 'sky' }); scheduleHash(); }));
  $('btnTour').addEventListener('click', runTour);
  document.querySelectorAll('[data-aim]').forEach(b => b.addEventListener('click', () => { aimSky(b.dataset.aim); syncFov(); }));
  $('fov').addEventListener('input', e => { SKY.fov = +e.target.value; $('fovV').textContent = SKY.fov + '°'; });
  $('mnL').addEventListener('click', () => { document.body.classList.toggle('showL'); document.body.classList.remove('showR'); $('mnL').classList.toggle('on'); $('mnR').classList.remove('on'); });
  $('mnR').addEventListener('click', () => { document.body.classList.toggle('showR'); document.body.classList.remove('showL'); $('mnR').classList.toggle('on'); $('mnL').classList.remove('on'); });
  $('btnFinder').addEventListener('click', openFinder); $('fWin').addEventListener('change', runFinder); $('fVis').addEventListener('change', runFinder);
  $('btnAbout').addEventListener('click', () => $('mAbout').classList.add('open'));
  document.querySelectorAll('.modal').forEach(m => { m.addEventListener('click', e => { if (e.target === m || e.target.hasAttribute('data-close')) m.classList.remove('open'); }); });
  $('btnCopy').addEventListener('click', async () => {
    writeHash(); const url = location.href;
    try { await navigator.clipboard.writeText(url); toast('Link copied — it restores place, time and view.'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Link copied.'); } catch (er) { toast('Copy failed — the address bar holds the link.'); } ta.remove(); }
  });
  $('btnTests').addEventListener('click', runSelfTestsUI);
}
function runSelfTestsUI() {
  const res = runTimeSelfTests();
  try { // astronomy spot checks
    const obs = mkObs(32.7767, -96.797, 131), t = timeOf(utcFromParts(2024, 4, 8, 18, 42, 37)), e = solarEclipseNow(t, obs);
    res.push({ name: 'Dallas 2024-04-08 18:42:37 UTC is total (obscuration ≥ 99.9%)', ok: e.obsc > 0.999, info: (e.obsc * 100).toFixed(3) + '%' });
    const g = globalSolarAfter(utcFromParts(2026, 7, 1)); res.push({ name: '2026-08-12 greatest eclipse ≈ 17:46 UTC', ok: Math.abs(g.peak - utcFromParts(2026, 8, 12, 17, 46)) < 120000, info: fmtUTC(g.peak) });
    const l = lunarAfter(utcFromParts(2025, 8, 1)); res.push({ name: '2025-09-07 total lunar eclipse found', ok: l.kind === 'total' && Math.abs(l.peak - utcFromParts(2025, 9, 7, 18, 12)) < 300000, info: fmtUTC(l.peak) });
  } catch (er) { res.push({ name: 'astronomy spot checks', ok: false, info: er.message }); }
  const bad = res.filter(r => !r.ok).length; $('testSum').textContent = bad ? `${bad} FAILED of ${res.length}` : `all ${res.length} passed`; $('testSum').className = 'note ' + (bad ? 'warn' : 'ok');
  $('testOut').innerHTML = res.map(r => `<div class="${r.ok ? 'p' : 'f'}">${r.ok ? '✔' : '✘'} ${esc(r.name)}${r.info ? ' — ' + esc(r.info) : ''}</div>`).join(''); window.__selfTest = res; console.log('[self-test]', bad ? 'FAILED' : 'passed', res);
  return res;
}
window.__runSelfTests = () => runSelfTestsUI();

// ===== URL hash =====
function writeHash() {
  const L = S.loc, q = new URLSearchParams();
  q.set('loc', `${L.lat.toFixed(4)},${L.lon.toFixed(4)},${Math.round(L.elev || 0)}`); q.set('name', L.name); q.set('tz', tz());
  if (!S.live) q.set('t', new Date(S.t).toISOString().replace(/\.\d+Z$/, 'Z'));
  q.set('view', S.view); if (S.trueScale) q.set('scale', '1'); if (HX.on) q.set('hx', '1'); if (S.view === 'galaxy') { q.set('gt', GV.gt.toFixed(1)); if (GV.drift) q.set('helix', '1'); }
  if (S.view === 'sky') { q.set('az', SKY.az.toFixed(1)); q.set('alt', SKY.alt.toFixed(1)); q.set('fov', SKY.fov.toFixed(1)); }
  else q.set('cam', [CAM.yaw.toFixed(3), CAM.pitch.toFixed(3), CAM.dist.toPrecision(4), CAM.focus].join(','));
  history.replaceState(null, '', '#' + q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%2F/g, '/'));
}
function scheduleHash() { clearTimeout(U.hashT); U.hashT = setTimeout(writeHash, 500); }
function readHash() {
  if (!location.hash || location.hash.length < 3) return null;
  const q = new URLSearchParams(location.hash.slice(1)), o = {};
  const loc = (q.get('loc') || '').split(',').map(Number); if (loc.length >= 2 && isFinite(loc[0]) && isFinite(loc[1])) o.loc = { lat: loc[0], lon: loc[1], elev: loc[2] || 0, name: q.get('name') || `${loc[0]}°, ${loc[1]}°`, tz: q.get('tz') || null };
  if (q.get('t')) { const p = parseISO(q.get('t')); if (p) o.t = utcFromParts(p.y, p.mo, p.d, p.h, p.mi, p.s); }
  o.hx = q.get('hx') === '1'; o.view = q.get('view'); o.scale = q.get('scale') === '1'; if (q.get('gt')) { o.gt = +q.get('gt'); o.helix = q.get('helix') === '1'; }
  if (q.get('az')) { o.az = +q.get('az'); o.alt = +q.get('alt'); o.fov = +q.get('fov'); }
  if (q.get('cam')) { const c = q.get('cam').split(','); o.cam = { yaw: +c[0], pitch: +c[1], dist: +c[2], focus: c[3] }; }
  return o;
}

// ===== per-frame UI tick =====
function uiTimeChanged() { scheduleClouds(); U.lastClock = 0; U.lastPanel = 0; syncPicker(false); refreshWeather(); scheduleHash(); }
let prevPlayState = '';
function acc(o, k, v) { const e = o[k] || (o[k] = { s: 0, n: 0, max: 0 }); e.s += v; e.n++; if (v > e.max) e.max = v; }
function uiTick(now) {
  const hb = Math.floor(S.t / 3600000); if (hb !== U.cloudHr) { U.cloudHr = hb; scheduleClouds(); }
  if (now - U.lastClock > 90) {
    U.lastClock = now; const zone = tz();
    $('clkLocal').textContent = fmtLocal(S.t, zone); $('clkUTC').textContent = fmtUTC(S.t);
    const off = offsetMs(S.t, zone) / 60000; $('clkOff').textContent = fmtOffset(off) + (S.t < utcFromParts(1970, 1, 1) ? '*' : '');
    $('clkLocal').title = S.t < utcFromParts(1970, 1, 1) ? 'Local time per current IANA rules — may differ from the historical civil time.' : '';
    $('locNote').textContent = S.t < utcFromParts(1970, 1, 1) ? '* Local time per current IANA rules; may differ from the historical civil time at that date.' : '';
    $('badge').className = 'badge ' + (S.live ? 'live' : 'tt'); $('badge').textContent = S.live ? 'LIVE' : (S.playing ? 'TIME TRAVEL ▶' : 'TIME TRAVEL');
    const b = $('banner'); b.style.display = S.live ? 'none' : 'flex'; $('bannerTxt').textContent = `${fmtNice(S.t, zone)} ${zone.split('/').pop().replace(/_/g, ' ')} · ${fmtUTC(S.t)} UTC`;
    const rs = rangeStatus(S.t), rw = $('rangeWarn'); rw.style.display = rs === 'reduced' ? 'block' : 'none';
    if (rs === 'reduced') rw.textContent = `Reduced accuracy: ${S.t < RANGE.accMin ? 'before 1700' : 'after 2200'} CE the ephemeris drifts (arcminutes → degrees); eclipse timing is approximate.`;
    $('btnNow').classList.toggle('on', S.live);
    if (document.activeElement && !['tmDate', 'tmTime', 'tmISO'].includes(document.activeElement.id)) syncPicker(false); else if (!document.activeElement || document.activeElement === document.body) syncPicker(false);
    if (S.playing) syncPicker(false);
  }
  const panelGap = S.playing && S.speed >= 3600 ? 350 : 250;
  if (now - U.lastPanel > panelGap && ST) {
    U.lastPanel = now;
    try {
      const obs = obsNow(), time = ST.time; let q0 = performance.now(); const sm = renderSunMoon(time, obs); let q1 = performance.now();
      renderPlanets(time, obs, sm.sun.alt); let q2 = performance.now(); renderEclipses(); let q3 = performance.now();
      const P = (window.__parts = window.__parts || {}); acc(P, 'sunmoon', q1 - q0); acc(P, 'planets', q2 - q1); acc(P, 'eclipses', q3 - q2);
      const slowKey = partsInZone(S.t, tz()).d + '|' + S.loc.lat + S.loc.lon;
      if (U.slowKey !== slowKey) { q0 = performance.now(); U.lastSlow = now; U.slowKey = slowKey; U.up = upTonight(S.t, obs, tz()); acc(P, 'up', performance.now() - q0); }
      q0 = performance.now(); renderObserving(sm.sun.alt, sm.moon, U.up); acc(P, 'obs', performance.now() - q0);
      if (S.selected) renderInfo(S.selected);
      if ($('cloudNote').textContent !== CLOUD.status) $('cloudNote').textContent = CLOUD.status;
      if (S.view === 'sky') renderSkyInfo();
      if (S.view === 'galaxy') renderGalInfo();
      if (HX.on) hxNote();
      if (S.live && now - (U.wxLive || 0) > 600000) { U.wxLive = now; U.wxKey = ''; refreshWeather(true); }
    } catch (e) { console.error('panel update', e); }
  }
  const d0 = performance.now(); drawTimeline(); tlEnsure(); const PP = (window.__parts = window.__parts || {}); acc(PP, 'tl', performance.now() - d0);
  if (S.view === 'sky') { if (now - (U.skyT || 0) > 150) { U.skyT = now; renderSkyInfo(); } }
  if (S.view === 'galaxy' && now - (U.galT || 0) > 90) { U.galT = now; renderGalInfo(); }
  if (now - (U.hashPoll || 0) > 1500) { U.hashPoll = now; if (S.view === 'sky' || ptrs.size) scheduleHash(); }
  window.__fps = FPS;
}
function renderSkyInfo() {
  const i = SKY.info; if (!i.sunDir) return;
  let a = '', b = '';
  if (i.obsc > 0.0005 && i.sunAlt > -1) {
    const total = i.obsc > 0.9995; a = total ? '● Total solar eclipse' : (i.rm < i.rs && i.obsc > 0.9 ? 'Annular solar eclipse' : `Solar eclipse — ${(i.obsc * 100).toFixed(1)}% covered`);
    b = `Magnitude ${i.mag.toFixed(4)} · Sun ${i.sunAlt.toFixed(1)}° above horizon · sky brightness ${(i.L * 100).toFixed(0)}%`;
  } else if (i.lunar && i.lunar.behind && i.lunar.penMag > 0 && i.moonAlt > -1) {
    a = i.lunar.umbMag >= 1 ? '● Total lunar eclipse' : i.lunar.umbMag > 0 ? `Partial lunar eclipse — umbral mag ${i.lunar.umbMag.toFixed(3)}` : 'Penumbral lunar eclipse'; b = `Moon ${i.moonAlt.toFixed(1)}° above horizon · umbral ${i.lunar.umbMag.toFixed(3)} · penumbral ${i.lunar.penMag.toFixed(3)}`;
  } else {
    a = i.sunAlt > 0 ? 'Daytime sky' : i.sunAlt > -6 ? 'Civil twilight' : i.sunAlt > -12 ? 'Nautical twilight' : i.sunAlt > -18 ? 'Astronomical twilight' : 'Night sky';
    b = `${S.loc.name} · Sun ${sgn(i.sunAlt)} · Moon ${sgn(i.moonAlt)} · limiting magnitude ≈ ${Math.min(6.5, Math.max(-4, i.lim)).toFixed(1)}`;
  }
  $('skyA').textContent = a; $('skyB').textContent = b;
}

// ===== galaxy view controls =====
function syncGalUI() {
  $('gPlay').textContent = GV.playing ? '⏸' : '▶'; $('gPlay').classList.toggle('on', GV.playing); $('gRev').classList.toggle('on', GV.speed < 0);
  $('gDrift').classList.toggle('on', GV.drift); $('gFollow').classList.toggle('on', GV.follow); $('gVexv').textContent = GV.vex; $('gDsv').textContent = Math.round(GV.dscale * 100) + '%'; $('gDs').value = Math.round(GV.dscale * 100); $('gVex').value = GV.vex;
  $('gSpd').value = String(Math.abs(GV.speed)); if (document.activeElement !== $('gT')) $('gT').value = GV.gt;
  $('gTv').textContent = Math.abs(GV.gt) < 0.05 ? 'now' : (GV.gt > 0 ? '+' : '−') + Math.abs(GV.gt).toFixed(0) + ' Myr';
}
function renderGalInfo() {
  const s = GV.sun; if (!s) return; syncGalUI(); drawArmStrip();
  const dir = s.y >= 0 ? 'above' : 'below', gt = GV.gt, era = gt > -66 ? 'Cenozoic Era (the age of mammals)' : gt > -252 ? 'Mesozoic Era (dinosaurs)' : gt > -541 ? 'Paleozoic Era' : 'Precambrian';
  $('galA').textContent = gt === 0 ? 'Our place in the Milky Way — right now' : `The Sun ${gt < 0 ? Math.abs(gt).toFixed(0) + ' million years ago' : gt.toFixed(0) + ' million years from now'}`;
  $('galB').innerHTML = `${(s.R * LY_PER_KPC).toLocaleString('en-US', { maximumFractionDigits: 0 })} light-years (${s.R.toFixed(2)} kpc) from the Galactic Centre · moving <b>${s.speed.toFixed(0)} km/s</b> · radial speed ${s.vR >= 0 ? '+' : '−'}${Math.abs(s.vR).toFixed(0)} km/s<br>`
    + `<b>${Math.abs(s.y * 1000).toFixed(0)} pc ${dir}</b> the galactic plane (oscillates ±85 pc every ≈70 Myr — drawn ×${GV.vex}) · ${era}<br>`
    + `${(() => { const n = nearestArm(gt, GV.omega); return n.inside ? `<b>Inside the ${ARMS[n.arm].name}</b> (model, Ωp ${GV.omega})` : `Between arms — nearest: ${ARMS[n.arm].name}, ${Math.abs(n.dist).toFixed(1)} kpc away (model, Ωp ${GV.omega})`; })()}<br>`
    + `One galactic year ≈ 223 Myr · the Sun has circled ≈ 20 times in 4.6 Gyr · this view: ${(gt / 223.5 >= 0 ? '+' : '−')}${Math.abs(gt / 223.5).toFixed(2)} galactic years`
    + (GV.drift ? `<br><span style="color:#9cffd0">The whole Galaxy also drifts ≈ ${galDrift.speed.toFixed(0)} km/s toward l ${galDrift.l.toFixed(0)}°, b ${galDrift.b.toFixed(0)}° (Great Attractor) — so the Sun’s path is a helix ≈ ${(Math.hypot(...galDrift.v) * 223.5).toFixed(0)} kpc long per turn (drawn at ${(GV.dscale * 100).toFixed(0)}% of real drift speed so the coils are visible).</span>` : '');
}
function helixYaw() { const D = galDrift.v, c = [D[1] * 0 - D[2] * 1, 0, D[0] * 1 - 0]; /* d x up */ return Math.atan2(c[0], c[2]); }
function hxNote() { if ($('hxNote') && HX.u) $('hxNote').textContent = hxPitchNote(); }
function wire_helix() {
  $('hxSpan').addEventListener('input', e => { HX.span = +e.target.value; $('hxSpanV').textContent = HX.span + ' y'; hxNote(); });
  $('hxK').addEventListener('input', e => { HX.K = +e.target.value; $('hxKV').textContent = HX.K; hxNote(); });
  $('hxGal').addEventListener('click', () => { setHelix(false, { noFly: true }); setView('galaxy'); });
  $('hxOff').addEventListener('click', () => setHelix(false, { noFly: true }));
}
const ARM_COL = ['#7cc4ff', '#ffd27a', '#ff8fa8', '#a6f0a0'];
function drawArmStrip() {
  const cv = $('gArms'); if (!cv || !GV.ready) return;
  if (GV.crossOmega !== GV.omega) { GV.cross = armCrossings(GV.omega); GV.crossOmega = GV.omega; }
  const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = 38; if (!w) return; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const X = t => (t + GT_MAX) / (2 * GT_MAX) * w;
  g.font = '9px ui-monospace,Consolas,monospace'; g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 14, w, 10);
  for (const s of GV.cross) { g.fillStyle = ARM_COL[s.arm]; g.fillRect(X(s.t0), 12, Math.max(2, X(s.t1) - X(s.t0)), 14); }
  for (const m of MASS_EXT) { g.fillStyle = '#ff6b6b'; g.fillRect(X(-m[0]) - 0.5, 4, 1.5, 8); }
  g.fillStyle = '#7d89a3'; for (const t of [-600, -400, -200, 0, 200, 400, 600]) { g.fillRect(X(t), 28, 1, 4); g.fillText((t > 0 ? '+' : t < 0 ? '\u2212' : '') + Math.abs(t), X(t) + 3, 37); }
  g.fillStyle = '#ff6b6b'; g.fillText('mass extinctions', 4, 9);
  g.strokeStyle = '#ffb454'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(GV.gt), 0); g.lineTo(X(GV.gt), h); g.stroke();
}
function wire_galaxy() {
  $('gScales').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { galScaleTo(b.dataset.s); $('gScales').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }));
  $('gArt').addEventListener('click', () => { GV.art = !GV.art; $('gArt').classList.toggle('on', GV.art); });
  $('gOmega').addEventListener('change', e => { GV.omega = +e.target.value; drawArmStrip(); });
  $('gArms').addEventListener('click', e => { const r = e.target.getBoundingClientRect(); GV.gt = ((e.clientX - r.left) / r.width * 2 - 1) * GT_MAX; GV.playing = false; syncGalUI(); });
  $('gArms').addEventListener('mousemove', e => {
    const r = e.target.getBoundingClientRect(), t = ((e.clientX - r.left) / r.width * 2 - 1) * GT_MAX; let txt = (t < 0 ? Math.abs(t).toFixed(0) + ' Myr ago' : '+' + t.toFixed(0) + ' Myr');
    const s = (GV.cross || []).find(q => t >= q.t0 && t <= q.t1); if (s) txt += ` · inside the ${ARMS[s.arm].name} (${Math.round(s.t0)}…${Math.round(s.t1)})`;
    const me = MASS_EXT.find(m => Math.abs(-m[0] - t) < 6); if (me) txt += ` · ${me[1]} extinction`; e.target.title = txt;
  });
  $('gPlay').addEventListener('click', () => { GV.playing = !GV.playing; syncGalUI(); });
  $('gRev').addEventListener('click', () => { GV.speed = -GV.speed; if (!GV.playing) GV.playing = true; syncGalUI(); });
  $('gSpd').addEventListener('change', e => { GV.speed = (GV.speed < 0 ? -1 : 1) * +e.target.value; });
  $('gT').addEventListener('input', e => { GV.gt = +e.target.value; syncGalUI(); });
  $('gNow').addEventListener('click', () => { GV.gt = 0; GV.playing = false; syncGalUI(); });
  $('gDrift').addEventListener('click', () => { GV.drift = !GV.drift; syncGalUI(); galFly({ yaw: GV.drift ? helixYaw() : GV.yaw, pitch: GV.drift ? 0.4 : 0.95, dist: GV.drift ? 150 : 38, tx: 0, ty: 0, tz: 0, dur: 1800 }); if (GV.drift && !GV.playing) { GV.playing = true; GV.speed = Math.abs(GV.speed) || 20; syncGalUI(); } });
  $('gFollow').addEventListener('click', () => { GV.follow = !GV.follow; syncGalUI(); if (GV.follow) { const sp = galSunPos(GV.gt); galFly({ yaw: GV.yaw, pitch: GV.pitch, dist: 3, tx: sp.x, ty: sp.y, tz: sp.z, dur: 1800 }); } else galFly({ yaw: GV.yaw, pitch: 0.95, dist: 38, tx: 0, ty: 0, tz: 0, dur: 1800 }); });
  $('gDs').addEventListener('input', e => { GV.dscale = +e.target.value / 100; syncGalUI(); });
  $('gVex').addEventListener('input', e => { GV.vex = +e.target.value; syncGalUI(); });
  $('gTop').addEventListener('click', () => galFly({ yaw: GV.yaw, pitch: 1.5, dist: GV.dist, tx: GV.follow ? GV.tx : 0, ty: GV.follow ? GV.ty : 0, tz: GV.follow ? GV.tz : 0, dur: 1200 }));
  $('gEdge').addEventListener('click', () => galFly({ yaw: GV.yaw, pitch: 0.04, dist: GV.drift ? 135 : Math.min(GV.dist, 30), tx: GV.follow ? GV.tx : 0, ty: GV.follow ? GV.ty : 0, tz: GV.follow ? GV.tz : 0, dur: 1200 }));
}

// ===== keyboard =====
function wire_keys() {
  addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); togglePlay(); }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); const s = k === 'ArrowLeft' ? -1 : 1; e.shiftKey ? stepTime('1mo', s) : stepTime('1d', s); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); const s = k === 'ArrowDown' ? -1 : 1; e.shiftKey ? stepTime('1y', s) : stepTime('1h', s); }
    else if (k === 'n' || k === 'N') goLive();
    else if (k === 'r' || k === 'R') $('btnRev').click();
    else if (k === '1') setView('system'); else if (k === '2') setView('earthmoon'); else if (k === '3') setView('planet'); else if (k === '4') setView('sky', { reaim: true }); else if (k === '5') setView('galaxy');
    else if (k === 'Escape') { document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')); tourCancel(); }
  });
}

// ===== boot =====
async function bootUI() {
  const tb = $('timebar'), setTop = () => document.documentElement.style.setProperty('--top', Math.round(tb.getBoundingClientRect().bottom) + 'px');
  new ResizeObserver(setTop).observe(tb); setTop();
  const dk = $('dock'), setDock = () => document.documentElement.style.setProperty('--dock', Math.round(dk.getBoundingClientRect().height) + 'px'); new ResizeObserver(setDock).observe(dk); setDock();
  wire_galaxy(); wire_helix(); wire_picker(); wire_events(); wire_search(); wire_toggles(); wire_timeline(); wire_keys();
  syncPlayUI();
}
