import test from "node:test";
import assert from "node:assert/strict";
import { INFRASTRUCTURE_TYPES, defaultInfrastructureVisibility, validateInfrastructureCollection, emptyCollection } from "../map/InfrastructureLayer.mjs";

test("six independent infrastructure groups start hidden", () => {
  assert.equal(INFRASTRUCTURE_TYPES.length, 6);
  assert.deepEqual(Object.values(defaultInfrastructureVisibility()), Array(6).fill(false));
});
test("empty GeoJSON is valid for every group", () => {
  for (const { id } of INFRASTRUCTURE_TYPES) assert.equal(validateInfrastructureCollection(emptyCollection(), id).features.length, 0);
});
test("pipeline geometry must be linear", () => {
  assert.throws(() => validateInfrastructureCollection({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [0,0] }, properties: {} }] }, "oil"));
});
test("facility geometry must be point-based", () => {
  assert.throws(() => validateInfrastructureCollection({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[0,0],[1,1]] }, properties: {} }] }, "stations"));
});
