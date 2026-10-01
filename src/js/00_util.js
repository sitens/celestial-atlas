// ===================== 00_util.js — time / zone / formatting (no DOM, no THREE) =====================
const MS_DAY = 86400000;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const AU_KM = 149597870.7;
const DEG = Math.PI / 180;

function utcFromParts(y, mo, d, h = 0, mi = 0, s = 0, ms = 0) {
  const dt = new Date(0);
  dt.setUTCFullYear(y, mo - 1, d);
  dt.setUTCHours(h, mi, s, ms);
  return dt.getTime();
}
// Accuracy windows: Astronomy Engine is good to ~arcminute for 1700-2200.
const RANGE = {
  validMin: utcFromParts(1000, 1, 1),
  validMax: utcFromParts(3000, 12, 31, 23, 59, 59),
  accMin: utcFromParts(1700, 1, 1),
  accMax: utcFromParts(2200, 12, 31, 23, 59, 59),
};
function rangeStatus(ms) {
  if (!(ms >= RANGE.validMin && ms <= RANGE.validMax)) return 'invalid';
  if (ms < RANGE.accMin || ms > RANGE.accMax) return 'reduced';
  return 'ok';
}
function clampTime(ms) { return Math.min(RANGE.validMax, Math.max(RANGE.validMin, ms)); }

const _dtf = {};
function getDTF(tz) {
  const k = tz || 'UTC';
  if (!_dtf[k]) {
    try {
      _dtf[k] = new Intl.DateTimeFormat('en-US', {
        timeZone: k, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch (e) { return getDTF('UTC'); }
  }
  return _dtf[k];
}
function partsInZone(ms, tz) {
  const o = {};
  for (const p of getDTF(tz).formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second };
}
// offset (ms) of zone from UTC at instant ms (local = utc + offset)
function offsetMs(ms, tz) {
  const p = partsInZone(ms, tz);
  const asUTC = utcFromParts(p.y, p.mo, p.d, p.h, p.mi, p.s);
  return asUTC - Math.floor(ms / 1000) * 1000;
}
// local wall-clock -> UTC ms. gap=true when the wall time does not exist (DST spring-forward) and was shifted.
function localToUTC(y, mo, d, h, mi, s, tz) {
  const asUTC = utcFromParts(y, mo, d, h, mi, s);
  const o1 = offsetMs(asUTC - MS_DAY, tz), o2 = offsetMs(asUTC + MS_DAY, tz);
  const cands = [...new Set([asUTC - o1, asUTC - o2])];
  const ok = cands.filter(c => {
    const p = partsInZone(c, tz);
    return p.y === y && p.mo === mo && p.d === d && p.h === h && p.mi === mi && p.s === s;
  }).sort((a, b) => a - b);
  if (ok.length) return { ms: ok[0], gap: false, fold: ok.length > 1 };
  return { ms: asUTC - o1, gap: true, fold: false };
}
const pad = (n, w = 2) => String(Math.abs(Math.trunc(n))).padStart(w, '0');
function fmtOffset(min) {
  const sg = min < 0 ? '−' : '+', a = Math.abs(min);
  return `UTC${sg}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
function fmtDateParts(p) { return `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.d)}`; }
function fmtTimeParts(p) { return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`; }
function fmtLocal(ms, tz) { const p = partsInZone(ms, tz); return `${fmtDateParts(p)} ${fmtTimeParts(p)}`; }
function fmtUTC(ms) { const p = partsInZone(ms, 'UTC'); return `${fmtDateParts(p)} ${fmtTimeParts(p)}`; }
function fmtShort(ms, tz) { const p = partsInZone(ms, tz); return `${pad(p.h)}:${pad(p.mi)}`; }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtNice(ms, tz) { const p = partsInZone(ms, tz); return `${p.d} ${MONTHS[p.mo - 1]} ${p.y} ${pad(p.h)}:${pad(p.mi)}`; }
function fmtDur(ms) {
  const a = Math.abs(ms), s = a / 1000;
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  if (a < 2 * MS_DAY) return `${(s / 3600).toFixed(1)} h`;
  if (a < 90 * MS_DAY) return `${Math.round(a / MS_DAY)} d`;
  return `${(a / MS_DAY / 365.2425).toFixed(1)} y`;
}
function fmtRel(ms, nowMs) { const d = ms - nowMs; return d >= 0 ? `in ${fmtDur(d)}` : `${fmtDur(d)} ago`; }
function parseISO(str) {
  // accepts 2024-04-08, 2024-04-08T18:42, 2024-04-08 18:42:10, optional Z -> UTC ms (NaN if bad); no tz => returned as 'wall' parts
  const m = /^\s*(-?\d{1,5})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(Z)?\s*$/i.exec(str || '');
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], h = +(m[4] || 0), mi = +(m[5] || 0), s = +(m[6] || 0);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const chk = new Date(0); chk.setUTCFullYear(y, mo - 1, d);
  if (chk.getUTCMonth() !== mo - 1) return null; // e.g. Feb 30
  return { y, mo, d, h, mi, s, z: !!m[7] };
}
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

// ---- self test: round-trip timestamps through the picker's local<->UTC conversion ----
function runTimeSelfTests() {
  const res = [];
  const T = (name, cond, info) => res.push({ name, ok: !!cond, info: info || '' });
  const rt = (y, mo, d, h, mi, s, tz) => {
    const r = localToUTC(y, mo, d, h, mi, s, tz); const p = partsInZone(r.ms, tz);
    return { r, p, same: p.y === y && p.mo === mo && p.d === d && p.h === h && p.mi === mi && p.s === s };
  };
  // leap years
  for (const y of [1600, 1900, 2000, 2024, 2100, 2400]) {
    T(`Feb 29 ${y} ${isLeap(y) ? 'exists' : 'rejected'}`, (parseISO(`${y}-02-29`) !== null) === isLeap(y));
  }
  { const a = rt(2024, 2, 29, 12, 0, 0, 'UTC'); T('Feb 29 2024 12:00 UTC round-trip', a.same); }
  { const a = rt(2024, 2, 29, 23, 59, 59, 'Asia/Tokyo'); T('Feb 29 2024 23:59:59 Tokyo round-trip', a.same); }
  { const a = utcFromParts(2024, 2, 29, 0, 0, 0), b = utcFromParts(2024, 3, 1, 0, 0, 0); T('Feb 29 -> Mar 1 is one day', b - a === MS_DAY); }
  // year rollover
  { const a = rt(1999, 12, 31, 23, 59, 59, 'America/New_York'); T('Year rollover NY', a.same); }
  { const a = utcFromParts(2025, 1, 1) - utcFromParts(2024, 12, 31); T('2024-12-31 -> 2025-01-01 is one day', a === MS_DAY); }
  // DST (US spring forward 2024-03-10 02:00->03:00 NY; fall back 2024-11-03 02:00->01:00)
  { const a = rt(2024, 3, 10, 1, 59, 59, 'America/New_York'); T('NY 01:59:59 before spring-forward', a.same && !a.r.gap); }
  { const a = localToUTC(2024, 3, 10, 2, 30, 0, 'America/New_York'); T('NY 02:30 on 2024-03-10 does not exist -> gap flagged', a.gap, fmtLocal(a.ms, 'America/New_York')); }
  { const a = rt(2024, 3, 10, 3, 0, 0, 'America/New_York'); T('NY 03:00 after spring-forward', a.same); }
  { const a = localToUTC(2024, 11, 3, 1, 30, 0, 'America/New_York'); T('NY 01:30 on 2024-11-03 is ambiguous -> fold flagged', a.fold && !a.gap); }
  { const a = rt(2024, 11, 3, 2, 30, 0, 'America/New_York'); T('NY 02:30 after fall-back', a.same); }
  { const a = rt(2024, 10, 27, 2, 30, 0, 'Europe/Madrid'); T('Madrid fold day', a.same || a.r.fold); }
  { const a = rt(2024, 10, 6, 2, 30, 0, 'Australia/Sydney'); T('Sydney DST start 2024-10-06 02:30 gap', a.r.gap || a.same); }
  // 30-minute-offset zone
  { const a = rt(2024, 6, 15, 12, 0, 0, 'Asia/Kolkata'); T('Kolkata +05:30 round-trip', a.same && offsetMs(a.r.ms, 'Asia/Kolkata') === 19800000); }
  // 1582 boundary (proleptic Gregorian everywhere)
  { const a = utcFromParts(1582, 10, 15), b = utcFromParts(1582, 10, 4); T('1582-10-04 -> 1582-10-15 is 11 days (proleptic Gregorian)', (a - b) / MS_DAY === 11); }
  { const a = rt(1582, 10, 10, 12, 0, 0, 'UTC'); T('1582-10-10 exists (proleptic) & round-trips', a.same); }
  { const p = partsInZone(utcFromParts(1582, 10, 10, 12), 'UTC'); T('Intl shows 1582-10-10 (no Julian jump)', p.y === 1582 && p.mo === 10 && p.d === 10); }
  // range edges
  T('Range: 1000-01-01 valid', rangeStatus(RANGE.validMin) !== 'invalid');
  T('Range: 999 invalid', rangeStatus(utcFromParts(999, 12, 31)) === 'invalid');
  T('Range: 3001 invalid', rangeStatus(utcFromParts(3001, 1, 1)) === 'invalid');
  T('Range: 1650 reduced', rangeStatus(utcFromParts(1650, 6, 1)) === 'reduced');
  T('Range: 2150 ok', rangeStatus(utcFromParts(2150, 6, 1)) === 'ok');
  T('Range: 2300 reduced', rangeStatus(utcFromParts(2300, 6, 1)) === 'reduced');
  // random round trips
  let bad = 0;
  for (let i = 0; i < 400; i++) {
    const ms = RANGE.accMin + Math.floor(Math.random() * (RANGE.accMax - RANGE.accMin));
    const tz = ['UTC', 'America/New_York', 'Europe/Madrid', 'Asia/Tokyo', 'Australia/Sydney', 'America/Sao_Paulo'][i % 6];
    const p = partsInZone(ms, tz); const r = localToUTC(p.y, p.mo, p.d, p.h, p.mi, p.s, tz);
    if (Math.abs(r.ms - Math.floor(ms / 1000) * 1000) > 0 && !r.fold) bad++;
  }
  T('400 random UTC->local->UTC round-trips (1700-2200, 6 zones)', bad === 0, `${bad} mismatches`);
  // ISO parsing
  T('parseISO 1969-07-20 20:17', (() => { const p = parseISO('1969-07-20 20:17'); return p && p.h === 20 && p.mi === 17; })());
  T('parseISO rejects 2023-02-29', parseISO('2023-02-29') === null);
  T('parseISO rejects garbage', parseISO('tomorrow') === null);
  return res;
}
