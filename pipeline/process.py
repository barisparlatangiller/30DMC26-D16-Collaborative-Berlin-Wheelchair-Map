"""Day 16 · Berlin wheelchair accessibility from OpenStreetMap (ODbL). Runs in GitHub Actions on the Geofabrik
Berlin extract after osmium has exported places, transit and boundaries (see .github/workflows/data.yml)."""
import json, collections, h3, numpy as np
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union
from shapely.prepared import prep
OUT = "docs/data"
def feats(path):
    with open(path) as f:
        for line in f:
            line = line.strip().lstrip("\x1e")
            if line: yield json.loads(line)

# ---- boundaries
berlin, bez = None, []
for f in feats("adm.geojsonseq"):
    p = f["properties"]
    if f["geometry"]["type"] not in ("Polygon", "MultiPolygon"): continue
    if p.get("admin_level") == "4" and p.get("name") == "Berlin": berlin = shape(f["geometry"])
    elif p.get("admin_level") == "9" and p.get("name"): bez.append((p["name"], shape(f["geometry"])))
assert berlin is not None and len(bez) >= 12, (berlin is None, len(bez))
bez = [(n, g) for n, g in bez if g.representative_point().within(berlin)]
print("districts", len(bez), sorted(n for n, _ in bez))
PB = prep(berlin); PZ = [(n, prep(g), g) for n, g in bez]

# ---- places: amenity/shop/tourism/leisure/healthcare that people go to (street furniture excluded)
SKIP_AMENITY = set("bench waste_basket waste_disposal recycling bicycle_parking parking_space parking_entrance motorcycle_parking vending_machine post_box "
                   "telephone clock drinking_water fountain hunting_stand grit_bin shelter charging_station bicycle_rental atm ticket_validator "
                   "smoking_area table loading_dock watering_place letter_box photo_booth compressed_air water_point dog_toilet give_box "
                   "parcel_locker kneipp_water_cure lounger hydrant bbq trolley_bay public_bookcase parking".split())
SKIP_LEISURE = set("pitch playground picnic_table outdoor_seating fitness_station track swimming_pool slipway firepit common bleachers dog_park "
                   "garden nature_reserve park".split())
SKIP_TOURISM = set("artwork viewpoint information picnic_site camp_pitch".split())
def is_place(p):
    if p.get("amenity"): return p["amenity"] not in SKIP_AMENITY
    if p.get("shop"): return p["shop"] not in ("vacant", "no")
    if p.get("healthcare"): return True
    if p.get("tourism"): return p["tourism"] not in SKIP_TOURISM
    if p.get("leisure"): return p["leisure"] not in SKIP_LEISURE
    return False
def cat(p):
    a = p.get("amenity", ""); h = p.get("healthcare", "")
    if h or a in ("pharmacy", "doctors", "dentist", "clinic", "hospital"): return "health"
    if a in ("restaurant", "fast_food", "cafe", "pub", "bar", "biergarten", "ice_cream", "food_court"): return "food"
    if p.get("shop"): return "shops"
    if a in ("school", "kindergarten", "college", "university", "library", "townhall", "community_centre", "social_facility", "post_office", "bank", "police", "courthouse"): return "public"
    if p.get("tourism") or a in ("theatre", "cinema", "arts_centre", "place_of_worship", "nightclub"): return "culture"
    if a == "toilets": return "toilets"
    return "other"
WC = {"yes": 2, "designated": 2, "limited": 1, "no": 0}
places = []
for f in feats("places.geojsonseq"):
    p = f["properties"]
    if not is_place(p): continue
    g = shape(f["geometry"]); pt = g if g.geom_type == "Point" else g.representative_point()
    if not PB.contains(pt): continue
    places.append((pt.x, pt.y, WC.get(p.get("wheelchair"), -1), cat(p)))
print("places", len(places))

# ---- hexagons (H3 res 8, ~0.74 km²)
H = collections.defaultdict(lambda: [0, 0, 0, 0, 0])   # total, tagged, yes, limited, no
for x, y, w, c in places:
    r = H[h3.latlng_to_cell(y, x, 8)]; r[0] += 1
    if w >= 0: r[1] += 1; r[{2: 2, 1: 3, 0: 4}[w]] += 1
hexes = []
for k, (t, tg, yes, lim, no) in H.items():
    b = [[round(lng, 5), round(lat, 5)] for lat, lng in h3.cell_to_boundary(k)]
    lat, lng = h3.cell_to_latlng(k)
    hexes.append({"h": k, "p": b, "c": [round(lng, 5), round(lat, 5)], "t": t, "tg": tg, "y": yes, "l": lim, "n": no})
json.dump(hexes, open(f"{OUT}/hex.json", "w"), separators=(",", ":"))

# ---- districts
D = {n: [0, 0, 0, 0, 0] for n, _ in bez}
for x, y, w, c in places:
    P = Point(x, y)
    for n, pz, g in PZ:
        if pz.contains(P):
            r = D[n]; r[0] += 1
            if w >= 0: r[1] += 1; r[{2: 2, 1: 3, 0: 4}[w]] += 1
            break
dfe = []
for n, g in bez:
    t, tg, yes, lim, no = D[n]
    dfe.append({"type": "Feature", "geometry": mapping(g.simplify(0.0004)), "properties": {"name": n, "t": t, "tg": tg, "y": yes, "l": lim, "n": no,
        "tagged": round(tg / t * 100, 1) if t else None, "yes_of_tagged": round(yes / tg * 100, 1) if tg else None}})
json.dump({"type": "FeatureCollection", "features": dfe}, open(f"{OUT}/districts.geojson", "w"), separators=(",", ":"))
json.dump({"type": "Feature", "geometry": mapping(berlin.simplify(0.0003)), "properties": {}}, open(f"{OUT}/berlin.geojson", "w"), separators=(",", ":"))

# ---- tagged places as compact binary for the point layer: lon,lat float32 + status + category
cats = ["food", "shops", "health", "public", "culture", "toilets", "other"]
tg = [(x, y, w, c) for x, y, w, c in places if w >= 0]
a = np.zeros(len(tg), dtype=[("x", "<f4"), ("y", "<f4"), ("w", "u1"), ("c", "u1")])
for i, (x, y, w, c) in enumerate(tg): a[i] = (x, y, w, cats.index(c))
a.tofile(f"{OUT}/places.bin")

# ---- transit: stations / stops / elevators
tr = []
for f in feats("transit.geojsonseq"):
    p = f["properties"]; g = shape(f["geometry"]); pt = g if g.geom_type == "Point" else g.representative_point()
    if not PB.contains(pt): continue
    kind = None
    if p.get("highway") == "elevator": kind = "elevator"
    elif p.get("railway") in ("station", "halt") and p.get("station") in ("subway",): kind = "ubahn"
    elif p.get("railway") in ("station", "halt") and (p.get("station") in ("light_rail",) or p.get("light_rail") == "yes" or "S" in (p.get("network:short") or "")): kind = "sbahn"
    elif p.get("railway") in ("station", "halt") and p.get("station") not in ("subway", "light_rail"): kind = "rail"
    elif p.get("railway") == "tram_stop": kind = "tram"
    if not kind: continue
    tr.append({"k": kind, "c": [round(pt.x, 5), round(pt.y, 5)], "w": p.get("wheelchair"), "n": p.get("name")})
json.dump(tr, open(f"{OUT}/transit.json", "w"), separators=(",", ":"))

# ---- summary
tot = len(places); tgd = len(tg); cnt = collections.Counter(w for _, _, w, _ in tg)
bycat = {c: {"t": sum(1 for p in places if p[3] == c), "tg": sum(1 for p in tg if p[3] == c), "y": sum(1 for p in tg if p[3] == c and p[2] == 2)} for c in cats}
trs = {k: dict(collections.Counter((t["w"] or "unknown") for t in tr if t["k"] == k)) for k in ("ubahn", "sbahn", "tram", "rail", "elevator")}
S = {"places": tot, "tagged": tgd, "yes": cnt[2], "limited": cnt[1], "no": cnt[0], "bycat": bycat, "transit": trs,
     "districts": sorted([{**f["properties"]} for f in dfe], key=lambda d: -(d["tagged"] or 0))}
json.dump(S, open(f"{OUT}/stats.json", "w"), indent=1)
print(json.dumps({k: S[k] for k in ("places", "tagged", "yes", "limited", "no")}), json.dumps(trs))
for d in S["districts"]: print(d["name"], d["t"], d["tagged"], d["yes_of_tagged"])
