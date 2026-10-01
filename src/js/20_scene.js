// ===================== 20_scene.js — renderer, shaders, solar-system scene =====================
const $ = id => document.getElementById(id);
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000003, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 1e-4, 1e11);

// ---------- app state ----------
const S = {
  t: Date.now(), live: true, playing: false, dir: 1, speed: 1,
  loc: { lat: 40.4168, lon: -3.7038, elev: 650, name: 'Madrid, Spain', tz: 'Europe/Madrid' },
  view: 'system', trueScale: false,
  tg: { bloom: true, liveClouds: true, orbits: true, trails: false, labels: true, moons: true, constellations: false, shadows: true, clouds: true },
  trailSpan: 365, focus: 'Earth', selected: 'Earth', spinBlend: 1,
};

// ---------- textures ----------
const _tex = {};
function tex(key, srgb = true) {
  if (_tex[key]) return _tex[key];
  const t = new THREE.TextureLoader().load(TEX[key]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping;
  return (_tex[key] = t);
}
const _white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); _white.needsUpdate = true;

// ---------- shaders ----------
const VS_LIT = `
varying vec3 vN; varying vec2 vUv; varying vec3 vV; varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const FS_COMMON = `
precision highp float;
uniform sampler2D uMap, uNight, uSpec, uRing, uNormal, uCloudGrid;
uniform vec3 uColor, uSunDir, uCenter, uRingN, uTint;
uniform vec2 uRingRad;
uniform float uSunDist, uSunR, uBodyR, uVisR, uAmb, uHasTex, uAlphaMode, uNightMul, uCloudMix, uReliefK;
uniform vec4 uOcc[4];
varying vec3 vN; varying vec2 vUv; varying vec3 vV; varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_fragment>
float discOverlap(float a, float b, float d){
  if (d >= a + b) return 0.0;
  if (d <= abs(a - b)) return b >= a ? 1.0 : (b * b) / (a * a);
  float k1 = acos(clamp((d*d + a*a - b*b) / (2.0*d*a), -1.0, 1.0));
  float k2 = acos(clamp((d*d + b*b - a*a) / (2.0*d*b), -1.0, 1.0));
  float ar = a*a*k1 + b*b*k2 - 0.5*sqrt(max(0.0, (-d+a+b)*(d+a-b)*(d-a+b)*(d+a+b)));
  return clamp(ar / (3.14159265 * a * a), 0.0, 1.0);
}
float deepUmbra = 0.0;
float vhash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vhash(i), vhash(i + vec2(1.0, 0.0)), f.x), mix(vhash(i + vec2(0.0, 1.0)), vhash(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 reliefNormal(vec3 N, vec3 p, vec2 uv, vec3 tn){ // cotangent-frame bump from a tangent-space normal map
  vec3 dp1 = dFdx(p), dp2 = dFdy(p); vec2 duv1 = dFdx(uv), duv2 = dFdy(uv);
  if (abs(duv1.x) > 0.4 || abs(duv2.x) > 0.4) return N; // longitude seam
  vec3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x, B = dp2perp * duv1.y + dp1perp * duv2.y;
  float im = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-20));
  return normalize(mat3(T * im, B * im, N) * tn);
}
float sunVisible(vec3 P){
  vec3 S = uSunDir * uSunDist - P;
  float ds = length(S); vec3 s = S / ds;
  float a = asin(min(1.0, uSunR / ds));
  float vis = 1.0;
  for (int i = 0; i < 4; i++) {
    vec4 o = uOcc[i];
    if (o.w <= 0.0) continue;
    vec3 O = o.xyz - P; float dO = length(O);
    if (dO >= ds) continue;
    vec3 oo = O / dO;
    float b = asin(min(1.0, o.w / dO));
    float d = atan(length(cross(s, oo)), dot(s, oo));
    vis *= 1.0 - discOverlap(a, b, d);
    if (b > a) deepUmbra = max(deepUmbra, clamp((b - a - d) / (b - a), 0.0, 1.0));
  }
  return vis;
}`;
const FS_LIT = FS_COMMON + `
void main(){
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vN), V = normalize(vV), L = normalize(uSunDir);
  vec3 P = (vW - uCenter) / uVisR * uBodyR;
  vec3 alb = uHasTex > 0.5 ? texture2D(uMap, vUv).rgb : uColor;
  #ifdef SUN
    float nv = clamp(dot(N, V), 0.0, 1.0);
    vec3 c = alb * (0.55 + 0.9 * pow(nv, 0.45));
    c = c * vec3(1.18, 1.02, 0.78) * 1.35;
    gl_FragColor = vec4(c, 1.0);
  #else
    float vis = sunVisible(P);
    #ifdef RING_SHADOW
      float den = dot(L, uRingN);
      if (abs(den) > 1e-4) {
        float tt = -dot(P, uRingN) / den;
        if (tt > 0.0) {
          vec3 Q = P + L * tt; float r = length(Q);
          if (r > uRingRad.x && r < uRingRad.y) vis *= 1.0 - 0.9 * texture2D(uRing, vec2((r - uRingRad.x) / (uRingRad.y - uRingRad.x), 0.5)).a;
        }
      }
    #endif
    #ifdef HAS_NORMAL
      vec3 tn = texture2D(uNormal, vUv).xyz * 2.0 - 1.0; tn.xy *= uReliefK; tn = normalize(tn);
      vec3 Nr = reliefNormal(N, vW, vUv, tn);
    #else
      vec3 Nr = N;
    #endif
    float NL = dot(N, L), NLr = dot(Nr, L);
    #ifdef EARTH
      float day = smoothstep(-0.10, 0.22, NLr);
    #else
      float day = smoothstep(-0.02, 0.08, NLr) * (0.35 + 0.65 * clamp(NLr * 1.6, 0.0, 1.0));
    #endif
    vec3 col = alb * uTint * (day * vis * 1.35 + uAmb);
    #ifdef REDUMBRA
      float shade = 1.0 - vis;
      col += alb * vec3(0.52, 0.10, 0.02) * shade * mix(1.0, 0.16, deepUmbra) * smoothstep(-0.05, 0.2, NL) * 0.9;
    #endif
    #ifdef HAS_SPEC
      float sp = texture2D(uSpec, vUv).r;
      vec3 H = normalize(L + V);
      col += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, H), 0.0), 240.0) * sp * 0.13 * day * vis;
      col = mix(col, col * vec3(0.8, 0.92, 1.1), sp * 0.12 * day);
    #endif
    #ifdef HAS_NIGHT
      float nightF = 1.0 - smoothstep(-0.16, 0.06, NL);
      col += texture2D(uNight, vUv).rgb * nightF * uNightMul;
    #endif
    #ifdef CLOUDS
      float ca = texture2D(uMap, vUv).r;
      float cg = texture2D(uCloudGrid, vUv).r;
      vec2 q = vUv * vec2(96.0, 48.0);
      float nz = 0.5 * vnoise(q) + 0.3 * vnoise(q * 2.3 + 7.1) + 0.2 * vnoise(q * 5.1 + 3.3);
      float cs = clamp(ca * 0.7 + nz * 0.5, 0.0, 1.0);        // texture structure + fine procedural detail
      float th = mix(0.98, 0.18, cg);                          // coverage = share of that structure that is shown
      float live = smoothstep(th - 0.06, th + 0.26, cs) * (0.55 + 0.45 * cs);
      ca = mix(ca, live, uCloudMix);
      gl_FragColor = vec4(vec3(1.0) * (day * vis * 1.25 + uAmb * 0.5), ca * 0.94);
    #else
      gl_FragColor = vec4(col, 1.0);
    #endif
  #endif
  #include <colorspace_fragment>
}`;
const FS_RING = FS_COMMON + `
void main(){
  #include <logdepthbuf_fragment>
  vec3 L = normalize(uSunDir), N = normalize(uRingN);
  vec3 P = (vW - uCenter) / uVisR * uBodyR;
  float r = length(P);
  float u = (r - uRingRad.x) / (uRingRad.y - uRingRad.x);
  if (u < 0.0 || u > 1.0) discard;
  vec4 rt = texture2D(uRing, vec2(u, 0.5));
  float vis = sunVisible(P);
  float lit = dot(N, L) * dot(N, normalize(vV)) > 0.0 ? 1.0 : 0.38;
  vec3 col = (rt.rgb * vec3(1.0, 0.94, 0.82)) * (lit * vis * 1.3 + 0.02);
  gl_FragColor = vec4(col, rt.a * 0.95);
  #include <colorspace_fragment>
}`;
const VS_ATM = `
varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const FS_ATM = `
precision highp float;
uniform vec3 uCenter, uSunDir, uColor, uTwi; uniform float uVisR, uThick, uStrength;
varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  vec3 rd = normalize(vW - cameraPosition);
  vec3 toC = uCenter - cameraPosition;
  float tc = dot(toC, rd);
  vec3 cp = cameraPosition + rd * tc;
  float h = length(cp - uCenter) / uVisR;
  vec3 nrm = normalize(cp - uCenter);
  float dayF = smoothstep(-0.30, 0.35, dot(nrm, normalize(uSunDir)));
  float g;
  if (h > 1.0) { float x = (h - 1.0) / uThick; g = pow(clamp(1.0 - x, 0.0, 1.0), 2.4); }
  else { g = 0.55 * pow(h, 7.0); }
  float twi = smoothstep(0.35, -0.05, abs(dot(nrm, normalize(uSunDir))) ) * 0.0;
  float ndl = dot(nrm, normalize(uSunDir));
  vec3 c = mix(uColor, uTwi, smoothstep(0.35, 0.0, ndl) * smoothstep(-0.35, 0.0, ndl));
  gl_FragColor = vec4(c * g * dayF * uStrength, g * dayF);
  #include <colorspace_fragment>
}`;

// ---------- lit material factory ----------
function litUniforms(extra) {
  return Object.assign({
    uMap: { value: _white }, uNight: { value: _white }, uSpec: { value: _white }, uRing: { value: _white }, uNormal: { value: _white }, uCloudGrid: { value: _white }, uCloudMix: { value: 0 }, uReliefK: { value: 1.6 },
    uColor: { value: new THREE.Color('#888888') }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uCenter: { value: new THREE.Vector3() }, uRingN: { value: new THREE.Vector3(0, 1, 0) },
    uRingRad: { value: new THREE.Vector2(74500, 140220) },
    uSunDist: { value: 1.496e8 }, uSunR: { value: 695700 }, uBodyR: { value: 6371 }, uVisR: { value: 1 },
    uAmb: { value: 0.012 }, uHasTex: { value: 0 }, uAlphaMode: { value: 0 }, uNightMul: { value: 1.0 },
    uOcc: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },
  }, extra || {});
}
function makeLit(cfg) {
  const defines = {};
  if (cfg.sun) defines.SUN = ''; if (cfg.earth) defines.EARTH = ''; if (cfg.night) defines.HAS_NIGHT = '';
  if (cfg.spec) defines.HAS_SPEC = ''; if (cfg.clouds) defines.CLOUDS = ''; if (cfg.redUmbra) defines.REDUMBRA = '';
  if (cfg.ringShadow) defines.RING_SHADOW = ''; if (cfg.normal) defines.HAS_NORMAL = '';
  const u = litUniforms();
  if (cfg.map) { u.uMap.value = tex(cfg.map); u.uHasTex.value = 1; }
  if (cfg.night) u.uNight.value = tex(cfg.night);
  if (cfg.normal) u.uNormal.value = tex(cfg.normal, false);
  if (cfg.spec) u.uSpec.value = tex(cfg.spec, false);
  if (cfg.ringShadow) u.uRing.value = tex('ring');
  if (cfg.color) u.uColor.value.set(cfg.color);
  if (cfg.amb != null) u.uAmb.value = cfg.amb;
  return new THREE.ShaderMaterial({
    uniforms: u, defines, vertexShader: VS_LIT, fragmentShader: FS_LIT,
    transparent: !!cfg.clouds, depthWrite: !cfg.clouds, side: THREE.FrontSide,
  });
}

// ---------- geometry ----------
const geoHi = new THREE.SphereGeometry(1, 96, 64), geoMid = new THREE.SphereGeometry(1, 48, 32), geoLo = new THREE.SphereGeometry(1, 28, 18);
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,240,200,0.85)'); gr.addColorStop(0.25, 'rgba(255,200,110,0.35)');
  gr.addColorStop(0.55, 'rgba(255,150,60,0.08)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

// ---------- scale model ----------
const TRUE_UNIT = 1 / 1000; // true mode: 1 scene unit = 1000 km
const EXPL = { dist: au => 14 * Math.pow(au, 0.55), sun: 3.4, earthR: 0.45, expR: 0.42 };
function rVis(id) {
  const d = BODY[id];
  if (S.trueScale) return d.R * TRUE_UNIT;
  if (id === 'Sun') return EXPL.sun;
  if (!d.parent) return EXPL.earthR * Math.pow(d.R / 6371, EXPL.expR);
  const pr = rVis(d.parent);
  return pr * Math.min(0.45, Math.max(0.07, Math.pow(d.R / BODY[d.parent].R, 0.55) * 1.1));
}
function helioToWorld(p) { // km vec -> world (double)
  if (S.trueScale) return [p[0] * TRUE_UNIT, p[1] * TRUE_UNIT, p[2] * TRUE_UNIT];
  const d = v3.len(p); if (d === 0) return [0, 0, 0];
  const k = EXPL.dist(d / AU_KM) / d; return [p[0] * k, p[1] * k, p[2] * k];
}
function offsetToWorld(parentId, r) { // km offset from parent -> world offset
  if (S.trueScale) return [r[0] * TRUE_UNIT, r[1] * TRUE_UNIT, r[2] * TRUE_UNIT];
  const d = v3.len(r); if (d === 0) return [0, 0, 0];
  const ratio = d / BODY[parentId].R, vd = rVis(parentId) * (1.5 + 0.45 * Math.pow(ratio, 0.7));
  const k = vd / d; return [r[0] * k, r[1] * k, r[2] * k];
}
function worldPos(id, st) {
  const d = BODY[id];
  if (d.parent) {
    const par = worldPos(d.parent, st);
    return v3.add(par, offsetToWorld(d.parent, v3.sub(st.pos[id], st.pos[d.parent])));
  }
  return helioToWorld(st.pos[id]);
}

// ---------- body objects ----------
const OB = {};
const labelLayer = $('labels');
const parentOf = id => BODY[id].parent || null;
function makeLabel(id) {
  const el = document.createElement('div'); el.className = 'lbl' + (BODY[id].parent ? ' moon' : '');
  el.textContent = id; el.dataset.id = id; labelLayer.appendChild(el); return el;
}
function buildBodies() {
  const mk = (id, cfg, geo) => {
    const d = BODY[id], mat = makeLit(cfg), mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.renderOrder = 1; scene.add(mesh);
    const o = { id, def: d, mesh, mat, label: makeLabel(id), pos: new THREE.Vector3(), vr: 1, extras: [] };
    OB[id] = o; return o;
  };
  mk('Sun', { sun: true, map: 'sun' }, geoHi);
  mk('Mercury', { map: 'mercury', amb: 0.01 }, geoMid);
  mk('Venus', { map: 'venus', amb: 0.015 }, geoMid);
  const earth = mk('Earth', { map: 'earth', night: 'earthLights', spec: 'earthSpec', normal: 'earthNormal', earth: true, amb: 0.012 }, geoHi);
  mk('Mars', { map: 'mars' }, geoMid);
  mk('Jupiter', { map: 'jupiter', amb: 0.014 }, geoHi);
  const sat = mk('Saturn', { map: 'saturn', ringShadow: true, amb: 0.014 }, geoHi);
  mk('Uranus', { map: 'uranus', amb: 0.014 }, geoMid);
  mk('Neptune', { map: 'neptune', amb: 0.014 }, geoMid);
  mk('Pluto', { color: '#b7a590' }, geoLo);
  mk('Moon', { map: 'moon', amb: 0.006, redUmbra: true }, geoMid);
  for (const id of BODY_DEFS.filter(b => b.parent && b.id !== 'Moon').map(b => b.id)) mk(id, { color: BODY[id].color, amb: 0.012 }, geoLo);
  // Earth clouds
  const cm = makeLit({ map: 'earthClouds', clouds: true, amb: 0.01 });
  const clouds = new THREE.Mesh(geoHi, cm); clouds.matrixAutoUpdate = false; clouds.frustumCulled = false; clouds.renderOrder = 3; scene.add(clouds);
  earth.clouds = clouds; earth.cloudMat = cm;
  // Saturn ring
  const rg = new THREE.RingGeometry(SATURN_RING.inner / BODY.Saturn.R, SATURN_RING.outer / BODY.Saturn.R, 160, 1);
  const rm = new THREE.ShaderMaterial({ uniforms: litUniforms(), vertexShader: VS_LIT, fragmentShader: FS_RING, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  rm.uniforms.uRing.value = tex('ring'); rm.uniforms.uRingRad.value.set(SATURN_RING.inner, SATURN_RING.outer);
  const ring = new THREE.Mesh(rg, rm); ring.matrixAutoUpdate = false; ring.frustumCulled = false; ring.renderOrder = 2; scene.add(ring);
  sat.ring = ring; sat.ringMat = rm;
  // atmospheres
  const atmCfg = { Earth: ['#5ab0ff', '#ff8a45', 0.06, 1.5], Venus: ['#f5d9a0', '#f0b070', 0.035, 0.9], Mars: ['#d99a78', '#d99a78', 0.02, 0.5], Jupiter: ['#d9c3a0', '#d9c3a0', 0.014, 0.35], Saturn: ['#e6d7b0', '#e6d7b0', 0.014, 0.3], Uranus: ['#9fe3ea', '#9fe3ea', 0.03, 0.7], Neptune: ['#6f8cff', '#6f8cff', 0.03, 0.8], Titan: ['#e8a95a', '#e8a95a', 0.05, 0.9] };
  for (const id in atmCfg) {
    const c = atmCfg[id];
    const m = new THREE.ShaderMaterial({
      uniforms: { uCenter: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uColor: { value: new THREE.Color(c[0]) }, uTwi: { value: new THREE.Color(c[1]) }, uVisR: { value: 1 }, uThick: { value: c[2] }, uStrength: { value: c[3] } },
      vertexShader: VS_ATM, fragmentShader: FS_ATM, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geoMid, m); mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.renderOrder = 4; scene.add(mesh);
    OB[id].atm = mesh; OB[id].atmMat = m; OB[id].atmScale = 1 + c[2] * 1.15;
  }
  // Sun glow
  const g1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95 }));
  const g2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35, color: 0xffb060 }));
  g1.renderOrder = 5; g2.renderOrder = 5; scene.add(g1, g2); OB.Sun.glow = [g1, g2];
}

// ---------- background: stars, milky way, galaxies ----------
const bg = new THREE.Group(); scene.add(bg);
let starsPts, constLines = null, milkyMesh;
function starDirEqj(raDeg, decDeg) { const a = raDeg * DEG, d = decDeg * DEG; return eqj2scene(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)); }
const STAR_GEOS = []; let starYrs = 0;
function starDirAt(s, yrs) { // s = [ra, dec, ..., pmra*(mas/yr) at [4], pmdec at [5]]; linear proper motion from J2000
  let ra = s[0], dec = s[1];
  if (yrs && (s[4] || s[5])) { ra += (s[4] / 3.6e6) * yrs / Math.max(0.02, Math.cos(dec * DEG)); dec += (s[5] / 3.6e6) * yrs; }
  return starDirEqj(ra, dec);
}
function fillStarPositions(pos, radius, yrs) {
  for (let i = 0; i < STARS.length; i++) { const d = starDirAt(STARS[i], yrs); pos[i * 3] = d[0] * radius; pos[i * 3 + 1] = d[1] * radius; pos[i * 3 + 2] = d[2] * radius; }
}
function applyStarEpoch(tms) { // re-aim every star for the picked date (proper motion); precession is handled by the sky rotation matrix
  const yrs = (tms - J2000_MS) / (365.25 * MS_DAY);
  if (Math.abs(yrs - starYrs) < 0.8) return false;
  starYrs = yrs;
  for (const g of STAR_GEOS) { const a = g.geo.getAttribute('position'); fillStarPositions(a.array, g.radius, yrs); a.needsUpdate = true; }
  return true;
}
function buildStarGeometry(radius) {
  const n = STARS.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), mag = new Float32Array(n);
  fillStarPositions(pos, radius, starYrs);
  for (let i = 0; i < n; i++) {
    const s = STARS[i];
    const bv = Math.max(-0.3, Math.min(2, s[3]));
    const r = bv < 0.4 ? 0.62 + (bv + 0.3) * 0.55 : 1.0, b = bv < 0.6 ? 1.0 : Math.max(0.35, 1.0 - (bv - 0.6) * 0.45), g = bv < 0.3 ? 0.82 + (bv + 0.3) * 0.3 : Math.max(0.5, 1.0 - Math.abs(bv - 0.6) * 0.3);
    col[i * 3] = Math.min(1, r); col[i * 3 + 1] = Math.min(1, g); col[i * 3 + 2] = Math.min(1, b);
    mag[i] = s[2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
  STAR_GEOS.push({ geo: g, radius });
  return g;
}
const STAR_VS = `
attribute float mag; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale, uPx, uLim;
varying float vFade; varying float vY;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vC = color;
  float b = pow(10.0, -0.4 * (mag - 1.0));
  gl_PointSize = clamp((2.3 + 2.3 * sqrt(b)) * uScale * uPx, 1.5, 10.0 * uPx);
  vA = clamp(0.62 + 0.5 * sqrt(b), 0.0, 1.0) * (1.0 - smoothstep(uLim - 0.6, uLim + 0.6, mag));
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vY = normalize(wp.xyz - (modelMatrix * vec4(0.,0.,0.,1.)).xyz).y;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const STAR_FS = `
precision highp float; varying vec3 vC; varying float vA; varying float vY; uniform float uDim, uHorizon;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0;
  float a = smoothstep(1.0, 0.0, r); a = pow(a, 1.35);
  float hz = uHorizon > 0.5 ? smoothstep(-0.01, 0.12, vY) : 1.0;
  gl_FragColor = vec4(vC, a * vA * uDim * hz);
  #include <colorspace_fragment>
}`;
function makeStarPoints(radius, dimUniform) {
  const m = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 1 }, uPx: { value: renderer.getPixelRatio() }, uDim: { value: dimUniform }, uHorizon: { value: 0 }, uLim: { value: 9 } }, vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(buildStarGeometry(radius), m); p.frustumCulled = false; p.renderOrder = -10; return p;
}
function buildConstellations(radius, opacity) {
  const pts = [];
  for (const c of CONSTS) for (const seg of c.lines) for (let i = 0; i < seg.length - 1; i++) {
    const a = starDirEqj(seg[i][0], seg[i][1]), b = starDirEqj(seg[i + 1][0], seg[i + 1][1]);
    pts.push(a[0] * radius, a[1] * radius, a[2] * radius, b[0] * radius, b[1] * radius, b[2] * radius);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity, depthWrite: false })); l.frustumCulled = false; l.renderOrder = -9; return l;
}
const GALS = [
  { img: 'gal1', ra: 186.6, dec: 31.2, size: 7, name: 'NGC 4414' }, { img: 'gal2', ra: 202.5, dec: 47.2, size: 9, name: 'M51' },
  { img: 'gal3', ra: 49.9, dec: -19.4, size: 8, name: 'NGC 1300' }, { img: 'gal4', ra: 190.0, dec: -11.6, size: 8, name: 'M104' }, { img: 'gal5', ra: 180.5, dec: -18.9, size: 7, name: 'Antennae' },
];
function galaxyTexture(key) { // centre-cropped, radially feathered so no photo borders show
  const c = document.createElement('canvas'); c.width = c.height = 256; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image(); img.onload = () => {
    const g = c.getContext('2d'), sz = Math.min(img.width, img.height); g.clearRect(0, 0, 256, 256);
    g.drawImage(img, (img.width - sz) / 2, (img.height - sz) / 2, sz, sz, 0, 0, 256, 256);
    g.globalCompositeOperation = 'destination-in'; const gr = g.createRadialGradient(128, 128, 10, 128, 128, 126);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); t.needsUpdate = true;
  }; img.src = TEX[key]; return t;
}
function buildBackground() {
  const R = 9e7;
  starsPts = makeStarPoints(R, 1); bg.add(starsPts);
  constLines = buildConstellations(R * 0.99, 0.22); constLines.visible = false; bg.add(constLines);
  // Milky Way: galactic frame -> scene
  const mw = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 48, 32), new THREE.MeshBasicMaterial({ map: tex('milky'), side: THREE.BackSide, color: new THREE.Color(0.42, 0.42, 0.46), depthWrite: false }));
  mw.renderOrder = -11; mw.frustumCulled = false;
  const gal = A.Rotation_GAL_EQJ(), t0 = A.MakeTime(new Date(0));
  const g2s = (x, y, z) => { const v = A.RotateVector(gal, new A.Vector(x, y, z, t0)); return eqj2scene(v.x, v.y, v.z); };
  const gx = g2s(1, 0, 0), gy = g2s(0, 1, 0), gz = g2s(0, 0, 1); // galactic centre, +l, north pole in scene axes
  // sphere uv: lon0 (u=.5) is +X; texture centre = galactic centre. +l increases to the LEFT in the map -> use -gy for lon+90E (=-Z local)
  const m4 = new THREE.Matrix4().makeBasis(new THREE.Vector3(...gx), new THREE.Vector3(...gz), new THREE.Vector3(...gy));
  mw.applyMatrix4(m4); bg.add(mw); milkyMesh = mw;
  for (const g of GALS) {
    const d = starDirEqj(g.ra, g.dec), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: galaxyTexture(g.img), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set(d[0] * R * 0.98, d[1] * R * 0.98, d[2] * R * 0.98); const s = 2 * R * Math.tan(g.size * 0.6 * DEG / 2); sp.scale.set(s, s, 1); sp.renderOrder = -8; bg.add(sp);
  }
}

// ---------- orbit lines & trails ----------
const orbitGroup = new THREE.Group(); scene.add(orbitGroup);
const ORB = {}; // id -> {line, ref(ms), mode, pts(km arrays), parent}
const PERIOD_DAYS = { Mercury: 87.97, Venus: 224.7, Earth: 365.25, Mars: 687, Jupiter: 4332.6, Saturn: 10759, Uranus: 30688, Neptune: 60182, Pluto: 90560 };
function orbitSamples(id, tms) {
  const pts = [];
  if (!BODY[id].parent) {
    const P = PERIOD_DAYS[id], n = id === 'Mercury' || id === 'Venus' ? 160 : 220;
    for (let i = 0; i <= n; i++) pts.push(vecAU2scene(A.HelioVector(A.Body[id], timeOf(tms + (i / n) * P * MS_DAY))));
    return pts;
  }
  if (id === 'Moon') { for (let i = 0; i <= 120; i++) pts.push(vecAU2scene(A.GeoMoon(timeOf(tms + (i / 120) * 27.32 * MS_DAY)))); return pts; }
  if (SATS[id]) return satOrbitPathSceneKm(id, tms, 120);
  // galilean: sample JupiterMoons
  const P = { Io: 1.7691, Europa: 3.5512, Ganymede: 7.1546, Callisto: 16.689 }[id];
  for (let i = 0; i <= 120; i++) pts.push(vecAU2scene(A.JupiterMoons(timeOf(tms + (i / 120) * P * MS_DAY))[id.toLowerCase()]));
  return pts;
}
function ensureOrbit(id, tms) {
  let o = ORB[id];
  const stale = !o || o.mode !== S.trueScale || Math.abs(tms - o.ref) > (BODY[id].parent ? (SATS[id] ? 400 : 20) * MS_DAY : 3 * 365.25 * MS_DAY);
  if (!stale) return o;
  const pts = orbitSamples(id, tms);
  const isMoon = !!BODY[id].parent;
  const arr = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => { const w = isMoon ? offsetToWorld(BODY[id].parent, p) : helioToWorld(p); arr[i * 3] = w[0]; arr[i * 3 + 1] = w[1]; arr[i * 3 + 2] = w[2]; });
  if (!o) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(BODY[id].color), transparent: true, opacity: isMoon ? 0.4 : 0.38, depthWrite: false }));
    line.frustumCulled = false; line.renderOrder = 0; orbitGroup.add(line); o = ORB[id] = { line };
  } else { o.line.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3)); o.line.geometry.computeBoundingSphere(); }
  o.ref = tms; o.mode = S.trueScale; return o;
}
const TRAIL = {}; let trailAnchor = null;
function updateTrails(tms) {
  const on = S.tg.trails;
  for (const id in TRAIL) TRAIL[id].visible = on;
  if (!on) return;
  const N = S.trailSpan * MS_DAY;
  if (trailAnchor && Math.abs(tms - trailAnchor.t) < N * 0.2 && trailAnchor.span === S.trailSpan && trailAnchor.mode === S.trueScale) return;
  trailAnchor = { t: tms, span: S.trailSpan, mode: S.trueScale };
  for (const id of PLANETS) {
    const n = 90, arr = new Float32Array((n + 1) * 3), col = new Float32Array((n + 1) * 3);
    for (let i = 0; i <= n; i++) {
      const tt = tms - N + (2 * N) * i / n, p = helioToWorld(vecAU2scene(A.HelioVector(A.Body[id], timeOf(tt))));
      arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2];
      const f = i / n < 0.5 ? 0.25 + (i / n) * 2 * 0.65 : 0.9 + (i / n - 0.5) * 2 * 0.9, c = new THREE.Color(BODY[id].color);
      col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f;
    }
    let l = TRAIL[id];
    if (!l) { const g = new THREE.BufferGeometry(); l = TRAIL[id] = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); l.frustumCulled = false; l.renderOrder = 0; orbitGroup.add(l); }
    l.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3)); l.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); l.geometry.computeBoundingSphere(); l.visible = true;
  }
}

// ---------- shadow cones (true-scale only) ----------
const cones = {};
function coneMesh(key, color, opacity) {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
  m.frustumCulled = false; m.renderOrder = 6; scene.add(m); return (cones[key] = m);
}
function setConeGeometry(mesh, r0, r1, len) {
  const seg = 48, pos = [], idx = [];
  for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pos.push(c * r0, 0, s * r0, c * r1, len, s * r1); }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = mesh.geometry; g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeBoundingSphere();
}
function updateCones(st, origin) {
  const show = S.tg.shadows && S.trueScale && S.view !== 'sky';
  for (const k of ['mU', 'mP', 'eU', 'eP']) if (cones[k]) cones[k].visible = false;
  if (!show) return;
  const sun = [0, 0, 0];
  const mk = (occId, keyU, keyP, Rocc, maxLen) => {
    const p = st.pos[occId], dS = v3.len(p), ax = v3.norm(p); // away from Sun
    const Rs = BODY.Sun.R, tu = (Rs - Rocc) / dS, tp = (Rs + Rocc) / dS, Lu = Rocc / tu;
    const U = cones[keyU] || coneMesh(keyU, 0x7a2e12, 0.38), P = cones[keyP] || coneMesh(keyP, 0x6f86ff, 0.07);
    const lenU = Math.min(Lu, maxLen), lenP = maxLen;
    setConeGeometry(U, Rocc * TRUE_UNIT, Math.max(0, Rocc - lenU * tu) * TRUE_UNIT, lenU * TRUE_UNIT);
    setConeGeometry(P, Rocc * TRUE_UNIT, (Rocc + lenP * tp) * TRUE_UNIT, lenP * TRUE_UNIT);
    const w = worldPos(occId, st), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(...ax);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    for (const m of [U, P]) { m.position.set(w[0] - origin[0], w[1] - origin[1], w[2] - origin[2]); m.quaternion.copy(q); m.visible = true; m.updateMatrix(); }
  };
  const em = v3.norm(v3.sub(st.pos.Moon, st.pos.Earth)), es = v3.norm(v3.mul(st.pos.Earth, -1)), cosE = v3.dot(em, es), lim = Math.cos(12 * DEG); // cones only near new / full Moon
  if (cosE > lim) mk('Moon', 'mU', 'mP', BODY.Moon.R, 480000);
  if (cosE < -lim) mk('Earth', 'eU', 'eP', BODY.Earth.R * 1.02, 1500000);
}

// ---------- location marker on Earth ----------
const marker = new THREE.Group(); scene.add(marker); marker.matrixAutoUpdate = false;
const markerPts = {};
(function buildMarker() {
  const mat = new THREE.LineBasicMaterial({ color: 0xffb454, transparent: true, opacity: 0.9, depthTest: true });
  const ring = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; ring.push(new THREE.Vector3(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1)); }
  marker.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), mat));
  const r2 = ring.map(p => p.clone().multiplyScalar(0.5)); marker.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(r2), mat));
  const cross = [new THREE.Vector3(0, 0, -0.14), new THREE.Vector3(0, 0, 0.1), new THREE.Vector3(-0.1, 0, 0), new THREE.Vector3(0.1, 0, 0)];
  marker.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cross), mat));
  const pin = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd080, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  pin.scale.set(0.12, 0.12, 1); pin.position.y = 0.004; marker.add(pin);
  markerPts.N = new THREE.Vector3(0, 0, -0.17); markerPts.S = new THREE.Vector3(0, 0, 0.13); markerPts.E = new THREE.Vector3(0.13, 0, 0); markerPts.W = new THREE.Vector3(-0.13, 0, 0);
  marker.renderOrder = 7;
})();
const markerLabels = {}; ['N', 'E', 'S', 'W'].forEach(k => { const el = document.createElement('div'); el.className = 'lbl compass'; el.textContent = k; labelLayer.appendChild(el); markerLabels[k] = el; });

// ---------- per-frame scene update ----------
const _m4 = new THREE.Matrix4(), _vx = new THREE.Vector3(), _vy = new THREE.Vector3(), _vz = new THREE.Vector3(), _p = new THREE.Vector3();
function setBasisMatrix(mesh, ax, scaleR, pos, mode) {
  // mode 'sphere': local X=lon0, Y=north, Z=-lon90E ;  mode 'equ': X=x_b, Y=y_b, Z=pole (ring)
  if (mode === 'equ') { _vx.set(...ax.x); _vy.set(...ax.y); _vz.set(...ax.z); }
  else { _vx.set(...ax.x); _vy.set(...ax.z); _vz.set(-ax.y[0], -ax.y[1], -ax.y[2]); }
  _vx.multiplyScalar(scaleR); _vy.multiplyScalar(scaleR); _vz.multiplyScalar(scaleR);
  _m4.makeBasis(_vx, _vy, _vz); _m4.setPosition(pos); mesh.matrix.copy(_m4); mesh.matrixWorld.copy(_m4);
}
let camOrigin = [0, 0, 0];
function sphericalAxesWithSpin(ax, spinAng) { // rotate x,y about z by spinAng (radians)
  if (!spinAng) return ax; const c = Math.cos(spinAng), s = Math.sin(spinAng);
  return { x: v3.add(v3.mul(ax.x, c), v3.mul(ax.y, s)), y: v3.add(v3.mul(ax.y, c), v3.mul(ax.x, -s)), z: ax.z };
}
function updateScene(st, origin) {
  camOrigin = origin;
  const wp = {};
  for (const id in OB) wp[id] = worldPos(id, st);
  for (const id in OB) {
    const o = OB[id], w = wp[id], vr = rVis(id); o.vr = vr;
    o.pos.set(w[0] - origin[0], w[1] - origin[1], w[2] - origin[2]);
    let ax = bodyAxes(id, st);
    if (id === 'Earth' && S.spinBlend < 0.999) {
      const days = (st.tms - J2000_MS) / MS_DAY, fr = days - Math.floor(days);
      ax = sphericalAxesWithSpin(ax, -(1 - S.spinBlend) * 2 * Math.PI * fr);
    }
    o.axes = ax;
    setBasisMatrix(o.mesh, ax, vr, o.pos, 'sphere');
    // lighting uniforms
    const u = o.mat.uniforms, p = st.pos[id];
    const sv = [-p[0], -p[1], -p[2]], dS = v3.len(sv) || 1;
    u.uSunDir.value.set(sv[0] / dS, sv[1] / dS, sv[2] / dS); u.uSunDist.value = dS; u.uBodyR.value = BODY[id].R; u.uVisR.value = vr; u.uCenter.value.copy(o.pos);
    const occ = u.uOcc.value; occ.forEach(v => v.set(0, 0, 0, 0));
    const setOcc = (i, oid, Rm) => { const r = v3.sub(st.pos[oid], p); occ[i].set(r[0], r[1], r[2], Rm || BODY[oid].R); };
    if (id === 'Earth') setOcc(0, 'Moon');
    else if (id === 'Moon') setOcc(0, 'Earth', BODY.Earth.R * 1.02);
    else if (id === 'Jupiter') GALILEAN.forEach((m, i) => setOcc(i, m));
    else if (BODY[id].parent) setOcc(0, BODY[id].parent);
    if (id === 'Saturn') u.uRingN.value.set(...axes_z(ax));
    if (o.clouds) {
      const cax = sphericalAxesWithSpin(ax, -((st.tms - J2000_MS) / MS_DAY) * 0.0016);
      setBasisMatrix(o.clouds, cax, vr * 1.007, o.pos, 'sphere');
      const cu = o.cloudMat.uniforms; for (const k of ['uSunDir', 'uCenter']) cu[k].value.copy(u[k].value); cu.uSunDist.value = dS; cu.uBodyR.value = BODY.Earth.R; cu.uVisR.value = vr;
      cu.uOcc.value.forEach((v, i) => v.copy(occ[i])); o.clouds.visible = S.tg.clouds;
      cu.uCloudGrid.value = cloudTexture(); CLOUD.mix += (CLOUD.target - CLOUD.mix) * 0.06; cu.uCloudMix.value = CLOUD.mix;
    }
    if (o.ring) {
      setBasisMatrix(o.ring, ax, vr, o.pos, 'equ');
      const ru = o.ringMat.uniforms; for (const k of ['uSunDir', 'uCenter']) ru[k].value.copy(u[k].value);
      ru.uSunDist.value = dS; ru.uBodyR.value = BODY.Saturn.R; ru.uVisR.value = vr; ru.uRingN.value.set(...axes_z(ax));
      ru.uOcc.value.forEach(v => v.set(0, 0, 0, 0)); ru.uOcc.value[0].set(0, 0, 0, BODY.Saturn.R);
    }
    if (o.atm) {
      const au = o.atmMat.uniforms; au.uCenter.value.copy(o.pos); au.uSunDir.value.copy(u.uSunDir.value); au.uVisR.value = vr;
      setBasisMatrix(o.atm, { x: [1, 0, 0], y: [0, 0, -1], z: [0, 1, 0] }, vr * o.atmScale, o.pos, 'sphere');
    }
    // visibility rules for moons
    if (BODY[id].parent) {
      const par = OB[BODY[id].parent];
      o.mesh.visible = S.tg.moons;
    }
  }
  // sun glow
  const sg = OB.Sun.glow, sr = OB.Sun.vr; sg[0].position.copy(OB.Sun.pos); sg[1].position.copy(OB.Sun.pos);
  sg[0].scale.setScalar(sr * 7.5); sg[1].scale.setScalar(sr * 17);
  // orbits
  for (const id of PLANETS.filter(p => p !== 'Earth' || true)) { const o = ensureOrbit(id, st.tms); o.line.visible = S.tg.orbits; const w = [-origin[0], -origin[1], -origin[2]]; o.line.position.set(w[0], w[1], w[2]); }
  for (const id of Object.keys(BODY)) if (BODY[id].parent) {
    const parW = wp[BODY[id].parent], near = camDistTo(OB[BODY[id].parent]) < OB[BODY[id].parent].vr * 90 || S.trueScale;
    if (S.tg.orbits && S.tg.moons && near) { const o = ensureOrbit(id, st.tms); o.line.visible = true; o.line.position.set(parW[0] - origin[0], parW[1] - origin[1], parW[2] - origin[2]); } else if (ORB[id]) ORB[id].line.visible = false;
  }
  updateTrails(st.tms);
  for (const id in TRAIL) TRAIL[id].position.set(-origin[0], -origin[1], -origin[2]);
  // star background follows camera
  bg.position.copy(camera.position);
  starsPts.material.uniforms.uScale.value = Math.min(1.3, Math.max(0.8, renderer.domElement.clientHeight / 900));
  constLines.visible = S.tg.constellations;
  updateCones(st, origin);
  updateMarker(st, wp, origin);
}
const axes_z = ax => ax.z;
function camDistTo(o) { return camera.position.distanceTo(o.pos); }
function updateMarker(st, wp, origin) {
  const e = OB.Earth, ax = e.axes; // includes spin blend
  const up = geoDir(ax, S.loc.lat, S.loc.lon);
  const east = v3.norm(v3.cross(ax.z, up)), north = v3.cross(up, east);
  const vr = e.vr, cen = e.pos;
  const x = new THREE.Vector3(...east).multiplyScalar(vr), y = new THREE.Vector3(...up).multiplyScalar(vr), z = new THREE.Vector3(...north).multiplyScalar(-vr);
  const m = new THREE.Matrix4().makeBasis(x, y, z); m.setPosition(cen.x + up[0] * vr * 1.003, cen.y + up[1] * vr * 1.003, cen.z + up[2] * vr * 1.003);
  marker.matrix.copy(m); marker.matrixWorld.copy(m);
  marker.visible = S.view !== 'sky';
  e.up = up; e.east = east; e.north = north;
}
function projectToScreen(v, out) {
  _p.copy(v).project(camera);
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  out.x = (_p.x * 0.5 + 0.5) * w; out.y = (-_p.y * 0.5 + 0.5) * h; out.z = _p.z; return out;
}
const _scr = { x: 0, y: 0, z: 0 }, _v = new THREE.Vector3();
function updateLabels() {
  const show = S.tg.labels && S.view !== 'sky';
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  for (const id in OB) {
    const o = OB[id], el = o.label; let vis = true;
    {
      projectToScreen(o.pos, _scr);
      const behind = _v.copy(o.pos).applyMatrix4(camera.matrixWorldInverse).z > 0;
      const dist = camera.position.distanceTo(o.pos), rpx = (o.vr / dist) * h / (2 * Math.tan(camera.fov * DEG / 2));
      let moonOK = true;
      if (BODY[id].parent) { const po = OB[BODY[id].parent]; moonOK = S.tg.moons && (camera.position.distanceTo(po.pos) < po.vr * 60 || S.trueScale) && rpx > 0.05; }
      vis = !behind && moonOK && _scr.x > -50 && _scr.x < w + 50 && _scr.y > -20 && _scr.y < h + 20;
      o.px = vis ? rpx : 0; o.sx = _scr.x; o.sy = _scr.y; o.onscreen = vis; vis = vis && show && S.view !== 'sky';
      if (vis) { el.style.transform = `translate(${(_scr.x + Math.min(rpx, 400) + 6).toFixed(1)}px,${(_scr.y - 8).toFixed(1)}px)`; }
    }
    el.style.display = vis ? 'block' : 'none'; el.classList.toggle('sel', id === S.selected);
  }
  // compass
  const showC = S.view !== 'sky' && OB.Earth.up && OB.Earth.px > 60;
  for (const k of ['N', 'E', 'S', 'W']) {
    const el = markerLabels[k];
    if (!showC) { el.style.display = 'none'; continue; }
    const pt = markerPts[k].clone().applyMatrix4(marker.matrix);
    const behind = _v.copy(pt).applyMatrix4(camera.matrixWorldInverse).z > 0;
    // hide if on far side of Earth
    const toCam = camera.position.clone().sub(OB.Earth.pos).normalize(), faces = new THREE.Vector3(...OB.Earth.up).dot(toCam) > 0.05;
    projectToScreen(pt, _scr); el.style.display = (!behind && faces) ? 'block' : 'none'; el.style.transform = `translate(${_scr.x - 4}px,${_scr.y - 8}px)`;
  }
}
