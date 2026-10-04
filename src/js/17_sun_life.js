// ===================== 17_sun_life.js — stellar-evolution tables for the Sun (no DOM, no THREE) =====================
// Luminosity, radius and mass vs. time from published solar models (Sackmann, Boothroyd & Kraemer 1993; Schröder & Smith 2008, MNRAS 386, 155).
// u = position on the dock strip (stages get room to breathe), t = Gyr from now.
const R_SUN_AU = 0.00465047;
// keyframes: u = position on the dock strip (stages get room to breathe), t = Gyr from now, L (L☉), R (R☉), M (M☉)
const LIFE_KEYS = [
  { u: 0.00, t: -4.57, L: 0.70, R: 0.89, M: 1.0 },
  { u: 0.17, t: 0.00, L: 1.00, R: 1.00, M: 1.0 },
  { u: 0.217, t: 1.10, L: 1.10, R: 1.04, M: 1.0 },
  { u: 0.31, t: 3.50, L: 1.35, R: 1.20, M: 1.0 },
  { u: 0.40, t: 5.40, L: 2.10, R: 1.60, M: 1.0 },
  { u: 0.467, t: 6.40, L: 2.60, R: 2.10, M: 1.0 },
  { u: 0.50, t: 6.90, L: 3.0, R: 2.5, M: 0.99 },
  { u: 0.581, t: 7.30, L: 300, R: 30, M: 0.85 },
  { u: 0.64, t: 7.59, L: 2730, R: 256, M: 0.67 },
  { u: 0.665, t: 7.60, L: 44, R: 9.5, M: 0.66 },
  { u: 0.72, t: 7.70, L: 44, R: 10, M: 0.62 },
  { u: 0.76, t: 7.74, L: 150, R: 40, M: 0.60 },
  { u: 0.80, t: 7.78, L: 5200, R: 180, M: 0.56 },
  { u: 0.81, t: 7.783, L: 3000, R: 0.4, M: 0.54 },
  { u: 0.835, t: 7.790, L: 300, R: 0.05, M: 0.54 },
  { u: 0.86, t: 7.80, L: 100, R: 0.03, M: 0.54 },
  { u: 0.89, t: 8.0, L: 3, R: 0.015, M: 0.54 },
  { u: 0.93, t: 9.0, L: 0.01, R: 0.0135, M: 0.54 },
  { u: 1.00, t: 13.0, L: 0.002, R: 0.013, M: 0.54 },
];
const LIFE_PHASES = [ // by t (Gyr from now)
  [-99, 5.4, 'Main sequence', 'Hydrogen fuses to helium in the core; the Sun slowly brightens (≈ +1 % per 100 million years).'],
  [5.4, 6.9, 'Subgiant', 'Core hydrogen is gone; hydrogen burns in a shell and the Sun swells and brightens.'],
  [6.9, 7.5905, 'Red giant branch', 'The envelope balloons while the core shrinks; mass loss strips ~⅓ of the Sun.'],
  [7.5905, 7.605, 'Helium flash', 'Helium ignites explosively in the degenerate core and the Sun shrinks within minutes.'],
  [7.605, 7.70, 'Horizontal branch', 'Quiet helium burning in the core (about 100 million years).'],
  [7.70, 7.783, 'Asymptotic giant branch', 'Helium shell flashes make the Sun swell again and blow off its outer layers.'],
  [7.783, 7.80, 'Planetary nebula', 'The ejected shell glows in the light of the exposed hot core for ≈ 20,000 years.'],
  [7.80, 99, 'White dwarf', 'An Earth-sized ember of carbon and oxygen, cooling for trillions of years.'],
];
const LIFE_PLANETS = [['Mercury', 0.387, 0.018, 1.0], ['Venus', 0.723, 0.028, 1.0], ['Earth', 1.0, 0.03, 0.7], ['Mars', 1.524, 0.022, 1.0], ['Jupiter', 5.203, 0.08, 1.0], ['Saturn', 9.537, 0.07, 1.0], ['Uranus', 19.19, 0.05, 1.0], ['Neptune', 30.07, 0.05, 1.0]];
const lifeDisp = x => Math.sqrt(Math.max(0, x));
function lerpKey(u, f) { // log-interpolate L and R, linear for t, M
  const K = LIFE_KEYS; let i = 0; while (i < K.length - 2 && u > K[i + 1].u) i++; const a = K[i], b = K[i + 1], k = Math.max(0, Math.min(1, (u - a.u) / (b.u - a.u)));
  return { t: a.t + (b.t - a.t) * k, L: Math.exp(Math.log(a.L) + (Math.log(b.L) - Math.log(a.L)) * k), R: Math.exp(Math.log(a.R) + (Math.log(b.R) - Math.log(a.R)) * k), M: a.M + (b.M - a.M) * k };
}
function lifeState(u) {
  const s = lerpKey(Math.max(0, Math.min(1, u)), 0); s.T = 5772 * Math.pow(s.L / (s.R * s.R), 0.25); s.u = u; s.phase = LIFE_PHASES.find(p => s.t >= p[0] && s.t < p[1]) || LIFE_PHASES[7];
  s.hzIn = Math.sqrt(s.L / 1.107), s.hzOut = Math.sqrt(s.L / 0.356); s.RAU = s.R * R_SUN_AU; return s;
}
function lifeUofT(t) { const K = LIFE_KEYS; for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1].t) return K[i].u + (K[i + 1].u - K[i].u) * (t - K[i].t) / (K[i + 1].t - K[i].t); return 1; }
function bbColor(T) {
  const t = Math.max(10, Math.min(400, T / 100)), c = v => Math.max(0, Math.min(255, v)) / 255;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592), g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492), b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [c(r), c(g), c(b)];
}
