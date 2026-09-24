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
