/**
 * Oil Atlas infrastructure overlays.
 * Public, approximate routes only. Data is supplied as GeoJSON FeatureCollections.
 * A layer can be enabled without a dataset; the UI will report no records.
 */
export const INFRASTRUCTURE_TYPES = [
  { id: "oil", label: "Oil pipelines", color: "#ed963b", path: "/data/infrastructure/oil-pipelines.geojson", geometry: "line" },
  { id: "gas", label: "Gas pipelines", color: "#398fda", path: "/data/infrastructure/gas-pipelines.geojson", geometry: "line" },
  { id: "fields", label: "Oil & gas fields", color: "#439963", path: "/data/infrastructure/fields.geojson", geometry: "point" },
  { id: "processing", label: "Processing facilities", color: "#956bd1", path: "/data/infrastructure/processing.geojson", geometry: "point" },
  { id: "stations", label: "Pipeline stations", color: "#c5a12f", path: "/data/infrastructure/stations.geojson", geometry: "point" },
  { id: "storage", label: "Storage & terminals", color: "#d66b9d", path: "/data/infrastructure/storage.geojson", geometry: "point" },
];
export const defaultInfrastructureVisibility = () => Object.fromEntries(
  INFRASTRUCTURE_TYPES.map(({ id }) => [id, false]),
);
export const emptyCollection = () => ({ type: "FeatureCollection", features: [] });
const safeValue = (value) => value == null || value === "" ? "—" : String(value);

export function validateInfrastructureCollection(data, type) {
  if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error(`${type}: expected GeoJSON FeatureCollection`);
  }
  const expected = INFRASTRUCTURE_TYPES.find(({ id }) => id === type)?.geometry;
  if (!expected) throw new Error(`Unknown infrastructure type: ${type}`);
  const valid = expected === "line" ? ["LineString", "MultiLineString"] : ["Point", "MultiPoint"];
  for (const feature of data.features) {
    if (feature?.type !== "Feature" || !valid.includes(feature.geometry?.type) || !feature.geometry.coordinates) {
      throw new Error(`${type}: unsupported feature geometry`);
    }
  }
  return data;
}

export function createInfrastructureCard(type, properties = {}) {
  const element = document.createElement("div");
  element.className = "infrastructure-popup";
  const heading = document.createElement("strong");
  heading.textContent = safeValue(properties.name);
  element.append(heading);
  const category = INFRASTRUCTURE_TYPES.find(item => item.id === type);
  const fields = [
    ["Type", properties.product || category?.label],
    ["Operator", properties.operator],
    ["Status", properties.status],
    ["Length", properties.length_km == null ? null : `${properties.length_km} km`],
    ["Capacity", properties.capacity],
    ["Route accuracy", properties.geometry_accuracy || "Not specified"],
    ["Source", properties.source],
    ["Source date", properties.source_date],
  ];
  for (const [label, value] of fields) {
    if (value == null || value === "") continue;
    const row = document.createElement("div");
    row.textContent = `${label}: ${safeValue(value)}`;
    element.append(row);
  }
  if (typeof properties.source_url === "string" && /^https:\/\//i.test(properties.source_url)) {
    const link = document.createElement("a");
    link.href = properties.source_url;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    link.textContent = "Open source";
    element.append(link);
  }
  return element;
}

export class InfrastructureLayer {
  constructor(map, { onSelect = () => {}, onCounts = () => {}, onError = () => {} } = {}) {
    this.map = map;
    this.onSelect = onSelect;
    this.onCounts = onCounts;
    this.onError = onError;
    this.visible = defaultInfrastructureVisibility();
    this.loaded = new Set();
    this.pending = new Map();
    this.counts = Object.fromEntries(INFRASTRUCTURE_TYPES.map(({ id }) => [id, null]));
    this.abort = new AbortController();
    for (const item of INFRASTRUCTURE_TYPES) {
      const source = `infrastructure-${item.id}`;
      const layer = `${source}-layer`;
      map.addSource(source, { type: "geojson", data: emptyCollection() });
      if (item.geometry === "line") {
        map.addLayer({
          id: layer, type: "line", source,
          layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": item.color,
            "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1, 5, 2, 10, 4],
            "line-opacity": 0.88,
          },
        });
      } else {
        map.addLayer({
          id: layer, type: "circle", source,
          layout: { visibility: "none" },
          paint: { "circle-color": item.color, "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3, 7, 7], "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-opacity": 0.9 },
        });
      }
    }
    this.click = event => {
      const layers = INFRASTRUCTURE_TYPES.filter(item => this.visible[item.id]).map(item => `infrastructure-${item.id}-layer`);
      if (!layers.length) return;
      const hit = map.queryRenderedFeatures(event.point, { layers })[0];
      if (!hit) return;
      this.onSelect(hit, event.lngLat, hit.layer.id.replace("infrastructure-", "").replace("-layer", ""));
    };
    map.on("click", this.click);
  }

  async setVisible(type, enabled) {
    const item = INFRASTRUCTURE_TYPES.find(({ id }) => id === type);
    if (!item) return;
    this.visible[type] = Boolean(enabled);
    this.map.setLayoutProperty(`infrastructure-${type}-layer`, "visibility", enabled ? "visible" : "none");
    if (!enabled || this.loaded.has(type)) return;
    if (this.pending.has(type)) return this.pending.get(type);
    const request = (async () => {
      try {
        const response = await fetch(item.path, { signal: this.abort.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = validateInfrastructureCollection(await response.json(), type);
        if (this.abort.signal.aborted) return;
        this.map.getSource(`infrastructure-${type}`)?.setData(data);
        this.counts[type] = data.features.length;
        this.loaded.add(type);
        this.onCounts({ ...this.counts });
      } catch (error) {
        if (error.name !== "AbortError") this.onError(`${item.label}: ${error.message}`);
      } finally {
        this.pending.delete(type);
      }
    })();
    this.pending.set(type, request);
    return request;
  }

  destroy() {
    this.abort.abort();
    this.map.off("click", this.click);
    for (const item of [...INFRASTRUCTURE_TYPES].reverse()) {
      const id = `infrastructure-${item.id}`;
      if (this.map.getLayer(`${id}-layer`)) this.map.removeLayer(`${id}-layer`);
      if (this.map.getSource(id)) this.map.removeSource(id);
    }
  }
}
