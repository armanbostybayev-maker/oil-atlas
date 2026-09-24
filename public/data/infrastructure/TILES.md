# Local vector tile workflow

The source GeoJSON remains the authoritative geometry. `scripts/build-infrastructure-tiles.mjs` prepares local MBTiles from the oil or gas line data; it does not publish them. Requires a separately installed `tippecanoe` executable.

```bash
node scripts/build-infrastructure-tiles.mjs --type oil --input /path/oil-pipelines.geojson --output /tmp/oil.mbtiles
node scripts/build-infrastructure-tiles.mjs --type gas --input /path/gas-pipelines.geojson --output /tmp/gas.mbtiles
```

The resulting MBTiles archives are not directly served by Vercel or MapLibre. Before switching the browser from GeoJSON to tiles, deploy an authorized tile endpoint (for example a server that exposes `/{z}/{x}/{y}.pbf`), verify its CORS and attribution, and configure MapLibre vector sources with `source-layer` names `infrastructure_oil` and `infrastructure_gas`. Keep the existing GeoJSON layer as fallback until browser tests pass. This branch does **not** claim that a tile server is deployed.

This first pass retains original lines without line simplification and allows large tiles; inspect actual output size, zoom behavior and memory before production. Respect redistribution terms for both source GeoJSON and derivative tiles.
