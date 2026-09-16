import { MODES, ANOMALIES } from "../analytics/config.mjs";
export const defaults = {
  mode: "overview",
  metric: "capacity",
  country: "",
  owner: "",
  status: "",
  basemap: "atlas",
  anomaly: ANOMALIES[0],
  priceUnit: "",
};
export function readState() {
  const p = new URLSearchParams(location.search),
    s = { ...defaults };
  for (const k of Object.keys(s)) if (p.has(k)) s[k] = p.get(k);
  if (!MODES[s.mode] && s.mode !== "none") s.mode = "overview";
  const mode = MODES[s.mode] || MODES.overview;
  if (!mode.metrics.some((m) => m.id === s.metric))
    s.metric = mode.metrics[0].id;
  if (
    !["atlas", "osm", "positron", "dark", "satellite", "topo"].includes(
      s.basemap,
    )
  )
    s.basemap = "atlas";
  if (!["", "Active", "Closed", "Modernization", "Unknown"].includes(s.status))
    s.status = "";
  if (!ANOMALIES.includes(s.anomaly)) s.anomaly = ANOMALIES[0];
  return s;
}
export function writeState(s) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(s))
    if (v && v !== defaults[k]) p.set(k, v);
  history.replaceState(
    null,
    "",
    location.pathname + (p.size ? "?" + p : "") + location.hash,
  );
}
