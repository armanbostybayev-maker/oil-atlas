// Duplicate rules retained from the original GIS preprocessing.
export function calculateQuality(countries, refineries) {
const duplicates = [], unmatched = [], fallback = [], invalid = [], seen = new Map();
for (const r of refineries) {
  delete r.duplicateWarning;
  const p = r.coordinates;
  r.validCoordinates = Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
  if (!r.validCoordinates) invalid.push(r.id);
  else {
    const key = p.map(n => n.toFixed(5)).join(',');
    if (seen.has(key)) duplicates.push({id:r.id, other:seen.get(key), reason:'same coordinates within 5 decimals; retained for review'});
    else seen.set(key, r.id);
  }
  if (!r.country) unmatched.push({id:r.id, name:r.name, coordinates:p, country:null, method:r.method, ...(r.candidates ? {candidates:r.candidates} : {})});
  if (r.method === 'coastal fallback') fallback.push({id:r.id, name:r.name, country:r.country, method:r.method, distanceKm:r.distanceKm});
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

return quality;
}
