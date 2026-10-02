"""Build src/assets.js: compressed textures (base64 data URIs) + star / constellation / satellite data.
Inputs: data/raw/*  (downloaded once; see context.md for sources).  Output: src/assets.js"""
import base64, io, json, os, gzip, csv
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
RAW = os.path.join(ROOT, "data", "raw")
GAL = os.path.join(ROOT, "..", "asteroid-swarm", "data", "raw", "img")
OUT = os.path.join(ROOT, "src", "assets.js")


def enc(im, fmt="JPEG", q=80):
    b = io.BytesIO()
    if fmt == "JPEG":
        im.save(b, "JPEG", quality=q, optimize=True, progressive=True)
        mime = "image/jpeg"
    else:
        im.save(b, "PNG", optimize=True)
        mime = "image/png"
    return f"data:{mime};base64," + base64.b64encode(b.getvalue()).decode()


def load(path, size=None, mode="RGB"):
    im = Image.open(path).convert(mode)
    if size:
        im = im.resize(size, Image.LANCZOS)
    return im


tex = {}
tex["earth"] = enc(load(f"{RAW}/earth_atmos_2048.jpg", (2048, 1024)), q=82)
tex["earthSpec"] = enc(load(f"{RAW}/earth_specular_2048.jpg", (1024, 512), "L"), q=75)
tex["earthLights"] = enc(load(f"{RAW}/earth_lights_2048.png", (1536, 768)), q=78)
tex["earthClouds"] = enc(Image.open(f"{RAW}/earth_clouds_1024.png").convert("RGBA").split()[3], q=75)  # alpha -> luminance
tex["earthNormal"] = enc(load(f"{RAW}/earth_normal_2048.jpg", (1024, 512)), q=82)
tex["mwArt"] = enc(load(f"{RAW}/milkyway_2005.jpg", (1100, 1100)), q=80)  # NASA/JPL-Caltech/R. Hurt (SSC) artist's concept, public domain
tex["moon"] = enc(load(f"{RAW}/moon_1024.jpg", (1024, 512)), q=80)
for k, f, sz in [("sun", "2k_sun", (1024, 512)), ("mercury", "2k_mercury", (1024, 512)),
                 ("venus", "2k_venus_surface", (1024, 512)), ("mars", "2k_mars", (1024, 512)),
                 ("jupiter", "2k_jupiter", (1024, 512)), ("saturn", "2k_saturn", (1024, 512)),
                 ("uranus", "2k_uranus", (512, 256)), ("neptune", "2k_neptune", (512, 256)),
                 ("milky", "2k_stars_milky_way", (1536, 768))]:
    tex[k] = enc(load(f"{RAW}/{f}.jpg", sz), q=74)
ring = Image.open(f"{RAW}/2k_saturn_ring_alpha.png").convert("RGBA")
ring = ring.resize((1024, 4), Image.LANCZOS)
tex["ring"] = enc(ring, "PNG")
for i in range(1, 6):
    tex[f"gal{i}"] = enc(load(f"{GAL}/gal{i}.jpg"), q=80)

# ---- stars -------------------------------------------------------------
stars_gj = json.load(open(f"{RAW}/stars.6.json", encoding="utf-8"))
names = json.load(open(f"{RAW}/starnames.json", encoding="utf-8"))
# proper motion (mas/yr; pmra already includes cos(dec)) from the HYG database (Hipparcos-derived, CC BY-SA 4.0), keyed by HIP id
pm = {}
with gzip.open(f"{RAW}/hyg.csv.gz", "rt", encoding="utf-8") as fh:
    for row in csv.DictReader(fh):
        if row["hip"]:
            try:
                pm[row["hip"]] = (max(-9999, min(9999, round(float(row["pmra"])))), max(-9999, min(9999, round(float(row["pmdec"])))))
            except ValueError:
                pass
stars, named = [], []
for f in stars_gj["features"]:
    mag = f["properties"]["mag"]
    ra, dec = f["geometry"]["coordinates"]
    if ra < 0:
        ra += 360
    try:
        bv = float(f["properties"]["bv"])
    except Exception:
        bv = 0.6
    nm = names.get(str(f["id"]), {}).get("name", "")
    if mag <= 5.3 or nm:
        p = pm.get(str(f["id"]), (0, 0))
        stars.append([round(ra, 3), round(dec, 3), round(mag, 2), round(bv, 2), p[0], p[1]])
        if nm and mag <= 3.0:
            named.append([round(ra, 3), round(dec, 3), round(mag, 2), nm, p[0], p[1]])

cons_pts = json.load(open(f"{RAW}/constellations.json", encoding="utf-8"))
cons_lines = json.load(open(f"{RAW}/constellations.lines.json", encoding="utf-8"))
nm_by_id = {}
for f in cons_pts["features"]:
    ra, dec = f["geometry"]["coordinates"]
    nm_by_id[f["id"]] = (f["properties"]["name"] or f["properties"]["en"], round(ra % 360, 2), round(dec, 2))
cons = []
for f in cons_lines["features"]:
    cid = f["id"]
    lines = [[[round(p[0] % 360, 3), round(p[1], 3)] for p in seg] for seg in f["geometry"]["coordinates"]]
    n = nm_by_id.get(cid, (cid, 0, 0))
    cons.append({"id": cid, "name": n[0], "ra": n[1], "dec": n[2], "lines": lines})

# ---- satellites (JPL SSD mean elements, epoch J2000, SAT441/MAR099/URA182/NEP097) ----
# name: parent, a_km, e, w, M, i, node, P_d, Pw_yr, Pnode_yr, poleRA, poleDec, frame
SATS = {
    "Phobos": ["Mars", 9375, 0.015, 216.3, 189.7, 1.1, 169.2, 0.3187, 1.1, 2.3, 317.7, 52.9],
    "Deimos": ["Mars", 23457, 0.000, 0.0, 205.0, 1.8, 54.3, 1.2625, 0.0, 56.2, 316.6, 53.5],
    "Mimas": ["Saturn", 186000, 0.020, 160.4, 275.3, 1.6, 66.2, 0.942422, 0.493, 0.986, 40.6, 83.5],
    "Enceladus": ["Saturn", 238400, 0.005, 119.5, 57.0, 0.0, 0.0, 1.370218, 2.916, 0.0, 40.6, 83.5],
    "Tethys": ["Saturn", 295000, 0.001, 335.3, 0.0, 1.1, 273.0, 1.887802, 0.005, 4.982, 40.6, 83.5],
    "Dione": ["Saturn", 377700, 0.002, 116.0, 212.0, 0.0, 0.0, 2.736916, 11.698, 0.0, 40.6, 83.5],
    "Rhea": ["Saturn", 527200, 0.001, 44.3, 31.5, 0.3, 133.7, 4.517503, 33.939, 35.775, 40.6, 83.5],
    "Titan": ["Saturn", 1221900, 0.029, 78.3, 11.7, 0.3, 78.6, 15.945448, 346.68, 687.37, 36.4, 84.0],
    "Iapetus": ["Saturn", 3561700, 0.028, 254.5, 74.8, 7.6, 86.5, 79.331002, 1662.9, 3130.302, 288.7, 78.9],
    "Ariel": ["Uranus", 190929, 0.001, 9.6, 193.5, 0.0, 0.0, 2.520379, 28.901, 0.0, None, None],
    "Umbriel": ["Uranus", 265986, 0.004, 183.4, 253.0, 0.1, 174.8, 4.144177, 64.126, 129.745, None, None],
    "Titania": ["Uranus", 436298, 0.002, 184.0, 68.1, 0.1, 29.5, 8.705869, 579.928, 1644.649, None, None],
    "Oberon": ["Uranus", 583511, 0.002, 132.2, 143.6, 0.1, 76.8, 13.463237, 158.604, 192.798, None, None],
    "Miranda": ["Uranus", 129846, 0.001, 154.8, 73.0, 4.4, 100.9, 1.413479, 8.939, 17.787, None, None],
    "Triton": ["Neptune", 354800, 0.000, 0.0, 63.0, 157.3, 178.1, 5.876994, 0.0, 340.379, 299.8, 43.1],
}

with open(OUT, "w", encoding="utf-8") as f:
    f.write("const TEX=" + json.dumps(tex) + ";\n")
    f.write("const STARS=" + json.dumps(stars, separators=(",", ":")) + ";\n")
    f.write("const STAR_NAMES=" + json.dumps(named, separators=(",", ":"), ensure_ascii=False) + ";\n")
    f.write("const CONSTS=" + json.dumps(cons, separators=(",", ":"), ensure_ascii=False) + ";\n")
    f.write("const SATS=" + json.dumps(SATS, separators=(",", ":")) + ";\n")
print(f"wrote {OUT}: {os.path.getsize(OUT)/1024:.0f} KB; stars={len(stars)} named={len(named)} cons={len(cons)}")
for k, v in tex.items():
    print(f"  {k:12s} {len(v)/1024:7.0f} KB")
