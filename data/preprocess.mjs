import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { countryModel, refineryModel } from "./normalize.mjs";
import {
  spatialIndex,
  joinPoint,
  labelPoint,
  bounds,
  polygons,
} from "./spatial.mjs";
const root = fileURLToPath(new URL("../", import.meta.url)),
  source = path.resolve(root, "../refinery/geojson"),
  out = path.join(root, "public/data");
fs.mkdirSync(out, { recursive: true });
const files = [
  "country world.geojsonl",
  "refinary world.geojsonl",
  "country world.qmd",
  "refinary world.qmd",
];
const hash = createHash("sha256");
for (const file of files) hash.update(fs.readFileSync(path.join(source, file)));
for (const file of ["preprocess.mjs", "normalize.mjs", "spatial.mjs"])
  hash.update(fs.readFileSync(new URL(file, import.meta.url)));
hash.update(fs.readFileSync(new URL("../utils/numbers.mjs", import.meta.url)));
const fingerprint = hash.digest("hex");
if (
  fs.existsSync(path.join(out, "manifest.json")) &&
  JSON.parse(fs.readFileSync(path.join(out, "manifest.json"))).fingerprint ===
    fingerprint &&
  ["atlas.json", "countries.geojson"].every((f) =>
    fs.existsSync(path.join(out, f)),
  )
) {
  console.log("Oil Atlas: prepared data is current.");
  process.exit(0);
}
const read = (name) =>
  fs
    .readFileSync(path.join(source, name), "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
const features = read(files[0]);
features.forEach((f) => (f.id = String(f.properties.fid)));
const countries = features.map((f) => ({
  ...countryModel(f),
  center: labelPoint(f.geometry),
  bounds: bounds(polygons(f.geometry).flatMap((p) => p[0])),
}));
const index = spatialIndex(features),
  refineries = read(files[1]).map(refineryModel),
  duplicates = [],
  seen = new Map(),
  invalid = [],
  unmatched = [],
  fallback = [];
for (const r of refineries) {
  const p = r.coordinates;
  r.validCoordinates =
    Array.isArray(p) &&
    p.length >= 2 &&
    p.every(Number.isFinite) &&
    Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) <= 90;
  const key = r.validCoordinates ? p.map((n) => n.toFixed(5)).join(",") : r.id;
  if (seen.has(key))
    duplicates.push({
      id: r.id,
      other: seen.get(key),
      reason: "same coordinates within 5 decimals; retained for review",
    });
  else seen.set(key, r.id);
  const join = r.validCoordinates
    ? joinPoint(p, index)
    : { country: null, method: "invalid coordinates" };
  Object.assign(r, join);
  if (!r.validCoordinates) invalid.push(r.id);
  if (!r.country)
    unmatched.push({ id: r.id, name: r.name, coordinates: p, ...join });
  if (join.method === "coastal fallback")
    fallback.push({ id: r.id, name: r.name, ...join });
}
const names = new Map();
for (const r of refineries) {
  const key = r.name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (names.has(key))
    duplicates.push({
      id: r.id,
      other: names.get(key),
      reason: "same normalized official name; retained for review",
    });
  else names.set(key, r.id);
}
const possibleSharedCapacity = [];
for (let i = 0; i < refineries.length; i++)
  for (let j = i + 1; j < refineries.length; j++) {
    const a = refineries[i],
      b = refineries[j];
    if (
      !a.validCoordinates ||
      !b.validCoordinates ||
      !a.owner ||
      a.owner !== b.owner ||
      a.capacity === null ||
      a.capacity <= 0 ||
      a.capacity !== b.capacity
    )
      continue;
    const km = Math.hypot(
      (a.coordinates[0] - b.coordinates[0]) *
        111.32 *
        Math.cos((a.coordinates[1] * Math.PI) / 180),
      (a.coordinates[1] - b.coordinates[1]) * 110.57,
    );
    const complexA = a.name.split("—")[0].trim(),
      complexB = b.name.split("—")[0].trim();
    const sameComplex =
      a.name.includes("—") &&
      b.name.includes("—") &&
      complexA.length > 12 &&
      complexA === complexB;
    if (km <= 150 || sameComplex)
      possibleSharedCapacity.push({
        id: a.id,
        other: b.id,
        names: [a.name, b.name],
        distanceKm: km,
        capacity: a.capacity,
        reason: sameComplex
          ? "same named complex, owner and capacity; review shared total and coordinates"
          : "same owner and capacity within 150 km; may describe a shared complex total",
      });
  }
for (const pair of [...duplicates, ...possibleSharedCapacity])
  for (const r of refineries)
    if (r.id === pair.id || r.id === pair.other) r.duplicateWarning = true;
const quality = {
  totalRefineries: refineries.length,
  countryRecords: countries.length,
  matched: refineries.filter((r) => r.country).length,
  unmatched,
  coastalFallback: fallback,
  invalidCoordinates: invalid,
  duplicateCandidates: duplicates,
  possibleSharedCapacity,
  missingCapacity: refineries.filter((r) => r.capacity === null).length,
  missingOwner: refineries.filter((r) => !r.owner).length,
  missingStatus: refineries.filter((r) => r.status === "Unknown").length,
  missingAge: refineries.filter((r) => r.age === null).length,
  statusConflicts: refineries
    .filter((r) => r.statusConflict)
    .map((r) => ({
      id: r.id,
      name: r.name,
      status: r.rawStatus,
      details: r.raw["Статус на 2026 г."],
    })),
  unrecognizedStatuses: [
    ...new Set(
      refineries
        .filter((r) => r.status === "Unknown" && r.rawStatus !== "неизвестно")
        .map((r) => r.rawStatus),
    ),
  ],
  priceRecords: countries.filter((c) =>
    Object.keys(c.values).some(
      (k) => k.endsWith("Price") && c.values[k] !== null,
    ),
  ).length,
};
fs.writeFileSync(
  path.join(out, "atlas.json"),
  JSON.stringify({ countries, refineries, quality }),
);
fs.writeFileSync(
  path.join(out, "countries.geojson"),
  JSON.stringify({
    type: "FeatureCollection",
    features: features.map((f) => ({
      ...f,
      properties: { id: f.id, name: f.properties.NAME_EN },
    })),
  }),
);
fs.writeFileSync(
  path.join(out, "quality.json"),
  JSON.stringify(quality, null, 2),
);
fs.writeFileSync(
  path.join(out, "manifest.json"),
  JSON.stringify(
    {
      fingerprint,
      sources: files,
      crs: "EPSG:4326",
      joinToleranceKm: 5,
      ambiguityMarginKm: 1,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      ...quality,
      unmatched: unmatched.length,
      coastalFallback: fallback.length,
      statusConflicts: quality.statusConflicts.length,
      duplicateCandidates: duplicates.length,
    },
    null,
    2,
  ),
);
