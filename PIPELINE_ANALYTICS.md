# Pipeline analytics — field audit and implementation

## Audit (2026-09-24)

Work is isolated on `feat/global-pipeline-infrastructure` (PR #1). The other local checkout contains unrelated uncommitted Oil Atlas changes and is not modified by this work.

Supplied GeoJSON: oil 1,468 unique source IDs; gas 2,933 unique source IDs. All geometry is MultiLineString, CRS84/WGS84. QMD identifies GEM but provides neither a dataset release nor redistribution permission. Source dates are record dates, not release dates. Public placeholders and the existing publication gate remain unchanged. User-supplied files can be analyzed locally in the browser without uploading or embedding them in the application build.

| Source field | Analytical field | Oil populated | Gas populated | Rule |
|---|---|---:|---:|---|
| source_id | id | 1468 | 2933 | Prefix source namespace, retain source ID |
| name | name | 1468 | 2933 | Preserve original |
| fuel | product | 1468 | 2933 | Oil→oil; Gas→gas; NGL→other (not automatically condensate) |
| status | status | 1468 | 2933 | mothballed→idle; shelved/mixed status→unknown; retain raw status |
| countries | countries | 1468 | 2931 | Semicolon-separated unique names |
| route_accuracy | geometry_accuracy | 1468 | 2933 | Source label; not a guarantee of survey precision |
| source_date | source_date | 1468 | 2921 | Record date only |
| source_url | source_url | 1330 | 2830 | Safe HTTP(S) reference only |
| none | operator, owners, commissioning_year | 0 | 0 | null, no inference |
| none | length_km | 0 | 0 | null as reported; optional geometry estimate stored separately |
| none | capacity_* / throughput_* | 0 | 0 | null; no actual utilization or spare capacity |
| QMD abstract | source | dataset-level | dataset-level | GEM attribution; release/rights remain unconfirmed |

Missing for actual utilization: comparable capacity and its type, actual throughput, matching observation period, product, compatible units, gas reference conditions, sources. Mass-to-volume conversion requires density; no universal petroleum conversion factor. >100% utilization is retained and flagged.

## Counting and units

Group source segments by namespaced source ID. Do not add repeated project capacities. Conflicting segment attributes make derived comparisons unavailable. Deduplicate exact line segments (including reversed segments) for geometry-based length estimates, which are labelled approximate and separate from reported length. A country's geography statistics refer to full routes associated with it, not length inside its borders. Cross-border routes appear in multiple countries; no national network capacity is claimed.

Only compare matching observation periods. Normalize oil volume to bbl/day, mass to t/year (unless documented density allows conversion), gas volume to m³/day with identical documented standard conditions. Annual/day conversions require an explicit calendar year. Forecasts/estimates are excluded from observed utilization. Scenarios use known capacity only and never enter factual summaries.

## Publication

No supplied routes, derived tiles or local filenames are committed to public assets. Release and redistribution evidence are still required by the existing gate. No deployment or merge is authorized by this task.

## Verification and use

Open **Аналитика трубопроводов** in the infrastructure controls. Under **Данные и локальное открытие**, choose the oil and gas files separately. These are read through the browser File API; no upload, local storage, or publication is performed. Closing analysis restores the other overlays. Table pages contain at most 25 rows. Geometry sources are not rebuilt when filtering; filters and paint properties change in place. A geometry-edge WeakMap avoids recomputing geodesic segments for each country's summary.

Known coverage on supplied files: 4,401 unique objects; 0 capacity, 0 actual throughput, 0 comparable utilization. Geometry length is an explicitly approximate estimate (about 1,373,862 km across deduplicated segments), not a reported length or length of a functioning network. Country statistics include the full associated routes, not boundary-clipped lengths. Existing vector infrastructure overlays remain supported; analytical records currently require GeoJSON attributes, not a tile-only endpoint.

Required commands: `npm test`; `node scripts/check-infrastructure.mjs`; `npx vite build --config vite.config.mjs`. The normal build wrapper regenerates refinery data from an external private source; it was not substituted with invented source data. CI uses the prepared-public-data Vite build and retains both publication rejection integration tests. CI now explicitly includes pipeline unit tests as well as the full regression suite.

Browser: start Vite at port 5184, run `node tests/pipelines-browser.mjs`. Optional `PIPELINE_OIL_FILE` and `PIPELINE_GAS_FILE` point to local-only source files, `PIPELINE_TEST_URL` overrides the URL. Browser checks include synthetic measured/missing records, >100% utilization, isolated scenarios, live map-to-row selection, unchanged GeoJSON source identity under filtering, all 4,401 supplied routes, pagination and mobile bounds. Screenshots and reports remain in ignored `artifacts/pipelines/`.

Changed files: `analytics/pipelines.mjs`, `controls/usePipelines.jsx`, `panels/PipelineAnalytics.jsx`, `styles/pipelines.css`, `map/PipelineAnalyticsLayer.mjs`, `map/WorldMap.jsx`, `components/AtlasApp.jsx`, `controls/InfrastructureControls.jsx`, `scripts/import-infrastructure.mjs` (preserve raw attributes), `tests/pipelines.test.mjs`, `tests/pipelines-browser.mjs`, `.github/workflows/infrastructure.yml`, this document. No public infrastructure assets or permission manifests changed.

Final local checks: 33 unit/regression tests passed; infrastructure checker passed with six empty public layers; Vite prepared-data build passed; unapproved tile endpoint integration correctly blocked; browser test passed with both supplied files (4,401 objects) and synthetic measurements. Summary calculation on this machine improved from about 482 ms to 197 ms with cached geometry; filtering about 3 ms. Timing is indicative, not a performance guarantee. Added build:prepared and test:pipelines:browser package scripts.
