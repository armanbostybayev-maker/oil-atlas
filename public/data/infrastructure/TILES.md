# Local vector tile workflow

The source GeoJSON remains the authoritative geometry. `scripts/build-infrastructure-tiles.mjs` prepares local MBTiles from the oil or gas line data; it does not publish them. Requires a separately installed `tippecanoe` executable.

```bash
node scripts/build-infrastructure-tiles.mjs --type oil --input /path/oil-pipelines.geojson --output /tmp/oil.mbtiles
node scripts/build-infrastructure-tiles.mjs --type gas --input /path/gas-pipelines.geojson --output /tmp/gas.mbtiles
```

The resulting MBTiles archives are not directly served by Vercel or MapLibre. Before switching the browser from GeoJSON to tiles, deploy an authorized tile endpoint (for example a server that exposes `/{z}/{x}/{y}.pbf`), verify its CORS and attribution, and configure MapLibre vector sources with `source-layer` names `infrastructure_oil` and `infrastructure_gas`. Keep the existing GeoJSON layer as fallback until browser tests pass. This branch does **not** claim that a tile server is deployed.

This first pass retains original lines without line simplification and allows large tiles; inspect actual output size, zoom behavior and memory before production. Respect redistribution terms for both source GeoJSON and derivative tiles.

## MapLibre configuration (after an authorized tile server is running)

Set these Vite build-time environment variables to HTTPS tile URL templates (or same-origin absolute paths):

```dotenv
VITE_OIL_PIPELINE_TILES=https://your-tile-host.example/oil/{z}/{x}/{y}.pbf
VITE_GAS_PIPELINE_TILES=https://your-tile-host.example/gas/{z}/{x}/{y}.pbf
```

The browser automatically uses vector sources with `source-layer` names `infrastructure_oil` and `infrastructure_gas` when the corresponding URL is configured. Otherwise it falls back to the existing GeoJSON files. Do not set these variables to MBTiles file paths: the browser requires an HTTP(S) tile service. When using tiles, the count beside a layer is shown as unknown rather than claiming a complete count from the visible viewport. Verify source attribution and access restrictions in the deployed tile server.

Build-time safeguard: Vite refuses to build with either tile URL configured unless `import-manifest.json` has `status: approved_for_publication` and the corresponding dataset has a verified release, permission evidence/reference, and attribution. This is a configuration check, not an independent legal determination; verify permission for derivative vector tiles before changing the manifest.
