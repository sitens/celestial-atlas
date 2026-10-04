# Celestial Atlas

A cinematic, interactive 3D **Earth & Solar System** for any place on Earth and any moment from **1000 to 3000 CE** — in one self-contained HTML file.

**Live:** https://siten.ai/atlas/ · **Source:** this repo · MIT

![Earth, Moon and your place under the Sun](docs/earth.png)
![The Sun in the Milky Way](docs/galaxy.png)
![The Sun's helix through space](docs/helix.png)
![Planets corkscrewing behind the Sun](docs/helix_planets.png)
![Laniakea flow](docs/laniakea.png)
![Real Gaia stars around the Sun, with the live guide](docs/gaia_stars.png)
![Flat textbook view vs the real helical motion](docs/compare.png)
![On a phone: one transport, one dock, a collapsible guide](docs/mobile_guide.png)
![Milky Way and Andromeda at their first close pass](docs/collision_first_pass.png)
![The merged galaxy, 10 billion years from now](docs/collision_final.png)
![The Sun as a red giant](docs/sun_life_red_giant.png)
![Flat orbit vs helix in the Galaxy view](docs/galaxy_compare.png)

## What it does

- **Any place** — search (Open-Meteo geocoding), "Me", or type lat/lon/elevation. Camera flies to a marker with a local-horizon grid and compass.
- **Time Travel** — calendar/time/ISO inputs (Location time or UTC), ±1 min…±1 year and ±synodic-month steps, a zoomable 1-day…500-year timeline with eclipse / Moon-phase / equinox markers, event jumps (eclipses anywhere or visible here, phases, solstices, oppositions, elongations, perihelion, meteor peaks), famous-moment presets, playback to 1 year/s, shareable URL hash.
- **Real astronomy** — [Astronomy Engine](https://github.com/cosinekitty/astronomy) for the Sun, planets, Moon, Galilean moons; JPL SSD mean elements for 14 more moons; IAU rotation models; Saturn's tilted rings. Topocentric alt/az, rise/set, phases, libration.
- **Eclipses with exact shadows** — per-pixel disc-overlap shading (Moon→Earth, Earth→Moon with red umbra, Jupiter's moons, Saturn's rings), shadow cones at true scale, live obscuration, local contact times, an eclipse finder, and a ground view with corona, diamond ring and "blood moon".
- **Weather that respects time** — forecast, ERA5 history (1940+) and clearly-labelled climatology; never invented. A live 20° Open-Meteo cloud grid is draped over the globe.
- **Galaxy view (press 5)** — zoom out to a procedural Milky Way (110,000 stars, four logarithmic spiral arms, bar, bulge, kiloparsec rings) and watch the Sun's real galactic orbit: one lap ≈ 223 Myr, radial swing 8.1–9.2 kpc, a ±85 pc bob through the plane every ≈ 70 Myr (exaggerated ×25 by a slider). Scrub or play ±650 Myr (dinosaur extinction and the Cambrian are marked), and switch on **Helix through space** to add the Galaxy's ≈ 560 km/s drift relative to the CMB so the path becomes a true helix.
- **Helical motion** — switch on **Helix** in the Solar System view and the planets (and the Moon around Earth) corkscrew behind the Sun as it carries the system at ≈ 246 km/s around the Galaxy. Honest scale note included (the true pitch is ≈ 52× the orbit radius).
- **Beyond the Galaxy** — scale buttons zoom from the Milky Way (with the NASA/JPL artist's-concept disc and rotating spiral pattern; an arm-crossing timeline for the Sun) to the Magellanic Clouds and dwarf satellites, the Local Group (Andromeda approaching at 110 km/s) and the Laniakea flow toward the Great Attractor.
- **True 3-D galaxies** — the Milky Way is a real 3-D point cloud (thin disc with outer flare, thick disc, boxy/peanut bulge, outer warp, halo, dust lanes), so edge-on it is the thin, bulging, warped disc astronomers see in other galaxies, not a flat picture. Andromeda, Triangulum, the Magellanic Clouds and the dwarf spheroidals are 3-D clouds tilted to their catalogue inclinations and position angles.
- **Real stars** — the **Stars** scale shows 50,146 real [ESA Gaia DR3](https://www.cosmos.esa.int/gaia) stars at their measured 3-D positions (a 1-in-12 sample of the G < 10.5 stars within 1 kpc), the Local Bubble, and the nearest named stars with distances in light-years. A **Galaxies** scale places Hubble's showpieces (Whirlpool, Sombrero, NGC 4414, NGC 1300, Antennae) at their catalogue distances.
- **One simple dock** — one timeline, one transport (⏪ ▶ speed ⟲), five views. In the Galaxy view the same dock runs *galactic* time (±650 Myr, arm crossings, mass extinctions). Time travel, options, menu and place live in four popovers; everything fits a 390 px phone.
- **Live guide + tooltips** — a card narrates what you are looking at *right now* from the live ephemeris (distances, light-travel time, Moon phase, planets up tonight, where the Sun is in the Galaxy…), suggests what to try with one-tap actions, and can read aloud (browser speech synthesis, off by default). Hover or long-press any button for a tooltip showing its live effect. Key: **G** toggles the guide.
- **Compare** — in Helix mode, **Compare with flat view** splits the screen: the textbook picture (Sun at rest) beside the real motion with the corkscrews.
- **Milky Way – Andromeda collision** — the **Collision** scale runs a restricted N-body simulation live in your browser (13,000 stars in two moving dark-matter haloes with dynamical friction), tuned to the published timeline: first close pass ≈ 3.6 Gyr from now, second ≈ 5.6 Gyr, merged ≈ 6.4 Gyr into a reddish elliptical (“Milkomeda”). Scrub, play and *reverse* up to 1,000 Myr/s; jump to the first pass, the second pass, the merger or the **final state** (10 Gyr); the yellow ring is a test star on the Sun's orbit and the guide reports where it ends up. Illustrative physics — see About.
- **Life of the Sun** — in the Solar System view, **☀ Sun's life** shows the Sun from birth (−4.6 Gyr) through today, the moment Earth leaves the habitable zone (+1.1 Gyr), the red giant (256 R☉ at +7.6 Gyr: Mercury, Venus and probably Earth are swallowed), helium flash, horizontal and asymptotic-giant branches, the planetary nebula and the 0.54 M☉ white dwarf, with live luminosity / radius / temperature / mass, the habitable-zone ring, and the planets' orbits widening as the Sun loses mass.
- **Move across space** — ✥ Move mode (or right-drag, Shift-drag, two-finger drag, **W A S D**) pans the camera in every orbit view (Solar System, Galaxy, collision, Sun's life); ⌖ Recenter (**C**) flies back.
- **More** — click a Hubble galaxy label for its photo card; **Galaxy compare** (flat orbit vs helix) with a draggable divider (also in the Solar System helix compare); a denser Gaia sample (92,000 stars within 100 pc) fades in as you zoom to the Sun; a schematic Gould Belt ring; the cinematic tour now continues through Hubble's galaxies, the collision and the Sun's death, and reads its captions aloud when the guide's voice is on.
- **Rendering** — Three.js r160, log-depth + floating origin, HDR bloom, Earth relief/night lights/clouds, Hubble galaxies, explorable and true-scale modes, 2,331 stars with proper motion, constellations, cinematic tour.

Accuracy vs JPL Horizons (topocentric, 1969–2026): Sun ≤ 1.2″, Moon ≤ 4.4″, planets ≤ 5″. 1700–2200 CE shows no warning; 1000–1700 and 2200–3000 show a "reduced accuracy" banner (Moon drifts to ~15′ by 2500). See `data/horizons_check.json`.

## Run

```bash
node scripts/serve.js 8765     # then open http://127.0.0.1:8765/
# or just open site/index.html (needs internet for the two CDN libraries and Open-Meteo)
```

## Build & test

```bash
pip install pillow playwright && npm i astronomy-engine@2.1.19
python scripts/build_assets.py         # textures, stars (+proper motion), Gaia stars (1 kpc + 100 pc samples), constellations, satellite elements -> src/assets.js
node   scripts/tune_merger.js          # orbit of the Milky Way–Andromeda merger vs the published timeline
node   scripts/build_eclipse_table.js  # all 9,641 eclipses 1000-3000 CE -> src/eclipses.js (~70 s)
python scripts/build_html.py           # -> site/index.html
node   scripts/test_logic.js           # 80+ time/ephemeris/eclipse/galaxy/merger/solar-evolution checks
node   scripts/horizons_check.js       # compare against JPL Horizons (network)
python scripts/verify_ui.py            # 60+ end-to-end checks in real Chrome (Playwright)
```

`data/raw/` holds the downloaded source textures and catalogs. The 100 pc Gaia sample (`data/raw/gaia_100pc.csv`, 7 MB) is not committed: re-create it with the ESA TAP query in the comment of `build_assets.py`. The proper-motion source is not committed (13 MB): download `hyg/CURRENT/hygdata_v40.csv.gz` from [astronexus/HYG-Database](https://github.com/astronexus/HYG-Database) to `data/raw/hyg.csv.gz` before running `build_assets.py`.

## Credits

Planet/Milky Way textures [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0, NASA-derived) · Earth/Moon/clouds/lights/relief from the three.js examples (NASA Visible Earth) · Hubble galaxies NASA/ESA via Wikimedia Commons · Gaia DR3 ESA/Gaia/DPAC (CC BY-SA 3.0 IGO) · stars [d3-celestial](https://github.com/ofrohn/d3-celestial) (BSD-3) + [HYG database](https://github.com/astronexus/HYG-Database) (CC BY-SA 4.0) · satellite elements NASA/JPL SSD · weather & geocoding [Open-Meteo](https://open-meteo.com) (CC BY 4.0) · [three.js](https://threejs.org) (MIT) · [Astronomy Engine](https://github.com/cosinekitty/astronomy) (MIT).

Built by [Siten Sanghvi](https://siten.ai).
