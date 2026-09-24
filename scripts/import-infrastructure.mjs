#!/usr/bin/env node
/**
 * Import an independently obtained, licensed GeoJSON file into an Oil Atlas
 * infrastructure layer. No synthetic geometry, geocoding or route interpolation.
 *
 * node scripts/import-infrastructure.mjs --type oil --input /path/routes.geojson \
 *   --source "Global Oil Infrastructure Tracker, Global Energy Monitor" \
 *   --source-url https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/ \
 *   --release 2026-06 --accuracy approximate
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INFRASTRUCTURE_TYPES, validateInfrastructureCollection } from "../map/InfrastructureLayer.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const outputDir = join(root, "public/data/infrastructure");
const outputNames = {
  oil: "oil-pipelines.geojson", gas: "gas-pipelines.geojson",
  fields: "fields.geojson", processing: "processing.geojson",
  stations: "stations.geojson", storage: "storage.geojson",
};
const alias = {
  name: ["name", "Pipeline Name", "Pipeline name", "Project", "Project Name", "project_name"],
  operator: ["operator", "Operator", "Owner", "owner"],
  status: ["status", "Status"],
  product: ["product", "fuel", "Product", "Fuel"],
  length_km: ["length_km", "Length (km)", "Length (Km)", "Length"],
  capacity: ["capacity", "Capacity"],
  geometry_accuracy: ["geometry_accuracy", "route_accuracy", "Route accuracy", "Route Accuracy"],
  id: ["id", "source_id", "ID", "GEM ID", "GEM_ID", "gem_id"],
  countries: ["countries", "Countries"],
};
function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i]?.startsWith("--") || !args[i + 1]) throw new Error("Expected --key value pairs");
    result[args[i].slice(2)] = args[i + 1];
  }
  return result;
}
function first(obj, keys) {
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  return null;
}
function checkCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || !coordinates.length) throw new Error("Empty coordinates");
  if (typeof coordinates[0] === "number") {
    if (coordinates.length < 2 || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) ||
        Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) throw new Error("Invalid WGS84 coordinate");
    return;
  }
  for (const child of coordinates) checkCoordinates(child);
}
export function normalizeCollection(data, { type, source, sourceUrl, release, accuracy }) {
  validateInfrastructureCollection(data, type);
  if (!source || !/^https:\/\//.test(sourceUrl || "") || !release) throw new Error("Source, HTTPS source URL and release are required");
  const features = [];
  for (const feature of data.features) {
    checkCoordinates(feature.geometry.coordinates);
    const input = feature.properties || {};
    const props = Object.fromEntries(Object.entries(alias).map(([key, keys]) => [key, first(input, keys)]));
    const id = props.id == null ? null : String(props.id);
    // A project may have multiple route segments sharing one project ID.
    // Preserve every segment and retain the source ID in properties.
    const length = Number(props.length_km);
    props.length_km = props.length_km != null && Number.isFinite(length) && length >= 0 ? length : null;
    props.geometry_accuracy = props.geometry_accuracy || accuracy || "unknown";
    props.source = source;
    props.source_url = /^https:\/\//.test(input.source_url || "") ? input.source_url : sourceUrl;
    // Record-level source date and dataset release are different metadata.
    props.source_date = input.source_date || null;
    props.source_release = release;
    features.push({ type: "Feature", geometry: feature.geometry, properties: props });
  }
  return { type: "FeatureCollection", features };
}
async function main() {
  const args = options(process.argv.slice(2));
  if (!outputNames[args.type]) throw new Error("Use --type " + INFRASTRUCTURE_TYPES.map(x => x.id).join("|"));
  if (!args.input) throw new Error("--input is required");
  const data = JSON.parse(await readFile(resolve(args.input), "utf8"));
  const normalized = normalizeCollection(data, {
    type: args.type, source: args.source, sourceUrl: args["source-url"],
    release: args.release, accuracy: args.accuracy,
  });
  await mkdir(outputDir, { recursive: true });
  const output = join(outputDir, outputNames[args.type]);
  await writeFile(output, JSON.stringify(normalized) + "\n");
  process.stdout.write(`Imported ${normalized.features.length} ${args.type} features to ${output}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
