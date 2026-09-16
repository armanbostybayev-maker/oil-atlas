/**
 * @typedef {Object} Tanker
 * @property {string} mmsi
 * @property {string|null} imo
 * @property {string} name
 * @property {string|number} vesselType
 * @property {number} lat
 * @property {number} lon
 * @property {number|null} speed Knots
 * @property {number|null} course Degrees, AIS 360 = unavailable
 * @property {number|null} heading Degrees, AIS 511 = unavailable
 * @property {string|null} destination
 * @property {string} timestamp ISO 8601 UTC
 * @property {Array<{lat:number,lon:number,timestamp:string}>} [history]
 */
const collection = features => ({ type: "FeatureCollection", features });
const coordinate = p => Number.isFinite(p.lon) && Number.isFinite(p.lat) && Math.abs(p.lon) <= 180 && Math.abs(p.lat) <= 90;
export function tankerFeatures(vessels) {
  const points = [], routes = [];
  for (const vessel of vessels) {
    if (!vessel.mmsi || !coordinate(vessel)) continue;
    const validAngle = n => Number.isFinite(n) && n >= 0 && n < 360;
    const direction = validAngle(vessel.heading) ? vessel.heading : validAngle(vessel.course) ? vessel.course : 0;
    points.push({ type: "Feature", geometry: { type: "Point", coordinates: [vessel.lon, vessel.lat] },
      properties: { ...vessel, history: undefined, direction, icon: Number(vessel.speed) > 0.5 ? "tanker-moving" : "tanker-stopped" } });
    const history = [...(vessel.history || [])].filter(p => coordinate(p) && Number.isFinite(Date.parse(p.timestamp)))
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    // Split at the antimeridian instead of drawing a route across the whole world.
    let segment = [];
    const flush = () => { if (segment.length > 1) routes.push({ type: "Feature", properties: { mmsi: vessel.mmsi }, geometry: { type: "LineString", coordinates: segment } }); segment = []; };
    for (const p of history) { if (segment.length && Math.abs(p.lon - segment.at(-1)[0]) > 180) flush(); segment.push([p.lon, p.lat]); }
    flush();
  }
  return { points: collection(points), routes: collection(routes) };
}

// This adapter is intentionally dormant. Only an application-owned backend URL is accepted.
// Provider credentials, authentication and retention belong on the server, never in VITE_*.
export async function loadTankers({ endpoint = "/api/tankers", signal } = {}) {
  const url = new URL(endpoint, location.origin);
  if (url.origin !== location.origin) throw new Error("AIS must use the application backend");
  const response = await fetch(url, { signal, credentials: "same-origin" });
  if (!response.ok) throw new Error(`Tanker API: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.vessels)) throw new Error("Expected { vessels: Tanker[] }");
  return data.vessels;
}

export class TankerLayer {
  constructor(map, { onSelect = () => {} } = {}) {
    this.map = map;
    this.click = e => {
      const feature = map.queryRenderedFeatures(e.point, { layers: ["tankers"] })[0];
      if (feature) onSelect(feature.properties, e.lngLat);
    };
    for (const moving of [true, false]) {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
      const ctx = canvas.getContext("2d"); ctx.fillStyle = moving ? "#d28b35" : "#6c8592"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.beginPath();
      if (moving) { ctx.moveTo(16, 2); ctx.lineTo(26, 27); ctx.lineTo(16, 22); ctx.lineTo(6, 27); ctx.closePath(); }
      else ctx.arc(16, 16, 9, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); map.addImage(moving ? "tanker-moving" : "tanker-stopped", ctx.getImageData(0, 0, 32, 32));
    }
    map.addSource("tankers", { type: "geojson", data: collection([]) });
    map.addSource("tanker-history", { type: "geojson", data: collection([]) });
    map.addLayer({ id: "tanker-history", type: "line", source: "tanker-history", layout: { visibility: "none" }, paint: { "line-color": "#d28b35", "line-width": 2, "line-opacity": 0.7 } });
    map.addLayer({ id: "tankers", type: "symbol", source: "tankers", layout: { visibility: "none", "icon-image": ["get", "icon"], "icon-rotate": ["get", "direction"], "icon-rotation-alignment": "map", "icon-size": 0.8, "icon-allow-overlap": true } });
    map.on("click", this.click);
  }
  setData(vessels) { const data = tankerFeatures(vessels); this.map.getSource("tankers").setData(data.points); this.map.getSource("tanker-history").setData(data.routes); }
  setVisible(visible) { for (const id of ["tankers", "tanker-history"]) this.map.setLayoutProperty(id, "visibility", visible ? "visible" : "none"); }
  destroy() {
    this.map.off("click", this.click);
    for (const id of ["tankers", "tanker-history"]) { if (this.map.getLayer(id)) this.map.removeLayer(id); if (this.map.getSource(id)) this.map.removeSource(id); }
    for (const id of ["tanker-moving", "tanker-stopped"]) if (this.map.hasImage(id)) this.map.removeImage(id);
  }
}
