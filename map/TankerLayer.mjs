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

import { ALL_VESSEL_TYPES, vesselMapFilter, vesselCompanyKey } from './vessel-types.mjs';
import { parseAisTimestamp } from './ais-time.mjs';
const collection = features => ({
  type: "FeatureCollection",
  features
});

const coordinate = p =>
  Number.isFinite(p.lon) &&
  Number.isFinite(p.lat) &&
  Math.abs(p.lon) <= 180 &&
  Math.abs(p.lat) <= 90;

const distanceNm = (a, b) => {
  const toRad = degrees => degrees * Math.PI / 180;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLon = toRad(b.lon - a.lon);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  const safeH = Math.min(1, Math.max(0, h));

  const km =
    6371 *
    2 *
    Math.atan2(
      Math.sqrt(safeH),
      Math.sqrt(1 - safeH)
    );

  return km / 1.852;
};

export function tankerFeatures(vessels) {
  const points = [];
  const routes = [];

  for (const vessel of vessels) {
    if (!vessel.mmsi || !coordinate(vessel)) continue;

    const validAngle = n =>
      Number.isFinite(n) && n >= 0 && n < 360;

    const direction = validAngle(vessel.heading)
      ? vessel.heading
      : validAngle(vessel.course)
        ? vessel.course
        : 0;

    points.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [vessel.lon, vessel.lat]
      },
      properties: {
        ...vessel,
        history: undefined,
        companyKey: vesselCompanyKey(vessel),
        direction,
        icon:
          Number(vessel.speed) > 0.5
            ? "tanker-moving"
            : "tanker-stopped"
      }
    });

    const history = [...(vessel.history || [])]
      .filter(
        p =>
          coordinate(p) &&
          parseAisTimestamp(p.timestamp) !== null
      )
      .sort(
        (a, b) =>
          parseAisTimestamp(a.timestamp) -
          parseAisTimestamp(b.timestamp)
      );

    let segment = [];
    let previousPoint = null;

    const flush = () => {
      if (segment.length > 1) {
        routes.push({
          type: "Feature",
          properties: {
            mmsi: vessel.mmsi,
            vesselTypeId:vessel.vesselTypeId,
            companyKey:vesselCompanyKey(vessel),
          },
          geometry: {
            type: "LineString",
            coordinates: segment
          }
        });
      }

      segment = [];
    };

    for (const p of history) {
      if (previousPoint) {
        const previousTime =
          parseAisTimestamp(previousPoint.timestamp);

        const currentTime =
          parseAisTimestamp(p.timestamp);

        const hours =
          (currentTime - previousTime) / 3600000;

        const distance =
          distanceNm(previousPoint, p);

        const crossesAntimeridian =
          Math.abs(p.lon - previousPoint.lon) > 180;

        // A tanker cannot realistically cover more than
        // roughly 45 nautical miles per hour.
        // The 15 NM minimum tolerance prevents harmless
        // AIS timing/position noise from breaking the track.
        const impossibleJump =
          hours <= 0 ||
          distance > Math.max(15, hours * 45);

        if (
          crossesAntimeridian ||
          impossibleJump
        ) {
          flush();
        }
      }

      segment.push([p.lon, p.lat]);
      previousPoint = p;
    }

    flush();
  }

  return {
    points: collection(points),
    routes: collection(routes)
  };
}

// Only an application-owned backend URL is accepted.
// Provider credentials, authentication and retention
// stay on the server.
export async function loadTankerSnapshot({
  endpoint = "/api/tankers",
  signal
} = {}) {
  const url = new URL(endpoint, location.origin);

  if (url.origin !== location.origin) {
    throw new Error(
      "AIS must use the application backend"
    );
  }

  const response = await fetch(url, {
    signal,
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(
      `Tanker API: ${response.status}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data.vessels)) {
    throw new Error(
      "Expected { vessels: Tanker[] }"
    );
  }

  return data;
}

// Preserve the original public helper for integrations expecting an array.
export async function loadTankers(options) {
  return (await loadTankerSnapshot(options)).vessels;
}

export class TankerLayer {
  constructor(
    map,
    { onSelect = () => {} } = {}
  ) {
    this.map = map;

    this.click = e => {
      const feature = map.queryRenderedFeatures(
        e.point,
        {
          layers: ["tankers"]
        }
      )[0];

      if (feature) {
        onSelect(
          feature.properties,
          e.lngLat
        );
      }
    };

    for (const moving of [true, false]) {
      const canvas =
        document.createElement("canvas");

      canvas.width = 32;
      canvas.height = 32;

      const ctx = canvas.getContext("2d");

      ctx.fillStyle = moving
        ? "#e32636"
        : "#b51f2e";

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;

      ctx.beginPath();

      if (moving) {
        ctx.moveTo(16, 2);
        ctx.lineTo(26, 27);
        ctx.lineTo(16, 22);
        ctx.lineTo(6, 27);
        ctx.closePath();
      } else {
        ctx.arc(
          16,
          16,
          9,
          0,
          Math.PI * 2
        );
      }

      ctx.fill();
      ctx.stroke();

      map.addImage(
        moving
          ? "tanker-moving"
          : "tanker-stopped",
        ctx.getImageData(
          0,
          0,
          32,
          32
        )
      );
    }

    map.addSource("tankers", {
      type: "geojson",
      data: collection([])
    });

    map.addSource("tanker-history", {
      type: "geojson",
      data: collection([])
    });

    map.addLayer({
      id: "tanker-history",
      type: "line",
      source: "tanker-history",
      layout: {
        visibility: "none"
      },
      paint: {
        "line-color": "#e32636",
        "line-width": 2,
        "line-opacity": 0.7
      }
    });

    map.addLayer({
      id: "tankers",
      type: "symbol",
      source: "tankers",
      layout: {
        visibility: "none",
        "icon-image": ["get", "icon"],
        "icon-rotate": ["get", "direction"],
        "icon-rotation-alignment": "map",
        "icon-size": 0.8,
        "icon-allow-overlap": true
      }
    });

    map.on("click", this.click);
  }

  setData(vessels) {
    const data = tankerFeatures(vessels);

    this.map
      .getSource("tankers")
      .setData(data.points);

    this.map
      .getSource("tanker-history")
      .setData(data.routes);
  }

  setVisible(visible) {
    for (const id of [
      "tankers",
      "tanker-history"
    ]) {
      this.map.setLayoutProperty(
        id,
        "visibility",
        visible ? "visible" : "none"
      );
    }
  }

  setFilter(selected = ALL_VESSEL_TYPES, company = '') {
    const filter = vesselMapFilter(selected,company);
    for (const id of ['tankers','tanker-history']) this.map.setFilter(id,filter);
  }

  destroy() {
    this.map.off("click", this.click);

    for (const id of [
      "tankers",
      "tanker-history"
    ]) {
      if (this.map.getLayer(id)) {
        this.map.removeLayer(id);
      }

      if (this.map.getSource(id)) {
        this.map.removeSource(id);
      }
    }

    for (const id of [
      "tanker-moving",
      "tanker-stopped"
    ]) {
      if (this.map.hasImage(id)) {
        this.map.removeImage(id);
      }
    }
  }
}
