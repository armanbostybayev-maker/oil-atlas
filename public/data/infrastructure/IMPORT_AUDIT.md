# Pipeline import audit — 2026-09-24

This report describes the user-supplied **prepared ZIP archive**, not the empty placeholder GeoJSON files currently committed in this branch. No production publication has occurred.

| Check | Oil | Gas |
|---|---:|---:|
| Features | 1,468 | 2,933 |
| Geometry | MultiLineString | MultiLineString |
| Coordinate positions | 24,402 | 156,247 |
| Invalid WGS84 coordinate features | 0 | 0 |
| Missing per-record source dates | 0 | 12 |
| Missing source release identifier | 1,468 | 2,933 |
| Largest feature, coordinate positions | 1,862 | 22,433 |

The supplied QGIS metadata identifies EPSG:4326 and describes mapped routes from Global Energy Monitor. It does **not** establish redistribution permission or a dataset release version.

### Accuracy labels as supplied

| Accuracy | Oil | Gas |
|---|---:|---:|
| Very high (within meters) | 172 | 131 |
| High | 365 | 1,040 |
| Medium | 359 | 619 |
| Low | 112 | 424 |
| Very low (straight line/schematic) | 460 | 719 |

### Prepared archive member SHA-256

- Oil: `016d797b9c449181aa5cddb448d356f7fafae3d6523e29c29b9b55403bd61da8`
- Gas: `d9c55f933f02dac119b13718f8601336d83551453286dadf7fa883c44e62838b`

### Release gate

- Verify redistribution permission and required attribution for the exact release.
- Establish dataset release/version, separately from per-feature source dates.
- Retain unknown source dates as unknown.
- Test rendering/performance; one gas feature contains 22,433 coordinate positions, so whole-world GeoJSON may warrant vector tiling.
- Do not merge the empty placeholder files while claiming real global pipeline coverage.
