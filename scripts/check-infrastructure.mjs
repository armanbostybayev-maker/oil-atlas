#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { INFRASTRUCTURE_TYPES, validateInfrastructureCollection } from "../map/InfrastructureLayer.mjs";

const dir = fileURLToPath(new URL("../public/data/infrastructure/", import.meta.url));
const names = {
  oil: "oil-pipelines.geojson", gas: "gas-pipelines.geojson",
  fields: "fields.geojson", processing: "processing.geojson",
  stations: "stations.geojson", storage: "storage.geojson",
};
let failures = 0;
for (const { id, label } of INFRASTRUCTURE_TYPES) {
  try {
    const file = join(dir, names[id]);
    const data = validateInfrastructureCollection(JSON.parse(await readFile(file, "utf8")), id);
    let missing = 0, missingDates = 0, invalid = 0;
    for (const feature of data.features) {
      const p = feature.properties || {};
      if (!p.source || !/^https:\/\//.test(p.source_url || "") || !p.geometry_accuracy) missing++;
      if (!p.source_date && !p.source_release) missingDates++;
      const walk = coordinates => {
        if (!Array.isArray(coordinates) || !coordinates.length) return false;
        if (typeof coordinates[0] === "number") return coordinates.length >= 2 &&
          Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]) &&
          Math.abs(coordinates[0]) <= 180 && Math.abs(coordinates[1]) <= 90;
        return coordinates.every(walk);
      };
      if (!walk(feature.geometry.coordinates)) invalid++;
    }
    console.log(`${label}: ${data.features.length} features; missing provenance: ${missing}; missing record/release dates: ${missingDates}; invalid coordinates: ${invalid}`);
    if (missing || invalid) failures++;
  } catch (error) {
    console.error(`${label}: ${error.message}`);
    failures++;
  }
}
if (failures) process.exitCode = 1;
