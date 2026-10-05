# Country trade and consumption

The map mode `trade` exposes crude/product exports and imports. `consumption` retains existing national total consumption and adds JODI total product demand, gasoline, gasoil/diesel, LPG, jet kerosene, fuel oil, naphtha and crude refinery intake. The last is processing, not final consumption. Profile and comparison metrics share the same observed values; owner/refinery filters do not alter national statistics. Ranking is latest available, not a common-year ranking; each row displays its year.

Sources: https://www.jodidata.org/oil/database/data-downloads.aspx and https://www.opec.org/assets/assetdb/asb-2025.pdf (tables 5.2 and 5.3). JODI product/flow/unit codes: https://www.jodidata.org/_resources/files/downloads/oil-data/jodi-wdb-short-long-names.pdf .

Reproduce: keep annual primary/secondary CSV files for 2021–2025 in `data/sources/jodi`, then run `node scripts/import-jodi.mjs` and `npm run data:update`. Download URLs and SHA256 fingerprints are recorded in `data/sources/jodi/manifest.json`. The compact OPEC export snapshot is in `data/sources/opec-exports-2024.json`. Runtime needs only atlas.json, not the CSV files. A normal build never fetches external statistics.

JODI aggregation: KBD × 1000, weighted by calendar days per month, including leap years. Require 12 distinct valid nonnegative months from the same year; missing/confidential placeholders and assessment 4 are excluded. Real zero stays zero. Codes 1 comparable, 2 caution, 3 unassessed are retained and displayed. Select latest complete year per metric/country. OPEC 2024 annual exports fill missing or older JODI observations; JODI wins on equal year. OPEC annual values are thousand bbl/day converted ×1000, not sums of monthly data. Never distribute regional totals among countries; combined Sudans excluded. OPEC may include condensate, transit and re-exports; definitions can differ.

All 258 map countries/territories have metric slots, but not all report statistics. No inferred zero and no invented trade partners. Existing total-consumption coverage (218) and product-share series remain unchanged. Product demand is a supply/demand measure and includes non-fuel uses. Jet is a subset of kerosenes. Do not sum arbitrary product categories or combine different years into a global total.

Tests: `npm test` covers annual weighting, partial years, missing vs zero, duplicate months, assessment exclusion, source provenance and national-filter independence. `npm run lint`, `npm run build`, browser mode/ranking/profile checks.
