import { CLASSES } from "../analytics/config.mjs";
import { finite, quantile } from "../utils/numbers.mjs";
export const PALETTE = [
  "#dcebec",
  "#b7d7d8",
  "#8bbdc4",
  "#5b9daa",
  "#337789",
  "#185568",
];
export function colorScale(values, metric) {
  const numeric = values.filter(finite),
    min = numeric.length ? Math.min(...numeric) : null,
    max = numeric.length ? Math.max(...numeric) : null;
  const diverging =
    ["growth", "inflation"].includes(metric) && min < 0 && max > 0;
  const cuts = [0.2, 0.4, 0.6, 0.8].map((p) => quantile(numeric, p));
  return {
    min,
    max,
    cuts,
    diverging,
    color: (v) =>
      typeof v === "string"
        ? CLASSES[v] || "#dce3e6"
        : !finite(v)
          ? "#e3e7e9"
          : diverging
            ? v < 0
              ? "#bb8070"
              : v === 0
                ? "#e4e8e5"
                : "#69a097"
            : PALETTE[cuts.filter((c) => v > c).length + 1],
  };
}
export const featureCollection = (features) => ({
  type: "FeatureCollection",
  features,
});
export const radiusExpression = [
  "case",
  ["==", ["get", "capacity"], null],
  3,
  [
    "interpolate",
    ["linear"],
    ["sqrt", ["max", 0, ["coalesce", ["get", "capacity"], 0]]],
    0,
    3,
    1000,
    5,
    3162,
    10,
    8000,
    17,
  ],
];
export function makeStyle() {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#edf3f5" },
      },
    ],
  };
}
