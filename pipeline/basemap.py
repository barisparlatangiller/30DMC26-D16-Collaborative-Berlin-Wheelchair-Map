"""Grey basemap rendered from OpenStreetMap (© OpenStreetMap contributors, ODbL) in Web Mercator (EPSG:3857) for deck.gl.
Styled like a light, Positron-type map (Day 5 design language). Runs in GitHub Actions after
osmium has extracted and exported the data (see .github/workflows/basemap.yml).
Outputs (docs/data): base_8k.jpg / base.jpg  = 30 km 3D box (3.7 / 7.3 m per px)
                     base_core_8k.jpg / base_core.jpg = 8 km Koblenz core (1 / 2 m per px)
                     base_ctx.jpg = 150 km flat context (50 m per px)"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer
Image.MAX_IMAGE_PIXELS = None
OUT = "docs/data"; os.makedirs(OUT, exist_ok=True)
T = Transformer.from_crs(4326, 3857, always_xy=True)

C = dict(bg="#f2efe9", res="#ebe6df", ind="#e6e1da", farm="#f2efe9", forest="#dde3d3", grass="#e4e9da",
         water="#c6d4dd", river="#c6d4dd", bld="#d6cfc4", bld_line="#c4bcb0", casing="#d3cdc3", road="#ffffff",
         major="#fdfbf7", rail="#b9b3aa", cemetery="#e1e4d8", vine="#e9e6d6")
ROADS = {"motorway": 7, "trunk": 6, "primary": 5, "secondary": 4.2, "tertiary": 3.4, "motorway_link": 3, "trunk_link": 3,
         "primary_link": 3, "secondary_link": 2.6, "tertiary_link": 2.4, "residential": 2.2, "unclassified": 2.2,
         "living_street": 2, "pedestrian": 2, "service": 1.2}

def load(path):
    feats = []
    with open(path) as f:
        for line in f:
            line = line.strip().lstrip("\x1e")
            if line: feats.append(json.loads(line))
    print(path, len(feats), flush=True)
    return feats

def project(coords):
    a = np.asarray(coords, dtype=float)
    x, y = T.transform(a[:, 0], a[:, 1]); return np.stack([x, y], 1)

class Canvas:
    def __init__(s, x0, y0, x1, y1, px, scale=1.0):
        s.x0, s.y1, s.mpp, s.k = x0, y1, (x1 - x0) / px, scale
        s.img = Image.new("RGB", (px, round((y1 - y0) / s.mpp)), C["bg"]); s.d = ImageDraw.Draw(s.img)
    def pix(s, xy): return list(zip(((xy[:, 0] - s.x0) / s.mpp).tolist(), ((s.y1 - xy[:, 1]) / s.mpp).tolist()))
    def poly(s, rings, fill, outline=None, hole=None):
        ext = s.pix(project(rings[0]))
        if len(ext) >= 3: s.d.polygon(ext, fill=fill, outline=outline)
        for r in rings[1:]:
            p = s.pix(project(r))
            if len(p) >= 3: s.d.polygon(p, fill=hole or C["bg"])
    def line(s, coords, fill, w):
        p = s.pix(project(coords))
        if len(p) >= 2: s.d.line(p, fill=fill, width=max(1, round(w * s.k)), joint="curve")

def polys(g):
    if g["type"] == "Polygon": return [g["coordinates"]]
    if g["type"] == "MultiPolygon": return g["coordinates"]
    return []

def lines(g):
    if g["type"] == "LineString": return [g["coordinates"]]
    if g["type"] == "MultiLineString": return g["coordinates"]
    return []

def render(feats, cv, buildings=True, minor=True):
    P = lambda f: f.get("properties", {})
    def layer(test, fill, outline=None, hole=None):
        for f in feats:
            if test(P(f)):
                for rings in polys(f["geometry"]): cv.poly(rings, fill, outline, hole)
    layer(lambda p: p.get("landuse") in ("residential",), C["res"], hole=C["res"])
    layer(lambda p: p.get("landuse") in ("industrial", "commercial", "retail", "railway"), C["ind"], hole=C["ind"])
    layer(lambda p: p.get("landuse") == "vineyard", C["vine"])
    layer(lambda p: p.get("landuse") in ("meadow", "grass", "recreation_ground", "allotments") or p.get("leisure") in ("park", "garden", "pitch", "golf_course") , C["grass"])
    layer(lambda p: p.get("landuse") == "cemetery", C["cemetery"])
    layer(lambda p: p.get("landuse") == "forest" or p.get("natural") == "wood", C["forest"], hole=C["bg"])
    layer(lambda p: p.get("natural") == "water" or p.get("waterway") == "riverbank" or p.get("landuse") == "basin", C["water"], hole=C["bg"])
    for f in feats:
        p = P(f)
        if p.get("waterway") in ("river", "canal"): [cv.line(c, C["river"], 4) for c in lines(f["geometry"])]
        elif p.get("waterway") == "stream" and minor: [cv.line(c, C["river"], 1.4) for c in lines(f["geometry"])]
    if buildings:
        layer(lambda p: "building" in p and p.get("building") != "no", C["bld"], C["bld_line"], hole=C["res"])
    rd = [(f, ROADS[P(f)["highway"]]) for f in feats if P(f).get("highway") in ROADS and (minor or ROADS[P(f)["highway"]] >= 3.4)]
    rd.sort(key=lambda t: t[1])
    for f, w in rd: [cv.line(c, C["casing"], w + 1.6) for c in lines(f["geometry"])]
    for f, w in rd: [cv.line(c, C["major"] if w >= 4 else C["road"], w) for c in lines(f["geometry"])]
    for f in feats:
        if P(f).get("railway") in ("rail",) and P(f).get("service") is None:
            [cv.line(c, C["rail"], 1.6) for c in lines(f["geometry"])]

LON0, LAT0, LON1, LAT1 = 13.05, 52.33, 13.80, 52.69
(x0, x1), (y0, y1) = T.transform([LON0, LON1], [LAT0, LAT1])
box = load("box.geojsonseq")
cv = Canvas(x0, y0, x1, y1, 8192, 0.9); render(box, cv)
cv.img.save(f"{OUT}/base_8k.jpg", quality=86, optimize=True)
w, h = cv.img.size; cv.img.resize((w // 2, h // 2), Image.LANCZOS).save(f"{OUT}/base.jpg", quality=86, optimize=True)
json.dump({"bounds": [LON0, LAT0, LON1, LAT1]}, open(f"{OUT}/base.json", "w"))
print("done", w, h)
