# Infrastructure data contract

These six files are intentionally empty placeholders, not synthetic routes or facilities. Import licensed/verified public datasets before presenting coverage as complete. Each file is a WGS84 GeoJSON FeatureCollection.

- `oil-pipelines.geojson`, `gas-pipelines.geojson`: LineString/MultiLineString features.
- `fields.geojson`, `processing.geojson`, `stations.geojson`, `storage.geojson`: Point/MultiPoint features. Represent field polygons with a documented representative point in this first version.

Recommended properties: `id`, `name`, `product`, `operator`, `status`, `length_km`, `capacity`, `geometry_accuracy`, `source`, `source_url`, `source_date`. Keep missing values null, never guess. Mark approximate/schematic routes explicitly. Check source redistribution terms and record source vintage. For large world datasets, replace GeoJSON sources with hosted MVT tiles and adjust layer source definitions.
