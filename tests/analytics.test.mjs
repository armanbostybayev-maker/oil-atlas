import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { number, ratio } from "../utils/numbers.mjs";
import {
  ageValue,
  refineryModel,
  TONNES_YEAR_TO_BPD,
} from "../data/normalize.mjs";
import {
  aggregate,
  createAnalytics,
  metricValue,
} from "../analytics/atlas.mjs";
import { joinPoint, spatialIndex } from "../data/spatial.mjs";
test("numeric normalization distinguishes missing, zero and textual uncertainty", () => {
  assert.equal(number(null), null);
  assert.equal(number(""), null);
  assert.equal(number("0"), 0);
  assert.equal(number("1 633 240.00"), 1633240);
  assert.equal(number("6,473"), 6.473);
  assert.equal(number("1\u00a0396.30"), 1396.3);
  assert.equal(number("~300"), null);
  assert.equal(number("12%"), 12);
  assert.equal(ratio(10, 0), null);
  assert.equal(ratio(null, 20), null);
});
test("age keeps a reported lifetime but rejects corporate age and approximation", () => {
  assert.equal(ageValue("91 год (с 1935; действует)"), 91);
  assert.equal(ageValue("50 лет работы (1965–2015)"), 50);
  assert.equal(ageValue("Около 66 лет"), null);
  assert.equal(ageValue("42 года с даты учреждения юрлица"), null);
  assert.equal(ageValue("Нет достоверных данных"), null);
});
test("capacity fallback uses only unambiguous numeric fields", () => {
  const r = refineryModel({
    properties: { "Мощность переработки, т/год": "3 750 000" },
    geometry: { type: "Point", coordinates: [0, 0] },
  });
  assert.equal(r.capacity, 3750000);
  assert.ok(Math.abs(r.capacityBpd - (3750000 * 7.33) / 365) < 1e-8);
});
test("incomplete inventories do not invent national totals or concentration", () => {
  const a = aggregate([
    { capacity: 10, status: "Active", age: 50 },
    { capacity: null, status: "Unknown", age: null },
  ]);
  assert.equal(a.capacity, 0.00001);
  assert.equal(a.completeCapacity, false);
  assert.equal(a.average, null);
  assert.equal(a.hhi, null);
  assert.equal(a.knownAge, 1);
  assert.equal(aggregate([]).capacity, null);
  const b = aggregate([{ capacity: 10 }, { capacity: 10 }]);
  assert.equal(b.hhi, 5000);
  assert.equal(b.largestShare, 50);
});
const box = (id, x) => ({
  id,
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [x, 0],
        [x + 0.1, 0],
        [x + 0.1, 0.1],
        [x, 0.1],
        [x, 0],
      ],
    ],
  },
});
test("spatial join accepts interiors/coasts and rejects distant or ambiguous matches", () => {
  const index = spatialIndex([box("a", 0), box("b", 0.14)]);
  assert.equal(joinPoint([0.05, 0.05], index).country, "a");
  assert.equal(joinPoint([-0.01, 0.05], index).method, "coastal fallback");
  assert.equal(joinPoint([0.12, 0.05], index).country, null);
  assert.equal(joinPoint([5, 5], index).country, null);
});
test("polygon holes are excluded", () => {
  const f = box("a", 0);
  f.geometry.coordinates.push([
    [0.03, 0.03],
    [0.07, 0.03],
    [0.07, 0.07],
    [0.03, 0.07],
    [0.03, 0.03],
  ]);
  assert.equal(joinPoint([0.05, 0.05], spatialIndex([f]), 0).country, null);
});
test("duplicate warnings and zero denominators suppress derived certainty", () => {
  const a = aggregate([{ capacity: 10, duplicateWarning: true }]);
  assert.equal(a.completeCapacity, false);
  assert.equal(a.hhi, null);
  assert.equal(aggregate([{ capacity: 0 }]).largestShare, null);
  assert.equal(
    metricValue({ count: 0 }, { mode: "status", metric: "statusShare" }, []),
    null,
  );
});
test("real dataset conservation and missing price coverage", () => {
  const data = JSON.parse(
      fs.readFileSync(new URL("../public/data/atlas.json", import.meta.url)),
    ),
    a = createAnalytics(data);
  assert.equal(data.refineries.length, 658);
  assert.equal(data.quality.matched + data.quality.unmatched.length, 658);
  assert.equal(
    a.stats.reduce((s, c) => s + c.count, 0),
    data.quality.matched,
  );
  const matched = data.refineries
    .filter((r) => r.country && r.capacity !== null)
    .reduce((s, r) => s + r.capacity, 0);
  assert.ok(
    Math.abs(
      a.stats.reduce((s, c) => s + (c.capacity ?? 0) * 1e6, 0) - matched,
    ) < 0.01,
  );
  assert.equal(
    a.getDataCoverage("gasolinePrice").known,
    a.stats.filter((c) => Number.isFinite(c.gasolinePrice)).length,
  );
  for (const c of a.stats) {
    if (!c.completeCapacity) assert.equal(c.rcRatio, null);
    if (c.completeCapacity && c.consumption > 0)
      assert.ok(
        Math.abs(
          c.rcRatio - (c.capacity * 1e6 * TONNES_YEAR_TO_BPD) / c.consumption,
        ) < 1e-8,
      );
    assert.equal(
      metricValue(
        c,
        { mode: "prices", metric: "gasolinePrice", priceUnit: "" },
        [],
      ),
      null,
    );
  }
});
