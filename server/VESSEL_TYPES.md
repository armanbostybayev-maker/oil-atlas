# Global oil-related fleet

The collector subscribes to the whole WGS84 world (`[[[-90,-180],[90,180]]]`). Neither the collector nor the type/company filters restrict vessels to the current map viewport. This means global **available feed coverage**, not a complete inventory of the world's vessels. The app cannot create positions where AISStream supplies none.

## Observed source data

Inspection of the running local `/api/tankers` on 2026-09-17 found 1,638 records in one snapshot. Counts change continuously:

| AIS code | Count | Text returned by existing collector | Normalized category without further evidence |
| --- | ---: | --- | --- |
| 80 | 1,083 | Tanker | `unknown_tanker` |
| 81 | 51 | Tanker - Hazard A | `unknown_tanker` |
| 82 | 59 | Tanker - Hazard B | `unknown_tanker` |
| 83 | 27 | Tanker - Hazard C | `unknown_tanker` |
| 84 | 38 | Tanker - Hazard D | `unknown_tanker` |
| 85 | 3 | Tanker | `unknown_tanker` |
| 86 | 6 | Tanker | `unknown_tanker` |
| 88 | 4 | Tanker | `unknown_tanker` |
| 89 | 367 | Tanker | `unknown_tanker` |

Code 87 was not present in the initial snapshot. A second live check on 2026-09-18 returned 1,212 tankers, including one with code 87: all codes 80–89 have therefore been observed and are supported/tested. Every `vesselSubtype` in the initial snapshot was `Tanker`; no owner/company/operator fields were populated. These counts are audit evidence only, never UI defaults or fixtures representing live positions.

[USCG NAVCEN's AIS message 5 definition](https://www.navcen.uscg.gov/ais-class-a-static-voyage-message-5) identifies first digit 8 as tanker. The second digit carries hazard/additional-information detail: 0 general, 1–4 hazard/pollutant categories (currently X/Y/Z/OS, formerly A/B/C/D), 5–8 reserved, 9 no additional information. None identifies crude oil, refined products, LPG or LNG. Original codes and supplied labels remain available in GeoJSON and cards.

## Classification contract

Shared implementation: `map/vessel-types.mjs`, used by collector and frontend. A known non-tanker AIS class (including cargo 70–79, passenger 60–69, tugs and fishing) is not admitted based on an oil-related string. Generic 80–89 tankers always remain included. Missing/unknown/other standard classes require an explicit recognized type in a source type field; absent type data alone does not establish a tanker.

Exact textual aliases in `vesselTypeName` / `typeName` / a textual `vesselType` can refine the tanker class to crude oil, products, oil/chemical, chemical, LPG, LNG, bunkering, asphalt/bitumen, FPSO/FSO, inland, water or special. A `vesselSubtype` is accepted only with `subtypeSource: "provider"` or `"registry"`, because the legacy collector inferred this field from name/destination. That inference was removed. Vessel name and destination are never classification inputs. Water tankers require an explicit source tanker type; generic service vessels are not assumed to carry water or petroleum.

When no reliable subtype exists, the result is `Other / Unknown Tanker`. Empty categories show zero; they do not imply missing ships are known to exist. A provider/registry adapter must supply real structured subtype/owner data to populate these categories; this task does not invent an enrichment registry.

## Filters, ownership and counts

The right sidebar contains **Vessel Types**, below the existing refinery company control. The parent checkbox selects/clears all supported types; partial selections are indeterminate. Zero-count types remain selectable so that a user's preference also applies when new AIS messages arrive. Mobile uses a collapsible dropdown.

Counts use current received relevant vessels **after company filtering, before type filtering**, across all geography. Owner matching uses the existing owner normalizer and exact normalized string equality; it does not infer vessel ownership from refinery locations, vessel names or destinations. Source `owner`, then `company`, then `operator` is used when it contains a real string. Missing company does not match a selected company. With the current feed, selecting a refinery company therefore hides all ships; a visible explanatory note states why. The existing company list remains a refinery-owner list, not a fabricated shipowner registry.

The normalized GeoJSON properties are `vesselTypeId`, `vesselTypeLabel`, `aisShipType`, `classificationSource`, and `companyKey`. Original `vesselType` is retained for compatibility. Points and histories share the same MapLibre `all` filter (company **AND** selected types). Checkbox updates call `setFilter` on the two existing layers; neither map initialization nor GeoJSON regeneration is required. Memoization keeps normalization/counting out of unrelated renders.

Selections live independently of polling results, so stale/offline and subsequent recovery do not reset them. Reload starts with all types selected. Existing AIS freshness indicators remain visible.

Cards show source/normalized types, MMSI, available company, speed/course and valid position time. Missing fields are omitted; numeric zero is preserved where meaningful. AISStream's Go timestamp with nanosecond precision is converted to a UTC timestamp for both cards and route histories.

## Verification and operation

`npm test` includes subtype/unknown/missing-data coverage, select all/partial selection, company intersection, matching point/history filters, global subscription bounds, every tanker code 80–89, and exclusion of cargo/name-based FPSO guesses. `npm run test:vessel-types` checks the browser against explicitly mocked multi-type data, including outage/recovery and stable MapLibre/source identity. This verifies behavior, not the presence of these detailed types in the live feed.

The frontend normalizes old API responses as well. Restart/redeploy the collector to apply its shared classifier and removal of legacy name guessing; the current working collector was not stopped or replaced during development. Existing AIS credentials are not copied or changed.
