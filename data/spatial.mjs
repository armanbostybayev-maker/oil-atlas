// Full-resolution WGS84 geometry is used for joining. Rendering is separate.
export const polygons = (g) =>
  g.type === "Polygon" ? [g.coordinates] : g.coordinates;
export function ringContains([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
export const contains = (p, poly) =>
  ringContains(p, poly[0]) && !poly.slice(1).some((r) => ringContains(p, r));
export function bounds(ring) {
  return ring.reduce(
    (b, p) => [
      Math.min(b[0], p[0]),
      Math.min(b[1], p[1]),
      Math.max(b[2], p[0]),
      Math.max(b[3], p[1]),
    ],
    [180, 90, -180, -90],
  );
}
export function segmentDistance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function spatialIndex(countries) {
  return countries.flatMap((c) =>
    polygons(c.geometry).map((poly) => ({
      id: c.id,
      poly,
      bbox: bounds(poly[0]),
    })),
  );
}
export function joinPoint(p, index, maxKm = 5) {
  const inside = new Set(
    index
      .filter(
        (x) =>
          p[0] >= x.bbox[0] &&
          p[0] <= x.bbox[2] &&
          p[1] >= x.bbox[1] &&
          p[1] <= x.bbox[3] &&
          contains(p, x.poly),
      )
      .map((x) => x.id),
  );
  if (inside.size === 1)
    return { country: [...inside][0], method: "inside", distanceKm: 0 };
  if (inside.size > 1)
    return {
      country: null,
      method: "ambiguous overlap",
      candidates: [...inside],
    };
  const cos = Math.max(0.01, Math.cos((p[1] * Math.PI) / 180)),
    dx = maxKm / (111.32 * cos),
    dy = maxKm / 110.57,
    distances = new Map();
  const project = ([x, y]) => [(x - p[0]) * 111.32 * cos, (y - p[1]) * 110.57];
  for (const entry of index) {
    const b = entry.bbox;
    if (
      p[0] < b[0] - dx ||
      p[0] > b[2] + dx ||
      p[1] < b[1] - dy ||
      p[1] > b[3] + dy
    )
      continue;
    let d = Infinity;
    for (const ring of entry.poly)
      for (let i = 1; i < ring.length; i++)
        d = Math.min(
          d,
          segmentDistance([0, 0], project(ring[i - 1]), project(ring[i])),
        );
    distances.set(entry.id, Math.min(distances.get(entry.id) ?? Infinity, d));
  }
  const candidates = [...distances].sort((a, b) => a[1] - b[1]);
  if (
    candidates[0]?.[1] <= maxKm &&
    (!candidates[1] || candidates[1][1] - candidates[0][1] >= 1)
  )
    return {
      country: candidates[0][0],
      method: "coastal fallback",
      distanceKm: candidates[0][1],
    };
  return {
    country: null,
    method:
      candidates[0]?.[1] <= maxKm ? "ambiguous coast" : "outside tolerance",
    candidates,
  };
}
export function labelPoint(geometry) {
  const poly = polygons(geometry).sort((a, b) => {
    const x = bounds(a[0]),
      y = bounds(b[0]);
    return (y[2] - y[0]) * (y[3] - y[1]) - (x[2] - x[0]) * (x[3] - x[1]);
  })[0];
  const b = bounds(poly[0]),
    center = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  if (contains(center, poly)) return center;
  for (let y = 1; y < 20; y++)
    for (let x = 1; x < 20; x++) {
      const p = [
        b[0] + ((b[2] - b[0]) * x) / 20,
        b[1] + ((b[3] - b[1]) * y) / 20,
      ];
      if (contains(p, poly)) return p;
    }
  return poly[0][0];
}
