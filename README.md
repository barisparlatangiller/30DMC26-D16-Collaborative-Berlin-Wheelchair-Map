# Berlin, step-free?

**#30DayMapChallenge 2026 · Day 16 · Collaborative map**

How wheelchair-accessible is Berlin, according to the map that volunteers build together? Three 3D maps from OpenStreetMap.

**Live map:** https://barisparlatangiller.github.io/30DMC26-D16-Collaborative-Berlin-Wheelchair-Map/

1. **How step-free is Berlin?** Hexagons (H3, ~0.74 km²): height = places with a `wheelchair` tag, colour = share tagged `yes`.
2. **Where has nobody checked yet?** Height = all places, colour = share without any `wheelchair` tag.
3. **Can you even get there?** U-Bahn, S-Bahn and rail stations, tram stops and lifts, coloured by their `wheelchair` tag.

## Numbers (OSM, Geofabrik Berlin extract, 16 Nov 2026)

| | |
|---|---|
| Places | 56,190 |
| … with wheelchair info | 28,209 (50%) |
| … of these: yes / limited / no | 46% / 20% / 34% |
| Most step-free district (of tagged) | Marzahn-Hellersdorf 76% |
| Least step-free district | Friedrichshain-Kreuzberg 36% |
| Best / least mapped district | Mitte 59% / Reinickendorf 41% |
| U-Bahn / S-Bahn stations tagged step-free | 78% / 84% |
| Tram stops without wheelchair info | 73% |

## Method and limits

- **Places** = OSM objects with `amenity`, `shop`, `healthcare`, `tourism` or `leisure` that people visit (shops, food, health, public and cultural venues, toilets). Street furniture (benches, bins, parking, playgrounds etc.) is excluded; see `pipeline/process.py`.
- `wheelchair=yes|designated` → step-free, `limited` → partly, `no` → not accessible, no tag → unknown.
- These are volunteer-mapped tags, not an official audit. "Unknown" doesn't mean inaccessible, and a tag can be outdated. Station values are the OSM tags, not BVG/S-Bahn data.

## Pipeline

`pipeline/run_data.sh` (GitHub Actions) downloads the Geofabrik Berlin extract, filters it with osmium, aggregates with `pipeline/process.py` (H3, districts, stations) and renders the grey basemap with `pipeline/basemap.py`. `pipeline/film.mjs` renders the three LinkedIn images.

Data © OpenStreetMap contributors, ODbL. Built by Barış Parlatangiller with Claude (AI).
