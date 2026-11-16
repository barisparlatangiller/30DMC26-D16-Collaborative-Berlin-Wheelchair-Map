#!/usr/bin/env bash
# Whole data pipeline; everything is logged to docs/data/log.txt (Actions logs need a login to read)
set -euxo pipefail
mkdir -p docs/data
exec > >(tee docs/data/log.txt) 2>&1
wget -q https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf -O berlin.pbf
osmium fileinfo berlin.pbf | head -20 || true
osmium tags-filter -O berlin.pbf nwr/amenity nwr/shop nwr/tourism nwr/leisure nwr/healthcare -o p.pbf
osmium export -O p.pbf -f geojsonseq -o places.geojsonseq --geometry-types=point,polygon
osmium tags-filter -O berlin.pbf nwr/railway=station,halt,tram_stop n/highway=elevator -o t.pbf
osmium export -O t.pbf -f geojsonseq -o transit.geojsonseq --geometry-types=point,polygon
osmium tags-filter -O berlin.pbf r/boundary=administrative -o a.pbf
osmium export -O a.pbf -f geojsonseq -o adm.geojsonseq --geometry-types=polygon
osmium tags-filter -O berlin.pbf nwr/building w/highway w/railway nwr/natural=water,wood w/waterway nwr/landuse nwr/leisure -o b.pbf
osmium export -O b.pbf -f geojsonseq -o box.geojsonseq --geometry-types=linestring,polygon
ls -la *.geojsonseq
python pipeline/process.py
python pipeline/basemap.py
