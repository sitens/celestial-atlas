// ===================== 70_boot.js — startup =====================
(async function boot() {
  try {
    buildBodies(); buildBackground(); initPost(); await bootUI();
    const h = readHash(); let loc = null;
    try { loc = JSON.parse(localStorage.getItem('ca.loc') || 'null'); } catch (e) { }
    if (h && h.loc) loc = h.loc;
    if (!loc || loc.lat == null) loc = defaultLocation();
    S.loc = Object.assign({ elev: 0, name: 'Location' }, loc);
    if (!S.loc.tz) { const r = await resolveTz(S.loc.lat, S.loc.lon); S.loc.tz = r.tz; }
    uiLocationChanged();
    if (h && h.t != null && rangeStatus(h.t) !== 'invalid') { S.live = false; S.t = h.t; syncPlayUI(); uiTimeChanged(); }
    if (h && h.scale) setScale(true);
    resize();
    let introFly = true;
    if (h && h.cam) { CAM.yaw = h.cam.yaw; CAM.pitch = h.cam.pitch; CAM.dist = h.cam.dist; if (BODY[h.cam.focus]) CAM.focus = h.cam.focus; introFly = false; }
    if (h && (h.view === 'earthmoon' || h.view === 'planet')) { S.view = h.view; markView(); introFly = false; }
    if (h && h.view === 'galaxy') { if (h.gt != null) GV.gt = h.gt; GV.drift = !!h.helix; enterGalaxy({ intro: false }); GV.dist = GV.drift ? 150 : 38; GV.pitch = GV.drift ? 0.4 : 0.95; if (GV.drift) GV.yaw = helixYaw(); syncGalUI(); introFly = false; }
    if (h && h.view === 'sky') { SKY.aimed = true; if (h.az != null) { SKY.az = h.az; SKY.alt = h.alt; SKY.fov = h.fov; syncFov(); } else SKY.needAim = true; S.view = 'sky'; markView(); introFly = false; }
    if (h && h.hx) { setHelix(true, { noFly: !!h.cam, noPlay: true }); introFly = false; }
    startRender();
    window.__booted = true;
    window.__app = { S, CAM, SKY, OB, TL, U, ST: () => ST, setTime, setView, setLocation, setScale, selectBody, focusBody, flyTo, goLive, setSpeed, togglePlay, stepTime, jumpEvent, applyPreset, runSelfTestsUI, computeState, A, v3, THREE, renderer, scene, camera, skyCam, aimSky, applyWall, syncPicker, ORB, findEvent, get skyDome() { return skyDome; }, azAltToDir, dirToAzAlt, buildSky, skyScene, POST, CLOUD, ECL_LIST, STARS, starDirAt, rVis, flyToLocation, GV, HX, FAR, galScaleTo, bridgeToSolar, setHelix, hxBuild, SPREAD, spreadFactor, moonSystem, sunAt, sunOrbit, galaxyDrift, enterGalaxy, buildMilkyWay, runTour, tourCancel };
    setTimeout(() => { const l = $('loading'); l.style.opacity = 0; setTimeout(() => l.remove(), 900); }, 500);
    if (introFly) setTimeout(() => { if (S.view === 'system' && !ptrs.size) flyToLocation(); }, 1700);
  } catch (e) {
    console.error(e); window.__bootError = String(e && e.stack || e);
    const l = $('loading'); if (l) l.innerHTML = `<div style="max-width:560px;padding:20px;text-align:center"><b>Could not start</b><p style="color:#8b97ae">${esc(e.message || e)}</p><p style="color:#8b97ae">This app needs WebGL2 and an internet connection for its two libraries (three.js, Astronomy Engine) from jsDelivr.</p></div>`;
  }
})();
