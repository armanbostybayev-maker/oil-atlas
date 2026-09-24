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

import { normalizeCollection } from "../scripts/import-infrastructure.mjs";
const metadata = { type: "oil", source: "Test source", sourceUrl: "https://example.org/data", release: "2026-09", accuracy: "approximate" };
test("import preserves geometry and provenance and normalizes fields", () => {
  const result = normalizeCollection({ type: "FeatureCollection", features: [{
    type: "Feature", geometry: { type: "LineString", coordinates: [[1, 2], [3, 4]] },
    properties: { "Pipeline Name": "Example", "Length (km)": "12.5", "GEM ID": "a" }
  }] }, metadata);
  assert.equal(result.features[0].properties.name, "Example");
  assert.equal(result.features[0].properties.length_km, 12.5);
  assert.equal(result.features[0].properties.source, "Test source");
  assert.equal(result.features[0].properties.geometry_accuracy, "approximate");
});
test("import rejects invalid geographic coordinates", () => {
  assert.throws(() => normalizeCollection({ type: "FeatureCollection", features: [{
    type: "Feature", geometry: { type: "LineString", coordinates: [[181, 2], [3, 4]] }, properties: {}
  }] }, metadata), /Invalid WGS84/);
});
