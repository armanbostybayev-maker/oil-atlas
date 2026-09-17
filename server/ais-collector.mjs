import http from "http";
import WebSocket from "ws";

const AIS_URL = "wss://stream.aisstream.io/v0/stream";
const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.AISSTREAM_API_KEY;

// Пока используем проверенный тестовый район Miami.
const BOUNDS = [
  [[-90, -180], [90, 180]],
  [[20, 47], [31, 63]]
];

const vessels = new Map();
const staticData = new Map();

const MAX_HISTORY = 120;
const RECONNECT_MS = 5000;
const STALE_MS = 30 * 60 * 1000;

function cleanText(value) {
  return String(value ?? "").trim();
}

function isTanker(type) {
  const n = Number(type);
  return Number.isFinite(n) && n >= 80 && n <= 89;
}
function tankerTypeName(type) {
  const n = Number(type);

  const names = {
    80: "Tanker",
    81: "Tanker - Hazard A",
    82: "Tanker - Hazard B",
    83: "Tanker - Hazard C",
    84: "Tanker - Hazard D",
    85: "Tanker",
    86: "Tanker",
    87: "Tanker",
    88: "Tanker",
    89: "Tanker"
  };

  return names[n] || "Tanker";
}

function navigationStatusName(status) {
  const n = Number(status);

  const names = {
    0: "Underway using engine",
    1: "At anchor",
    2: "Not under command",
    3: "Restricted manoeuvrability",
    4: "Constrained by draught",
    5: "Moored",
    6: "Aground",
    7: "Engaged in fishing",
    8: "Underway sailing",
    14: "AIS-SART / active",
    15: "Not defined"
  };

  return names[n] || "Unknown";
}

function inferTankerSubtype(vessel) {
  const searchable = [
    vessel.name,
    vessel.destination
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (/\bFPSO\b|\bFSO\b/.test(searchable)) {
    return "Floating Storage/Production";
  }

  return "Tanker";
}

function getMmsi(event, report) {
  return String(
    event?.MetaData?.MMSI ??
    report?.UserID ??
    ""
  ).trim();
}

function updateStatic(event) {
  const messageType = event?.MessageType;

  if (messageType === "ShipStaticData") {
    const report = event?.Message?.ShipStaticData;
    if (!report) return;

    const mmsi = getMmsi(event, report);
    if (!mmsi) return;

    const previous = staticData.get(mmsi) || {};

    const next = {
      ...previous,
      mmsi,
      name:
        cleanText(report.Name) ||
        cleanText(event?.MetaData?.ShipName) ||
        previous.name ||
        "",
      imo:
        Number(report.ImoNumber) > 0
          ? String(report.ImoNumber)
          : previous.imo || "",
      vesselType:
        Number.isFinite(Number(report.Type))
          ? Number(report.Type)
          : previous.vesselType,
      destination:
        cleanText(report.Destination) ||
        previous.destination ||
        "",
      callSign:
        cleanText(report.CallSign) ||
        previous.callSign ||
        "",
      draught:
        Number.isFinite(Number(report.MaximumStaticDraught))
          ? Number(report.MaximumStaticDraught)
          : previous.draught,
      staticUpdatedAt:
        event?.MetaData?.time_utc || new Date().toISOString(),
    };

    staticData.set(mmsi, next);
    mergeStaticIntoVessel(mmsi);
    return;
  }

  if (messageType === "StaticDataReport") {
    const report = event?.Message?.StaticDataReport;
    if (!report) return;

    const mmsi = getMmsi(event, report);
    if (!mmsi) return;

    const previous = staticData.get(mmsi) || {};
    const reportA = report.ReportA;
    const reportB = report.ReportB;

    const next = {
      ...previous,
      mmsi,
      staticUpdatedAt:
        event?.MetaData?.time_utc || new Date().toISOString(),
    };

    if (reportA?.Valid) {
      const name = cleanText(reportA.Name);
      if (name) next.name = name;
    }

    if (reportB?.Valid) {
      const type = Number(reportB.ShipType);

      if (Number.isFinite(type)) {
        next.vesselType = type;
      }

      const callSign = cleanText(reportB.CallSign);
      if (callSign) next.callSign = callSign;
    }

    const metaName = cleanText(event?.MetaData?.ShipName);
    if (!next.name && metaName) {
      next.name = metaName;
    }

    staticData.set(mmsi, next);
    mergeStaticIntoVessel(mmsi);
  }
}

function mergeStaticIntoVessel(mmsi) {
  const vessel = vessels.get(mmsi);
  const info = staticData.get(mmsi);

  if (!vessel || !info) return;

  vessels.set(mmsi, {
    ...vessel,
    name: info.name || vessel.name || "",
    imo: info.imo || vessel.imo || "",
    vesselType: info.vesselType ?? vessel.vesselType ?? null,
    destination: info.destination || vessel.destination || "",
    callSign: info.callSign || vessel.callSign || "",
    draught: info.draught ?? vessel.draught ?? null,
  });
}

function updatePosition(event) {
  const messageType = event?.MessageType;

  const report =
    event?.Message?.PositionReport ||
    event?.Message?.StandardClassBPositionReport ||
    event?.Message?.ExtendedClassBPositionReport;

  if (!report) return;

  const mmsi = getMmsi(event, report);
  if (!mmsi) return;

  const latitude = Number(
    report.Latitude ?? event?.MetaData?.latitude
  );

  const longitude = Number(
    report.Longitude ?? event?.MetaData?.longitude
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return;
  }

  const info = staticData.get(mmsi) || {};
  const previous = vessels.get(mmsi) || {};

  const timestamp =
    event?.MetaData?.time_utc ||
    new Date().toISOString();

  const point = {
    lat: latitude,
    lon: longitude,
    timestamp,
  };

  const history = Array.isArray(previous.history)
    ? [...previous.history]
    : [];

  const last = history[history.length - 1];

  if (
    !last ||
    last.lat !== point.lat ||
    last.lon !== point.lon
  ) {
    history.push(point);
  }

  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  vessels.set(mmsi, {
    mmsi,
    imo: info.imo || previous.imo || "",
    name:
      info.name ||
      cleanText(event?.MetaData?.ShipName) ||
      previous.name ||
      "",
    vesselType:
      info.vesselType ??
      previous.vesselType ??
      null,
    lat: latitude,
    lon: longitude,
    speed: Number.isFinite(Number(report.Sog))
      ? Number(report.Sog)
      : null,
    course: Number.isFinite(Number(report.Cog))
      ? Number(report.Cog)
      : null,
    heading: Number.isFinite(Number(report.TrueHeading))
      ? Number(report.TrueHeading)
      : null,
    navigationStatusCode:
      Number.isFinite(Number(report.NavigationalStatus))
        ? Number(report.NavigationalStatus)
        : previous.navigationStatusCode ?? null,
    navigationStatus:
      Number.isFinite(Number(report.NavigationalStatus))
        ? navigationStatusName(Number(report.NavigationalStatus))
        : previous.navigationStatus || "",
    destination:
      info.destination ||
      previous.destination ||
      "",
    callSign:
      info.callSign ||
      previous.callSign ||
      "",
    draught:
      info.draught ??
      previous.draught ??
      null,
    timestamp,
    receivedAt: Date.now(),
    history,
    sourceMessageType: messageType,
  });
}

function removeStaleVessels() {
  const now = Date.now();

  for (const [mmsi, vessel] of vessels) {
    if (
      vessel.receivedAt &&
      now - vessel.receivedAt > STALE_MS
    ) {
      vessels.delete(mmsi);
    }
  }
}

function getTankers() {
  removeStaleVessels();

  return [...vessels.values()]
    .filter(vessel => isTanker(vessel.vesselType))
    .map(vessel => ({
      ...vessel,
      vesselTypeName: tankerTypeName(vessel.vesselType),
      vesselSubtype: inferTankerSubtype(vessel),
      status: vessel.navigationStatus || ""
    }))
    .sort((a, b) =>
      String(a.name || a.mmsi).localeCompare(
        String(b.name || b.mmsi)
      )
    );
}

function connect() {
  console.log("Connecting to AISStream...");

const socket = new WebSocket(AIS_URL, {
  perMessageDeflate: true,
  });

  socket.on("open", () => {
    console.log("AISStream connected");

    socket.send(JSON.stringify({
      APIKey: API_KEY,
      BoundingBoxes: BOUNDS,
      FilterMessageTypes: [
        "PositionReport",
        "StandardClassBPositionReport",
        "ExtendedClassBPositionReport",
        "ShipStaticData",
        "StaticDataReport"
      ]
    }));
  });

  socket.on("message", raw => {
    try {
      const event = JSON.parse(raw.toString());

      if (event.MessageType === "SubscriptionConfirmation") {
        console.log("AIS subscription confirmed");
        return;
      }

      if (
        event.MessageType === "ShipStaticData" ||
        event.MessageType === "StaticDataReport"
      ) {
        updateStatic(event);
        return;
      }

      updatePosition(event);
    } catch (error) {
      console.error("AIS message error:", error.message);
    }
  });

  socket.on("error", error => {
    console.error("AISStream error:", error.message);
  });

  socket.on("close", () => {
    console.log(
      `AISStream disconnected. Reconnecting in ${RECONNECT_MS / 1000}s...`
    );

    setTimeout(connect, RECONNECT_MS);
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const pathname = new URL(req.url, "http://localhost").pathname;

  if (pathname === "/health") {
    const tankers = getTankers();

    res.writeHead(200);
    res.end(JSON.stringify({
      ok: true,
      vessels: vessels.size,
      staticRecords: staticData.size,
      tankers: tankers.length,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  if (pathname === "/tankers") {
    const tankers = getTankers();

    res.writeHead(200);
    res.end(JSON.stringify({
      vessels: tankers,
      count: tankers.length,
      generatedAt: new Date().toISOString(),
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

if (!API_KEY) {
  console.error("AISSTREAM_API_KEY is not configured");
  process.exit(1);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`AIS collector listening on port ${PORT}`);
});

connect();















