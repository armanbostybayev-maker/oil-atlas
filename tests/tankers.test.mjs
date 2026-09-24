import test from "node:test";
import assert from "node:assert/strict";
import { tankerFeatures } from "../map/TankerLayer.mjs";
test("Tanker preparation rejects invalid coordinates, handles unavailable AIS heading and antimeridian history", () => {
  const { points, routes } = tankerFeatures([
    { mmsi:"123456789",lat:20,lon:179,heading:511,course:90,speed:10,history:[
      {lat:20,lon:178,timestamp:'2026-01-01T00:00:00Z'},
      {lat:20,lon:179,timestamp:'2026-01-01T02:00:00Z'},
      {lat:20,lon:-179,timestamp:'2026-01-01T04:00:00Z'},
      {lat:20,lon:-178,timestamp:'2026-01-01T06:00:00Z'},
    ] }, {mmsi:'bad',lat:95,lon:0},
  ]);
  assert.equal(points.features.length,1);
  assert.equal(points.features[0].properties.direction,90);
  assert.equal(routes.features.length,2);
});
