// ===================== 55_guide.js — live narration, "what to try" tips, real-time tooltips, optional read-aloud =====================
const GD = { key: '', html: '', tipsHtml: '', voice: false, last: 0, spoken: '', spokeAt: 0, speakT: 0 };
const fmtBig = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const speedLabel = () => { if (S.view === 'galaxy') return `${Math.abs(GV.speed)} million years per second`; const s = SPEEDS.find(x => x[1] === S.speed); return s ? s[0] : `${S.speed}×`; };
const lightTime = km => { const s = km / 299792.458; return s < 90 ? `${s.toFixed(1)} s` : s < 5400 ? `${(s / 60).toFixed(1)} min` : s < 172800 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400 / 365.25).toFixed(1)} years`; };
function moonNow() { const t = ST.time, ph = A.MoonPhase(t), il = A.Illumination(A.Body.Moon, t); return { name: moonPhaseName(ph), pct: il.phase_fraction * 100, deg: ph }; }
function nearestEclipse() { const E = U.ecl; if (!E) return null; const c = [E.solarPrev, E.solarNext, E.lunarPrev, E.lunarNext].filter(Boolean).sort((a, b) => Math.abs(a.peak - S.t) - Math.abs(b.peak - S.t)); return c[0] || null; }
function earthSpeedKms() { const r = v3.len(ST.pos.Earth); return Math.sqrt(1.32712440018e11 * (2 / r - 1 / 149598023)); }
function scaleOfGalaxy() { if (GV.merge) return 'merge'; const d = GV.dist; return d < 0.014 ? 'sun' : d < 3.5 ? 'near' : d < 75 ? 'mw' : d < 450 ? 'sat' : d < 7350 ? 'lg' : d < 9.8e4 ? 'hub' : 'lan'; }
const eraName = gt => gt > -66 ? 'the Cenozoic (age of mammals)' : gt > -252 ? 'the Mesozoic (age of dinosaurs)' : gt > -541 ? 'the Paleozoic' : 'the Precambrian';

function guideModel() {
  const v = S.view, when = fmtNice(S.t, tz()), tips = [], P = [], dateHtml = `<span class="num">${when}</span>`;
  const play = (txt) => ({ i: S.playing || (v === 'galaxy' && GV.playing) ? '⏸' : '▶', t: txt, a: () => $('btnPlay').click() });
  let title = 'Guide', key = v;
  if (v === 'system' || v === 'planet' || v === 'earthmoon') {
    const earthAU = v3.len(ST.pos.Earth) / AU_KM, mo = moonNow(), moonKm = v3.len(v3.sub(ST.pos.Moon, ST.pos.Earth));
    if (LIFE.on && v === 'system') {
      const s = LIFE.st || lifeState(LIFE.u), lost = LIFE_PLANETS.filter(p => LIFE.u >= LIFE.engulf[p[0]]).map(p => p[0]), a = id => (LIFE_PLANETS.find(p => p[0] === id)[1] / s.M);
      title = 'Life of the Sun · ' + s.phase[2]; key += s.phase[2].slice(0, 6) + lost.length;
      P.push(`<p><span class="num">${lifeFmtT(s.t)}</span> — ${s.phase[3]}</p>`);
      P.push(`<p>Now the Sun shines at <b>${s.L >= 10 ? Math.round(s.L).toLocaleString('en-US') : s.L.toFixed(2)}</b> times today’s luminosity, is <b>${s.R >= 10 ? Math.round(s.R) : s.R >= 0.1 ? s.R.toFixed(2) : s.R.toFixed(3)}</b> solar radii wide and <b>${Math.round(s.T).toLocaleString('en-US')} K</b> at the surface (${s.T > 9000 ? 'blue-white' : s.T > 5200 ? 'yellow-white' : s.T > 3900 ? 'orange' : 'red'}), with ${s.M.toFixed(2)} of its present mass.</p>`);
      if (s.t < -0.01) P.push('<p>A young Sun is ~30 % fainter than today (the “faint young Sun”), yet early Earth stayed warm thanks to a thicker greenhouse atmosphere.</p>');
      else if (s.t < 0.9) P.push('<p>The Sun is about halfway through its hydrogen-burning life — 4.57 billion years old, with ~5.4 billion to go on the main sequence. It brightens by ≈ 1 % every 100 million years.</p>');
      else if (s.t < 5.4) P.push(`<p>The green ring is the <b>habitable zone</b> (${s.hzIn.toFixed(2)}–${s.hzOut.toFixed(2)} AU). As the Sun brightens, its inner edge sweeps outward past Earth’s orbit about <b>1.1 billion years from now</b>: oceans evaporate (a “moist greenhouse”) and Earth turns <span style="color:#ff8a5a">hot</span>. Complex life on Earth would be long gone by +1.5 Gyr.</p>`);
      else if (s.t < 7.59) P.push(`<p>As the envelope swells, Mercury and Venus are swallowed${lost.length > 2 ? ', and Earth is probably dragged in by tidal forces' : ''}. The planets’ orbits widen as the Sun loses mass (Earth’s would reach ${a('Earth').toFixed(2)} AU), but the swollen Sun (up to ${Math.round(256 * R_SUN_AU * 100) / 100} AU) reaches out to meet them.</p>`);
      else if (s.t < 7.8) P.push('<p>Helium burning, then a final fierce phase of thermal pulses blows the outer layers into space. The Sun ends up as a dense core about 54 % of its present mass.</p>');
      else P.push(`<p>An Earth-sized stellar ember (about ${(s.R * 109.2).toFixed(1)}× Earth’s width), fainter than a thousandth of today’s Sun. Mars-to-Neptune orbits have widened to ${a('Mars').toFixed(1)}–${a('Neptune').toFixed(0)} AU; Jupiter and beyond survive. The white dwarf cools for trillions of years toward a black dwarf.</p>`);
      P.push('<p class="note" style="color:#8b97ae">Schematic view: distances use a square-root scale and planets are enlarged. Luminosity, size and mass follow published models (Sackmann+ 1993; Schröder &amp; Smith 2008). Earth’s exact fate is still debated.</p>');
      tips.push(play('Press play to run the Sun’s life; slow phases (red giant to white dwarf) are stretched so you can watch them.'));
      tips.push({ i: '📅', t: 'Drag the strip below to jump anywhere — or tap a milestone chip.' });
      tips.push({ i: '✥', t: 'Drag to orbit, scroll to zoom in on the star, ✥ Move or WASD to pan.' });
      tips.push({ i: '✕', t: 'Back to today’s Solar System.', a: () => setLife(false) });
    } else if (v === 'earthmoon' || (v === 'planet' && S.selected === 'Moon')) {
      const lat = A.EclipticGeoMoon(ST.time).lat, near = Math.abs(lat) < 1.6;
      title = v === 'earthmoon' ? 'Earth and the Moon, to scale' : 'The Moon'; key += (near ? 'n' : '');
      P.push(`<p>${dateHtml}. The Moon is <b>${fmtBig(moonKm)} km</b> away (light takes <b>${lightTime(moonKm)}</b>) — about 30 Earth-widths. It is <b>${mo.name}</b>, ${mo.pct.toFixed(0)}% lit, because the Sun's light falls on it from the direction shown by the shading.</p>`);
      P.push(`<p>The Moon's orbit is tilted 5° to Earth's, so it is currently <b>${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'north' : 'south'}</b> of the Sun–Earth line plane. ${near ? 'That is close enough to the plane for an <b>eclipse alignment</b> at new or full Moon — watch the shadow cones.' : 'Too far off the plane for an eclipse this month: the Moon passes above or below Earth\'s shadow.'}</p>`);
      tips.push({ i: '🌑', t: 'Jump to the next eclipse so you can watch the shadow cross the Earth', a: () => { $('evSel').value = 'solar-any'; jumpEvent(1); } });
      tips.push({ i: '🔍', t: 'Scroll or pinch to zoom into Earth or the Moon; drag to rotate.' });
    } else if (v === 'planet') {
      const id = S.selected && BODY[S.selected] ? S.selected : 'Jupiter', d = BODY[id], dS = v3.len(ST.pos[id]), dE = id === 'Earth' ? 0 : v3.len(v3.sub(ST.pos[id], ST.pos.Earth));
      title = id; key += id;
      P.push(`<p><b>${id}</b> — ${d.info.dia} across, ${d.info.mass}. A day lasts <b>${d.info.day}</b> and its year is <b>${d.info.year}</b>. On ${dateHtml} it is <b>${(dS / AU_KM).toFixed(2)} AU</b> from the Sun${id === 'Earth' ? '' : ` and <b>${fmtKm(dE)}</b> from Earth — light needs <b>${lightTime(dE)}</b> to reach us`}.</p>`);
      const mn = MOONS_OF[id] || []; if (mn.length) P.push(`<p>Its ${mn.length > 4 ? 'largest ' : ''}moons shown: <b>${mn.join(', ')}</b>. They move on the orbits drawn around it; click one to follow it.</p>`);
      if (id === 'Saturn') P.push('<p>The rings are tilted toward the Sun and cast a real shadow on the globe; the globe shadows the rings on the far side.</p>');
      if (id === 'Jupiter') P.push('<p>Watch the four Galilean moons — shadows of Io, Europa, Ganymede and Callisto can cross Jupiter\'s face, and the moons slip into Jupiter\'s shadow.</p>');
      if (id === 'Earth') P.push(`<p>The orange ring marks <b>${S.loc.name}</b>; the globe is turned to the true sidereal angle for this moment, so the day/night line is exactly where it is in reality.</p>`);
      tips.push({ i: '🔭', t: 'Pick another world: click any planet or moon in the scene, or a row in the Planets table.' });
      tips.push(play(`Press play: time runs at ${speedLabel()} — watch ${mn.length ? 'its moons orbit' : 'it turn'}.`));
    } else {
      title = HX.on ? 'The Solar System — moving through the Galaxy' : 'The Solar System from above'; key += (HX.on ? 'h' : '') + (S.cmp ? 'c' : '') + (S.trueScale ? 't' : '');
      const planets = (U.up && U.up.rows) ? U.up.rows.filter(r => r.naked).map(r => r.id) : [];
      if (S.cmp) P.push('<p><b>Left:</b> the textbook picture — the Sun stands still and the planets circle it in a flat plane. <b>Right:</b> the real motion — the whole system races along at <b>' + HX.speedKms.toFixed(0) + ' km/s</b>, so each orbit is stretched into a corkscrew.</p>');
      if (HX.on) {
        const km = HX.speedKms * 3.15576e7 * HX.span;
        P.push(`<p>Every coloured spiral is a <b>real planet path</b> through space. The Sun travels <b>${HX.speedKms.toFixed(0)} km/s</b> around the Milky Way (${HX.auPerYr.toFixed(0)} AU every year), toward Cygnus. In the ${HX.span} years drawn, the system moved <b>${(km / 1e9).toFixed(0)} billion km</b>. Earth (bright blue) makes one turn per year; Jupiter\'s coil takes 12 years; Neptune has barely begun its first.</p>`);
        P.push(`<p>${hxPitchNote()}</p>`);
        tips.push({ i: '⇄', t: 'Compare the flat picture with the real motion, side by side.', a: () => $('hxCmp').click() });
        tips.push({ i: '✺', t: 'Zoom out ×10 billion: see this helix as a tiny part of the Sun\'s orbit around the Galaxy.', a: () => $('hxGal').click() });
        tips.push({ i: '⚙', t: 'Options ▸ Helix: change the span and stretch of the corkscrews.', a: () => $('btnOpt').click() });
      } else {
        P.push(`<p>${dateHtml}. You are looking down on the plane of Earth\'s orbit. <b>Earth</b> is <b>${earthAU.toFixed(3)} AU</b> from the Sun (${earthAU > 1 ? 'a little beyond' : 'a little inside'} its 1.000 AU average) and moving at <b>${earthSpeedKms().toFixed(1)} km/s</b>. The Moon is <b>${mo.name}</b> (${mo.pct.toFixed(0)}% lit).</p>`);
        if (planets.length) P.push(`<p>From <b>${S.loc.name}</b> tonight the naked-eye planets above the horizon are <b>${planets.join(', ')}</b>.</p>`);
        P.push('<p>Planet sizes are enlarged so you can see them (switch on <b>True scale</b> in Options to see how empty space really is). The Moon\'s orbit opens out as you fly in.</p>');
        const ev = nearestEclipse(); if (ev) P.push(`<p>Nearest eclipse: a <b>${ev.kind} ${ev.type}</b> eclipse ${fmtRel(ev.peak, S.t)}.</p>`);
        tips.push({ i: '〰', t: 'Turn on the Helix chip (Options): see the planets corkscrew as the Sun carries them through the Galaxy.', a: () => setHelix(true) });
      }
      tips.push(play(`Press play — time runs at ${speedLabel()} from ${fmtNice(S.t, tz())}.`));
      tips.push({ i: '👆', t: 'Click a planet to learn about it; double-click to fly there. Drag to rotate, scroll or pinch to zoom.' });
      if (!HX.on) tips.push({ i: '🌌', t: 'Tap Galaxy (bottom bar) to leave the Solar System and see where we sit in the Milky Way.', a: () => setView('galaxy') });
      if (!HX.on) tips.push({ i: '☀', t: 'Watch the Sun’s whole life — from birth to white dwarf — and what happens to the planets.', a: () => setLife(true) });
    }
  } else if (v === 'sky') {
    const i = SKY.info; if (!i.sunDir) return { key: 'sky0', title: 'The sky from here', paras: ['<p>Looking up from <b>' + esc(S.loc.name) + '</b>…</p>'], tips: [] };
    const mo = moonNow(), vis = Object.keys(i).filter(k => i[k] && i[k].vis && i[k].alt > 5 && ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].includes(k));
    title = 'The sky over ' + S.loc.name.split(',')[0]; key += (i.obsc > 0.0005 ? 'e' : '') + (i.sunAlt > 0 ? 'd' : i.sunAlt > -12 ? 't' : 'n');
    const phase = i.sunAlt > 0 ? 'daytime' : i.sunAlt > -6 ? 'civil twilight' : i.sunAlt > -12 ? 'nautical twilight' : i.sunAlt > -18 ? 'astronomical twilight' : 'full night';
    P.push(`<p>${dateHtml} at <b>${esc(S.loc.name)}</b> — <b>${phase}</b>: the Sun is <span class="num">${i.sunAlt.toFixed(0)}°</span> ${i.sunAlt >= 0 ? 'above' : 'below'} the horizon, and the faintest stars you could see are about magnitude <b>${Math.min(6.5, Math.max(-4, i.lim)).toFixed(1)}</b>.</p>`);
    P.push(`<p>The Moon is <b>${mo.name}</b> (${mo.pct.toFixed(0)}% lit) and ${i.moonAlt > 0 ? `<b>${i.moonAlt.toFixed(0)}° high</b>` : '<b>below the horizon</b>'}.${vis.length ? ` Planets in the sky: <b>${vis.join(', ')}</b>.` : ''}</p>`);
    if (i.obsc > 0.0005 && i.sunAlt > -1) P.push(`<p><b>A solar eclipse is happening here:</b> the Moon covers <b>${(i.obsc * 100).toFixed(1)}%</b> of the Sun${i.obsc > 0.9995 ? ' — <b>totality</b>: the corona is visible and the sky has darkened to twilight' : ''}.</p>`);
    else if (i.lunar && i.lunar.behind && i.lunar.penMag > 0 && i.moonAlt > -1) P.push(`<p><b>A lunar eclipse is under way:</b> the Moon is inside Earth\'s ${i.lunar.umbMag > 0 ? 'dark umbra' : 'faint penumbra'}${i.lunar.umbMag >= 1 ? ' — totality, and the red glow is sunlight bent through Earth\'s atmosphere' : ''}.</p>`);
    tips.push({ i: '☀', t: 'Tap ☀ Sun or ☾ Moon (above the bar) to point the view at it.', a: () => document.querySelector('[data-aim="' + (i.sunAlt > -3 ? 'sun' : 'moon') + '"]').click() });
    tips.push({ i: '🌙', t: 'Scrub the timeline (or press play) to watch the night pass; stars wheel around the pole.' });
    tips.push({ i: '🌑', t: 'Jump to the next eclipse visible here.', a: () => { $('evSel').value = 'solar-here'; jumpEvent(1); } });
    tips.push({ i: '🔎', t: 'Pinch or scroll to zoom the field of view; drag to look around. Constellations: Options ▸ Show.' });
  } else if (v === 'galaxy') {
    const sc = scaleOfGalaxy(), s = GV.sun || sunAt(GV.gt), gt = GV.gt; key += sc + (GV.drift ? 'd' : '');
    const era = eraName(gt), n = nearestArm(gt, GV.omega);
    if (S.cmp) {
      title = 'Flat orbit vs the real helix'; key += 'cmp';
      P.push(`<p><b>Left:</b> the textbook picture — the Galaxy stands still and the Sun just circles it in a closed loop. <b>Right:</b> the real motion — the whole Galaxy also drifts ≈ <b>${galDrift.speed.toFixed(0)} km/s</b> through the Universe (toward the Great Attractor), so the Sun’s path never closes: it winds forward like a corkscrew.</p>`);
      tips.push(play('Press play to watch the Sun trace each path.')); tips.push({ i: '↔', t: 'Drag the divider to compare more of either side.' }); tips.push({ i: '✕', t: 'End the comparison.', a: () => $('gCmp').click() });
    } else if (sc === 'merge') {
      title = 'The Milky Way – Andromeda collision'; key += (MG.ready ? mgPhase().slice(0, 12) : 'build');
      if (!MG.ready) P.push('<p>Running the simulation: 8,000 stars and two dark-matter haloes for 10 billion years…</p>');
      else {
        const i = MG.info, e = MG.ev, f = MG.final, am = MG.atMerge, tG = GV.mt / 1000, sepLy = i.sep * LY_PER_KPC;
        P.push(`<p><span class="num">${GV.mt < 50 ? 'Today' : '+' + tG.toFixed(2) + ' billion years'}</span> — ${esc(i.phase)}. The two centres are ${sepLy < 6000 ? '<b>on top of each other</b>' : '<b>' + fmtBig(sepLy / 1000, 0) + ' thousand light-years</b> apart'}${GV.mt < 50 ? ' (Andromeda is really 2.5 million light-years away; this scene is drawn at 1 : 1, centred on the pair)' : ''}.</p>`);
        if (GV.mt < e.first - 80) P.push('<p>Andromeda is falling toward us at <b>~110 km/s</b>. Gravity — mostly from the dark-matter haloes that reach out ~100 kpc around each galaxy — is slowly pulling both discs toward a head-on encounter about <b>4 billion years</b> from now.</p>');
        else if (GV.mt < e.second - 300) P.push(`<p>The first close pass came ${(e.first / 1000).toFixed(1)} billion years from now, at ~${fmtBig(e.firstR, 0)} kpc. Tidal forces fling stars into <b>long tails</b> and a <b>bridge</b>; gas piles up and sets off bursts of star formation (not drawn). Dynamical friction slows the galaxies, so they fall back.</p>`);
        else if (GV.mt < e.merged + 400) P.push('<p>On the second approach the cores plunge through each other again and sink together. Stars almost never collide — they are light-years apart — so the galaxies pass through each other like two swarms of bees.</p>');
        else if (f) P.push(`<p>The result is one smooth, reddish <b>elliptical galaxy</b> some call <b>Milkomeda</b>. Final state in this model: half the stars lie within <b>${fmtBig(f.rHalf * LY_PER_KPC / 1000, 0)} thousand light-years</b> of the centre, shape ≈ ${f.ba.toFixed(2)} : ${f.ca.toFixed(2)} (axis ratios) — ${f.ca > 0.75 ? 'nearly spherical' : 'a rounded, slightly flattened spheroid'}. The discs are gone; star formation has stopped, so it fades to orange.</p>`);
        P.push(`<p>The <span style="color:#ffe9a8">yellow ring</span> is our Sun (a test star started on its present orbit): it now sits <b>${fmtBig(i.sunDist * LY_PER_KPC / 1000, 0)} thousand light-years</b> from the middle. The planets are not disturbed — the Sun will probably be flung to the outskirts, not destroyed. By then the Sun itself is dying: <b>see “Sun’s life”</b>.</p>`);
        P.push('<p class="note" style="color:#8b97ae">Illustrative physics: a restricted simulation (stars are test particles in two moving dark haloes with dynamical friction), tuned to published timelines — first pass ≈ 4 Gyr, second ≈ 6 Gyr, merged ≈ 6.5–7 Gyr (Cox &amp; Loeb 2008; van der Marel et al. 2012). Gas, M33 and the true halo masses are not modelled.</p>');
      }
      tips.push(play(`Press play: ${Math.abs(GV.speed)} million years pass every second. Reverse (⏪) runs the collision backwards.`));
      if (MG.ready) { tips.push({ i: '💥', t: 'Jump to the first close pass.', a: () => $('mgFirst').click() }); tips.push({ i: '🏁', t: 'Jump to the final state (10 billion years from now).', a: () => $('mgFinal').click() }); }
      tips.push({ i: '✥', t: 'Drag to orbit, scroll to zoom, ✥ Move (or right-drag / WASD) to pan. Switch off Auto-frame to take the camera yourself.' });
      tips.push({ i: '☀', t: 'See how the Sun’s own life ends about when this happens.', a: () => { setView('system', { noFly: true }); setLife(true); } });
    } else if (GV.drift && (sc === 'mw' || sc === 'sat')) {
      title = 'The Sun\'s true path: a helix through space';
      P.push(`<p>The Sun circles the Galaxy's centre — but the whole Galaxy is itself drifting ~<b>${galDrift.speed.toFixed(0)} km/s</b> toward the Great Attractor. Add the two motions and the Sun's path stops being a closed ring: it winds forward like a <b>corkscrew</b>, bobbing up and down through the disc as it goes. The glowing beads are the Sun's recent past and near future.</p>`);
      P.push(`<p>For clarity the drift is drawn at <b>${(GV.dscale * 100).toFixed(0)}%</b> of its real speed so the coils are visible (Options ▸ Galaxy ▸ Drift speed). The planets' own, much tighter corkscrews are what you saw behind the Sun at the smallest scale.</p>`);
      tips.push(play(`Press play to watch the Sun trace the helix (${Math.abs(GV.speed)} Myr per second).`));
      tips.push({ i: '↔', t: 'Edge-on view: the coils rise and fall through the thin disc.', a: () => $('gEdge').click() });
      tips.push({ i: '✕', t: 'Switch off “Helix through space” to return to the flat orbit.', a: () => $('gDrift').click() });
    } else if (sc === 'sun') { title = 'Zooming into the Sun'; P.push('<p>Falling toward the Sun… the Solar System is about <b>10 billion times</b> smaller than the Milky Way. Next you will see the planets\' helix.</p>'); }
    else if (sc === 'near') {
      title = 'Our stellar neighbourhood'; const nn = FAR.nearLabels.length;
      P.push(`<p>Each dot is a <b>real star</b> from ESA\'s Gaia mission, at its measured 3-D position (<b>${fmtBig(GAIA.n)}</b> shown — a 1-in-12 sample of the bright stars within 1,000 pc). Colours are the stars\' true colours. The Sun is at the centre; rings mark 10, 50 and 250 parsecs (33, 163 and 815 light-years).</p>`);
      P.push('<p>The blue shell is the <b>Local Bubble</b>, a ~100 pc cavity of hot, thin gas blown out by supernovae. Nearby you can find the Hyades, Pleiades, Sco–Cen and the Orion Nebula. Everything here travels with the Sun around the Galaxy at ~220 km/s.</p>');
      tips.push({ i: '🔎', t: 'Zoom in: the nearest named stars (Alpha Centauri, Sirius…) appear with distances in light-years.' });
    } else if (sc === 'mw') {
      title = gt === 0 ? 'Our place in the Milky Way' : `The Sun ${Math.abs(gt).toFixed(0)} million years ${gt < 0 ? 'ago' : 'from now'}`;
      P.push(`<p>This is our Galaxy — <b>100,000 light-years</b> across but only about <b>1,000 thick</b> (try <b>Edge-on</b>). The Sun (yellow ring) is <b>${fmtBig(s.R * LY_PER_KPC)} light-years</b> from the centre, circling at <b>${s.speed.toFixed(0)} km/s</b>. One lap takes ~<b>223 million years</b>. On Earth this is ${era}.</p>`);
      P.push(`<p>${n.inside ? `The Sun is currently <b>inside the ${ARMS[n.arm].name}</b> (model).` : `The Sun is between spiral arms; the nearest is the <b>${ARMS[n.arm].name}</b>, ${Math.abs(n.dist).toFixed(1)} kpc away (model).`} It also bobs up and down through the disc every ~70 million years — now <b>${Math.abs(s.y * 1000).toFixed(0)} pc ${s.y >= 0 ? 'above' : 'below'}</b> the mid-plane.</p>`);
      if (GV.drift) P.push(`<p>With <b>Helix through space</b> on, the Galaxy itself is moving ~${galDrift.speed.toFixed(0)} km/s toward the Great Attractor, so the Sun\'s path becomes a true helix.</p>`);
      tips.push({ i: '↔', t: 'Options ▸ Galaxy ▸ Edge-on: see the thin disc, the central bulge and the warp.', a: () => $('gEdge').click() });
      tips.push(play(`Press play — the Sun laps the Galaxy; at ${Math.abs(GV.speed)} Myr/s one lap takes ${(223.5 / Math.abs(GV.speed)).toFixed(0)} seconds.`));
      tips.push({ i: '📅', t: 'Drag the bottom strip to scrub ±650 million years; coloured bars show when the Sun crosses a spiral arm.' });
    } else if (sc === 'sat') {
      title = 'The Milky Way\'s neighbours';
      P.push('<p>The faint companions orbiting our Galaxy: the <b>Large</b> and <b>Small Magellanic Clouds</b> (160,000 and 200,000 light-years away), the stretched <b>Sagittarius dwarf</b> being torn apart, and tiny dwarf spheroidals like Draco, Sculptor and Fornax. Each is drawn as a 3-D cloud tilted at its measured inclination — the LMC is a barred disc seen almost face-on; the SMC is elongated along our line of sight.</p>');
      tips.push({ i: '🖱', t: 'Rotate the view: these are 3-D objects, not pictures.' });
    } else if (sc === 'lg') {
      const m = FAR.items.find(i => i.o.vr), dM = m ? m.pos.length() : 780;
      title = 'The Local Group';
      P.push(`<p><b>Andromeda (M31)</b> is ~<b>${fmtBig(dM * 3261.56 / 1000, 2)} million light-years</b> away and rushing toward us at <b>110 km/s</b>; in about 4–5 billion years the two spirals will begin to merge. M31 is tilted 77.5° to our line of sight, so from here it looks edge-on-ish; <b>Triangulum (M33)</b> is the third big spiral. Dozens of dwarfs orbit these giants.</p>`);
      tips.push({ i: '↻', t: 'Orbit the view: M31\'s thin disc and our Milky Way are drawn in 3-D with their true tilts.' });
    } else if (sc === 'hub') {
      title = 'Famous galaxies around us';
      P.push('<p>Purple labels mark galaxies you know from <b>Hubble Space Telescope</b> pictures, each placed from its catalogue direction and distance: the <b>Whirlpool</b> (M51, 28 million light-years), the <b>Sombrero</b> (M104, 31 Mly), <b>NGC 4414</b> (58 Mly), the barred spiral <b>NGC 1300</b> (61 Mly) and the colliding <b>Antennae</b> (72 Mly).</p>');
      P.push('<p>All of them lie inside our home supercluster. Our own Milky Way is the glowing point on the near side. Positions are real; the glows are markers, not photographs.</p>');
      tips.push({ i: '↻', t: 'Drag to orbit: the galaxies are scattered in every direction, not in a plane.' });
    } else {
      title = 'Laniakea — our home supercluster';
      P.push(`<p>Laniakea (Hawaiian for “immense heaven”) is a region ~<b>${LANIAKEA_INFO.diameterMpc} Mpc (520 million light-years)</b> across holding ~100,000 galaxies. Everything inside flows toward the <b>Great Attractor</b> (the Norma cluster region, ~220 million light-years away): the blue streamlines. The Local Group moves ~<b>${LANIAKEA_INFO.lgVelKms} km/s</b> that way relative to the cosmic microwave background. This view is schematic — cluster positions are catalogue values; filaments are illustrative.</p>`);
      tips.push({ i: '🔵', t: 'The Shapley Concentration and Coma lie outside Laniakea, in neighbouring flows.' });
    }
    if (sc !== 'sun') tips.push({ i: '◎', t: 'Use the scale bar: Planets ▸ Stars ▸ Milky Way ▸ Neighbours ▸ Local Group ▸ Laniakea.', a: () => galScaleTo(sc === 'mw' ? 'sat' : 'mw') });
    tips.push({ i: '🌍', t: 'Tap System (bottom bar) to return to the Solar System.', a: () => setView('system') });
  }
  return { key, title, paras: P, tips };
}
function plainText(h) { return h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); }
function guideRender(force) {
  if (!ST) return;
  const body = document.body, on = body.classList.contains('guide');
  if (!on && !GD.voice && !force) return;
  let m; try { m = guideModel(); } catch (e) { console.warn('guide', e); return; }
  const html = m.paras.join(''), tipsKey = m.tips.map(t => t.i + t.t).join('|');
  if (m.title !== GD.title) { $('gdTitle').textContent = m.title; GD.title = m.title; }
  if (html !== GD.html) { $('gdText').innerHTML = html; GD.html = html; }
  if (tipsKey !== GD.tipsHtml) {
    GD.tipsHtml = tipsKey; GD.tipActs = m.tips.map(t => t.a || null);
    $('gdTips').innerHTML = '<h5>Try this</h5>' + m.tips.map((t, i) => `<button class="${t.a ? '' : 'passive'}" data-i="${i}"><i>${t.i}</i><span>${esc(t.t)}</span></button>`).join('');
  }
  document.documentElement.style.setProperty('--gdh', (on ? $('guide').offsetHeight + 8 : 0) + 'px');
  if (m.key !== GD.key) { GD.key = m.key; if (GD.voice) { clearTimeout(GD.speakT); GD.speakT = setTimeout(() => speakGuide(m), 900); } }
}
function speakGuide(m) {
  if (!GD.voice || !('speechSynthesis' in window)) return;
  const txt = plainText([m.title, ...m.paras.slice(0, 2)].join('. ')).slice(0, 700);
  if (txt === GD.spoken) return; GD.spoken = txt;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.rate = 1.0; u.pitch = 1; speechSynthesis.speak(u); } catch (e) { }
}
function speakText(txt) { if (!GD.voice || !('speechSynthesis' in window)) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.rate = 1.0; speechSynthesis.speak(u); } catch (e) { } }
function setVoice(on) {
  GD.voice = !!on && 'speechSynthesis' in window; if (on && !GD.voice) toast('This browser has no speech synthesis.');
  try { localStorage.setItem('ca.voice', GD.voice ? '1' : '0'); } catch (e) { }
  $('gdVoice').classList.toggle('on', GD.voice); $('mmVoiceState').textContent = GD.voice ? 'on' : 'off';
  if (GD.voice) { GD.key = ''; GD.spoken = ''; guideRender(true); } else { try { speechSynthesis.cancel(); } catch (e) { } }
}
function setGuide(show, min) {
  document.body.classList.toggle('guide', !!show); if (min != null) document.body.classList.toggle('min', !!min);
  $('btnGuide').setAttribute('aria-pressed', !!show); $('gdMin').textContent = document.body.classList.contains('min') ? '▴' : '▾';
  try { localStorage.setItem('ca.guide', show ? (document.body.classList.contains('min') ? 'min' : '1') : '0'); } catch (e) { }
  guideRender(true);
}

// ---------- tooltips with live values ----------
const TG_DESC = {
  helix: ['Helix', 'Planets (and the Moon) corkscrew behind the Sun as it carries the Solar System through the Galaxy.'],
  bloom: ['Bloom', 'Soft glow around the brightest objects. Switches itself off if your device struggles.'],
  orbits: ['Orbits', 'Orbit lines for planets and moons.'], trails: ['Trails', 'Each planet\'s path over a span of years either side of now.'],
  labels: ['Labels', 'Names beside bodies, stars and galaxies.'], moons: ['Moons', 'Show or hide the moons.'],
  constellations: ['Constellations', 'Constellation lines and names (space and sky views).'], trueScale: ['True scale', 'Real sizes and distances: 1 scene unit = 1,000 km. Planets shrink to specks — space is mostly empty.'],
  shadows: ['Shadow cones', 'Umbra/penumbra cones of the Moon and Earth (visible at true scale).'], clouds: ['Clouds', 'The cloud layer on Earth.'], liveClouds: ['Live clouds', 'Drape real cloud cover for the picked hour (Open-Meteo) over the globe.'],
};
function tipFor(key, el) {
  const v = S.view, d = (t, dd, live) => ({ t, d: dd, live });
  const on = x => x ? 'ON' : 'OFF';
  if (key.startsWith('tg:')) { const k = key.slice(3), x = TG_DESC[k] || [k, ''], st = k === 'helix' ? HX.on : k === 'trueScale' ? S.trueScale : S.tg[k]; return d(x[0], x[1], `Now: ${on(st)}${k === 'liveClouds' ? ' · ' + CLOUD.status : ''}`); }
  switch (key) {
    case 'home': return d('Celestial Atlas', 'Return to the Solar System overview.', `Currently: ${v}`);
    case 'placeMenu': return d('Set your place', 'Use your device location or type exact latitude and longitude.', `Now: ${S.loc.name} (${S.loc.lat.toFixed(2)}°, ${S.loc.lon.toFixed(2)}°)`);
    case 'clock': return d('Time travel', 'Open the date, time, event-jump and famous-moments controls. Every view is a function of this one moment.', `${fmtLocal(S.t, tz())} ${tz().split('/').pop().replace(/_/g, ' ')} · UTC ${fmtUTC(S.t)} · ${S.live ? 'LIVE' : 'time travel'}`);
    case 'guide': return d('Live guide', 'Shows a plain-English description of what is on screen right now, with things to try.', `Now: ${document.body.classList.contains('guide') ? 'showing' : 'hidden'}`);
    case 'menu': return d('Menu', 'Time travel, side panels, eclipse finder, share link, read-aloud and credits.');
    case 'voice': return d('Read aloud', 'Speaks the narration whenever the topic changes, using your browser\'s voice.', `Now: ${on(GD.voice)}`);
    case 'gdMin': return d('Collapse the guide', 'Shrink the guide to its title.');
    case 'timeline': return v === 'galaxy'
      ? d('Galactic time strip', 'Drag to move ±650 million years. Coloured bars: the Sun inside a spiral arm (model). Red ticks: mass extinctions.', `${GV.gt === 0 ? 'now' : (GV.gt < 0 ? Math.abs(GV.gt).toFixed(0) + ' Myr ago' : '+' + GV.gt.toFixed(0) + ' Myr')} · ${TL.galHover || 'hover for arm info'}`)
      : d('Timeline', 'Drag to scrub through time, scroll to zoom from a day to 500 years. Dots: eclipses (amber = solar, ringed = lunar), Moon phases, equinoxes and solstices.', `${fmtNice(S.t, tz())} · span ${fmtDur(TL.span)} · click a dot to jump`);
    case 'play': return v === 'galaxy' ? d(GV.playing ? 'Pause' : 'Play', 'Run galactic time: the Sun laps the Milky Way.', `Speed ${Math.abs(GV.speed)} Myr/s · galactic time ${GV.gt.toFixed(0)} Myr`) : d(S.playing ? 'Pause' : 'Play', S.live ? 'Freezes the live clock; then plays from here.' : 'Runs time forward from the picked moment.', `${speedLabel()} · ${fmtNice(S.t, tz())}`);
    case 'rev': return d('Run backward', 'Reverses the direction of time.', `Direction: ${(v === 'galaxy' ? GV.speed < 0 : S.dir < 0) ? 'backward' : 'forward'}`);
    case 'speed': return d('Playback speed', v === 'galaxy' ? 'Million years of galactic time per real second.' : 'How much simulated time passes per real second. Above 1 day/s the Earth stops spinning visibly.', `Now: ${speedLabel()}`);
    case 'now': return d(v === 'galaxy' ? 'Back to now' : 'Return to live', v === 'galaxy' ? 'Reset galactic time to the present.' : 'Jump back to the real clock.', v === 'galaxy' ? `Galactic time ${GV.gt.toFixed(0)} Myr` : `Showing ${S.live ? 'the live moment' : fmtRel(S.t, Date.now()).replace('in ', '+ ')}`);
    case 'opt': return d('Options', 'Toggles for this view: orbits, labels, true scale, bloom, helix and more.');
    case 'tour': return d('Cinematic tour', 'A guided flight from the Solar System, through the helix, out to the Milky Way and beyond.');
    case 'v-system': return d('Solar System', 'The planets from above, with moons and the Sun\'s helix option.', v === 'system' ? 'You are here' : '');
    case 'v-earthmoon': return d('Earth–Moon', 'Earth and the Moon at true scale, with eclipse shadow cones.', v === 'earthmoon' ? 'You are here' : `Moon is ${fmtBig(v3.len(v3.sub(ST.pos.Moon, ST.pos.Earth)))} km away`);
    case 'v-planet': return d('Planet focus', 'Fly to the selected body and see its moons.', `Selected: ${S.selected || '—'}`);
    case 'v-sky': return d('Sky from here', 'The real sky above your place at this moment: Sun, Moon, planets, stars, eclipses.', SKY.info.sunAlt != null ? `Sun ${SKY.info.sunAlt.toFixed(0)}° · Moon ${SKY.info.moonAlt.toFixed(0)}°` : S.loc.name);
    case 'v-galaxy': return d('Galaxy', 'Leave the Solar System: the Milky Way, the Sun\'s orbit, neighbours, the Local Group and Laniakea.', GV.sun ? `Sun is ${(GV.sun.R * LY_PER_KPC / 1000).toFixed(1)}k ly from the centre` : '');
    case 'aimSun': return d('Aim at the Sun', 'Points the sky view at the Sun and zooms in for eclipses.', SKY.info.sunAlt != null ? `Sun is ${SKY.info.sunAlt.toFixed(0)}° ${SKY.info.sunAlt >= 0 ? 'high' : 'below the horizon'}${SKY.info.obsc > 0 ? ` · ${(SKY.info.obsc * 100).toFixed(0)}% eclipsed` : ''}` : '');
    case 'aimMoon': return d('Aim at the Moon', 'Points the sky view at the Moon.', SKY.info.moonAlt != null ? `Moon is ${SKY.info.moonAlt.toFixed(0)}° ${SKY.info.moonAlt >= 0 ? 'high' : 'below the horizon'}` : '');
    case 'mgAuto': return d('Auto-frame', 'Keeps both galaxies (and their tails) in view as they move. Turn it off to fly the camera yourself.', `Now: ${on(MG.auto)}`);
    case 'pan': return d('Move mode', 'When on, one-finger / left-button drag pans the camera across space instead of rotating it. Always available: right-drag, Shift-drag, two-finger drag, or W A S D.', `Now: ${on(document.body.classList.contains('panmode'))}`);
    case 'recenter': return d('Recenter', 'Fly back to the default centre for this view.');
    case 'life': return d('Sun’s life', 'Watch the Sun’s whole life: birth, today, red giant, planetary nebula, white dwarf — with the planets’ orbits.');
    case 'lifeExit': return d('Back to the planets', 'Leave the life-cycle view and return to today’s Solar System.');
    case 'cmpDiv': return d('Divider', 'Drag left or right to compare more of either side.');
    case 'sc-merge': return d('Collision', 'Andromeda and the Milky Way fall together and merge into one elliptical galaxy over the next ~7 billion years.', MG.ready ? `Now: +${(GV.mt / 1000).toFixed(2)} Gyr` : '');
    case 'hxCmp': return d('Compare', 'Split the screen: the textbook flat view (left) and the real moving system (right).', `Now: ${on(S.cmp)}`);
    case 'hxGal': return d('Zoom out to the Galaxy', 'See this helix as a tiny piece of the Sun\'s orbit around the Milky Way.');
    case 'gArt': return d('NASA artist\'s concept', 'Paints NASA/JPL\'s illustration under the model stars. It fades out edge-on, where the real 3-D shape shows.', `Now: ${on(GV.art)}`);
    case 'gGaia': return d('Gaia stars', 'Real stars from ESA\'s Gaia mission around the Sun, visible when zoomed in.', `Now: ${on(GV.gaia)} · ${fmtBig(GAIA.n)} stars`);
    case 'gDrift': return d('Helix through space', 'Adds the Galaxy\'s own 560 km/s motion so the Sun\'s path winds into a helix.', `Now: ${on(GV.drift)}`);
    case 'gFollow': return d('Follow the Sun', 'Keeps the camera on the Sun as time runs.', `Now: ${on(GV.follow)}`);
    case 'gTop': return d('Top view', 'Look straight down on the Galactic plane.');
    case 'gEdge': return d('Edge-on view', 'See the Milky Way from the side: a thin disc, a bulging core and a warp.');
    default:
      if (key.startsWith('sc-')) { const m = { sun: ['Planets', 'Zoom all the way into the Sun and the planets\' helix.'], near: ['Stars', 'Real Gaia stars around the Sun, the Local Bubble and the nearest named stars.'], mw: ['Milky Way', 'The whole Galaxy with the Sun\'s orbit.'], sat: ['Neighbours', 'The Magellanic Clouds and dwarf galaxies, drawn in 3-D.'], lg: ['Local Group', 'Andromeda, Triangulum and friends.'], hub: ['Famous galaxies', 'Showpieces from Hubble pictures — Whirlpool, Sombrero, NGC 4414, NGC 1300, the Antennae — at their real distances.'], lan: ['Laniakea', 'Our home supercluster and the flow to the Great Attractor.'] }[key.slice(3)]; return d(m[0], m[1], v === 'galaxy' ? `Camera distance ${GV.dist < 1 ? (GV.dist * 3261.56).toFixed(0) + ' ly' : GV.dist < 1000 ? fmtBig(GV.dist * 3.26156, 1) + ' kly' : fmtBig(GV.dist * 3.26156 / 1000, 1) + ' Mly'}` : ''); }
      return d(key, '');
  }
}
function initTips() {
  const tt = $('tt'); let cur = null, showT = 0, hideT = 0, lp = 0;
  const render = () => { if (!cur) return; const x = tipFor(cur.dataset.tip, cur); tt.innerHTML = `<b>${esc(x.t)}</b>${x.d ? '<br>' + esc(x.d) : ''}${x.live ? `<span class="live">${esc(x.live)}</span>` : ''}`; };
  const place = () => { const r = cur.getBoundingClientRect(), w = tt.offsetWidth, h = tt.offsetHeight; let x = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)), y = r.top > innerHeight * 0.45 ? r.top - h - 8 : r.bottom + 8; tt.style.left = x + 'px'; tt.style.top = Math.max(8, y) + 'px'; };
  const show = el => { cur = el; tt.style.display = 'block'; render(); place(); };
  const hide = () => { clearTimeout(showT); clearTimeout(hideT); cur = null; tt.style.display = 'none'; };
  document.addEventListener('mouseover', e => { if (e.pointerType === 'touch') return; const el = e.target.closest('[data-tip]'); if (!el) { if (cur) hide(); return; } if (el === cur) return; clearTimeout(showT); showT = setTimeout(() => show(el), 350); });
  document.addEventListener('mouseout', e => { const el = e.target.closest('[data-tip]'); if (el && !el.contains(e.relatedTarget)) hide(); });
  document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { hide(); return; } const el = e.target.closest('[data-tip]'); clearTimeout(lp); if (el) lp = setTimeout(() => { show(el); clearTimeout(hideT); hideT = setTimeout(hide, 5000); }, 520); });
  document.addEventListener('pointerup', () => clearTimeout(lp)); document.addEventListener('pointercancel', () => clearTimeout(lp));
  setInterval(() => { if (cur) { render(); place(); } }, 500);
}
function wire_guide() {
  let g = '1'; try { g = localStorage.getItem('ca.guide'); } catch (e) { }
  const mobile = innerWidth < 900; if (g == null) g = mobile ? 'min' : '1';
  document.body.classList.toggle('guide', g !== '0'); document.body.classList.toggle('min', g === 'min' || (g == null && mobile));
  $('btnGuide').setAttribute('aria-pressed', g !== '0'); $('gdMin').textContent = document.body.classList.contains('min') ? '▴' : '▾';
  $('btnGuide').addEventListener('click', () => setGuide(!document.body.classList.contains('guide'), false));
  $('gdMin').addEventListener('click', () => { const m = !document.body.classList.contains('min'); setGuide(true, m); });
  $('gdVoice').addEventListener('click', () => setVoice(!GD.voice)); $('mmVoice').addEventListener('click', () => { setVoice(!GD.voice); closePops(); });
  $('gdTips').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; const a = GD.tipActs[+b.dataset.i]; if (a) { try { a(); } catch (er) { console.warn(er); } } });
  let v = '0'; try { v = localStorage.getItem('ca.voice'); } catch (e) { } GD.voice = false; $('mmVoiceState').textContent = 'off';
  document.querySelectorAll('.chipset button[data-tg]').forEach(() => { }); initTips();
  setInterval(() => guideRender(false), 600);
}
