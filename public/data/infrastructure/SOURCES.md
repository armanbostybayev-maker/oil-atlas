# Verified infrastructure data acquisition

The committed GeoJSON files are **empty placeholders**. They do not constitute world coverage.

## Primary sources

1. **Oil transmission pipelines:** Global Energy Monitor (GEM), Global Oil Infrastructure Tracker (GOIT): https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/ . Request the GIS routes via its download form. Choose GeoJSON when available. The spreadsheet alone does not include routes.
2. **Gas transmission pipelines:** GEM, Global Gas Infrastructure Tracker (GGIT): https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/ . Request the GeoJSON GIS routes via the download form.
3. **Fields:** GEM, Global Oil and Gas Extraction Tracker (GOGET): https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/ . Import point coordinates only when their accuracy is recorded. Country-level placeholders are not exact field sites.

Read the terms supplied with each downloaded release. Preserve attribution and licence information. The dataset release date is **not** the date you downloaded it and is **not** the date of an individual source record. The importer stores these separately as `source_release` and `source_date`. Avoid adding raw workbooks or private contact information to the repository.

## Import commands

After obtaining the official GeoJSON file, run from the repository root:

```bash
node scripts/import-infrastructure.mjs --type oil --input /path/to/official-oil-routes.geojson --source "Global Oil Infrastructure Tracker, Global Energy Monitor" --source-url https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/ --release YYYY-MM --accuracy approximate
node scripts/import-infrastructure.mjs --type gas --input /path/to/official-gas-routes.geojson --source "Global Gas Infrastructure Tracker, Global Energy Monitor" --source-url https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/ --release YYYY-MM --accuracy approximate
node scripts/check-infrastructure.mjs
npm test
npm run build
```

**Before importing:** verify the actual release date and field names in the downloaded file. The importer currently accepts GeoJSON FeatureCollections with line geometries for pipelines; it does not read Excel, GeoPackage or shapefiles. Convert these with a GIS tool first, preserving the original geometry and project IDs. The importer does not invent routes from endpoints. Review aliases in `scripts/import-infrastructure.mjs` against the exact source schema.

The `--accuracy approximate` default is conservative; it must not override more specific source accuracy. Source-provided accuracy fields are retained when recognized. Keep the original files outside `public/` for audit. The map is for overview, not locating buried infrastructure.

## Release checklist

- [ ] Downloaded source file and release/version identified.
- [ ] Redistribution and attribution requirements reviewed.
- [ ] Feature counts compared with mapped-route counts, not total tracker rows.
- [ ] Statuses, geometry accuracy and unmapped projects reviewed.
- [ ] `node scripts/check-infrastructure.mjs`, `npm test` and `npm run build` pass.
- [ ] Browser performance checked at world and regional zoom.
- [ ] Attribution visible in the map UI before merging to `main`.
