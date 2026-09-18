const TANKERMAP_URL = "https://tankermap.com/api/vessels/live";

const numberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const textOrNull = (value) =>
  value === null || value === undefined || value === "" ? null : String(value);

function normalizeVessel(v) {
  const lat = numberOrNull(v.latitude);
  const lon = numberOrNull(v.longitude);

  if (lat === null || lon === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return {
    vesselId: v.vessel_id,
    mmsi: textOrNull(v.mmsi),
    imo: textOrNull(v.imo),
    name: textOrNull(v.name) || "Unknown tanker",
    flag: textOrNull(v.flag),

    vesselType: textOrNull(v.vessel_type) || "Tanker",
    vesselTypeName: textOrNull(v.vessel_type) || "Tanker",
    vesselSubtype: textOrNull(v.vessel_type) || "Tanker",

    lat,
    lon,
    speed: numberOrNull(v.speed_knots),
    course: numberOrNull(v.cog_degrees),
    heading: null,
    draught: numberOrNull(v.draught_meters),

    status: textOrNull(v.nav_status),
    destination: textOrNull(v.destination),
    timestamp: textOrNull(v.observed_at) || new Date().toISOString(),

    deadweight: numberOrNull(v.deadweight),
    cargoState: textOrNull(v.cargo_state),
    cargoStateConfidence: numberOrNull(v.cargo_state_confidence),
    positionSource: textOrNull(v.position_source),
    sanctionsStatus: textOrNull(v.sanctions_status),

    history: []
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch(TANKERMAP_URL, {
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "application/json",
        "User-Agent": "Oil-Atlas/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`TankerMap returned ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid TankerMap response");
    }

    const vessels = data
      .map(normalizeVessel)
      .filter(Boolean);

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

    return res.status(200).json({
      vessels,
      count: vessels.length,
      stream: "tankermap",
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("TankerMap proxy error:", error);

    res.setHeader("Cache-Control", "no-store");

    return res.status(502).json({
      error: "TankerMap unavailable",
      vessels: [],
      count: 0
    });
  }
}
