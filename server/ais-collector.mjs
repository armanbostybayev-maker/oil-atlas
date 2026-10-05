import http from "http";
import WebSocket from "ws";
import { pathToFileURL } from "node:url";
import { normalizeVesselType } from '../map/vessel-types.mjs';

const AIS_URL = "wss://stream.aisstream.io/v0/stream";
export function createCollector({apiKey = process.env.AISSTREAM_API_KEY, port = Number(process.env.PORT || 8787), host = '0.0.0.0', WebSocketImpl = WebSocket, now = Date.now, staleMs = 30 * 60 * 1000, streamStaleMs = Number(process.env.AIS_STREAM_STALE_MS || 60000), cleanupMs = 60000, reconnectMs = 5000} = {}) {
const API_KEY = apiKey;
for (const value of [staleMs,streamStaleMs,cleanupMs,reconnectMs]) if (!Number.isFinite(value) || value <= 0) throw new Error('AIS TTL/interval values must be positive numbers');
let connected = false, lastMessageAt = null, lastPositionAt = null;
let socket, reconnectTimer, cleanupTimer, stopped = false;

// Global coverage; tanker filtering happens after static data arrives.
const BOUNDS = [
  [[-90, -180], [90, 180]]
];

const vessels = new Map();
const staticData = new Map();

const MAX_HISTORY = 120;
const RECONNECT_MS = reconnectMs;
const STALE_MS = staleMs;

function cleanText(value) {
  return String(value ?? "").trim();
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
      receivedAt: now(),
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
      receivedAt: now(),
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
    receivedAt: now(),
    history,
    sourceMessageType: messageType,
  });
  lastPositionAt = now();
}

function removeStaleVessels() {
  const currentTime = now();

  for (const [mmsi, vessel] of vessels) {
    if (
      currentTime - vessel.receivedAt > STALE_MS
    ) {
      vessels.delete(mmsi);
    }
  }
  for (const [mmsi, info] of staticData) {
    const lastSeen = Math.max(info.receivedAt, vessels.get(mmsi)?.receivedAt ?? 0);
    if (currentTime-lastSeen > STALE_MS) staticData.delete(mmsi);
  }
}

function health() {
  const ageSeconds = lastMessageAt === null ? null : Math.max(0,(now()-lastMessageAt)/1000);
  const positionAgeSeconds = lastPositionAt === null ? null : Math.max(0,(now()-lastPositionAt)/1000);
  return {
    ok: connected && ageSeconds !== null && ageSeconds*1000 <= streamStaleMs && positionAgeSeconds !== null && positionAgeSeconds*1000 <= streamStaleMs,
    connected, lastMessageAt:lastMessageAt === null ? null : new Date(lastMessageAt).toISOString(),
    lastPositionAt:lastPositionAt === null ? null : new Date(lastPositionAt).toISOString(),
    ageSeconds, positionAgeSeconds, staleAfterSeconds:streamStaleMs/1000,
    vessels:vessels.size, vesselCount:vessels.size, staticRecords:staticData.size,
    tankers:[...vessels.values()].filter(v => normalizeVesselType(v)).length,
    timestamp:new Date(now()).toISOString(),
  };
}

function ingest(event) {
  if (['ShipStaticData','StaticDataReport'].includes(event?.MessageType)) {
    if (!event.Message?.[event.MessageType]) return;
    updateStatic(event);
    lastMessageAt = now();
  } else if (['PositionReport','StandardClassBPositionReport','ExtendedClassBPositionReport'].includes(event?.MessageType)) {
    if (!event.Message?.[event.MessageType]) return;
    updatePosition(event);
    lastMessageAt = now();
  }
}

function getTankers() {
  removeStaleVessels();

  return [...vessels.values()]
    .flatMap(vessel => {
      const type = normalizeVesselType(vessel);
      return type ? [{
        ...vessel, ...type,
        vesselTypeName: vessel.vesselTypeName || tankerTypeName(vessel.vesselType),
        status: vessel.navigationStatus || ""
      }] : [];
    })
    .sort((a, b) =>
      String(a.name || a.mmsi).localeCompare(
        String(b.name || b.mmsi)
      )
    );
}

function connect() {
  if (stopped) return;
  console.log("Connecting to AISStream...");

socket = new WebSocketImpl(AIS_URL, {
  perMessageDeflate: true,
  handshakeTimeout: 15000,
  });

  socket.on("open", () => {
    if (stopped) { socket.terminate(); return; }
    connected = true;
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

      ingest(event);
    } catch (error) {
      console.error("AIS message error:", error.message);
    }
  });

  socket.on("error", error => {
    connected = false;
    console.error("AISStream error:", error.message);
    socket.terminate();
  });

  socket.on("close", () => {
    connected = false;
    if (stopped) return;
    console.log(
      `AISStream disconnected. Reconnecting in ${RECONNECT_MS / 1000}s...`
    );

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, RECONNECT_MS);
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const pathname = new URL(req.url, "http://localhost").pathname;

  if (pathname === "/health") {
    const status = health();
    res.writeHead(status.ok ? 200 : 503);
    res.end(JSON.stringify(status));
    return;
  }

  if (pathname === "/tankers") {
    const tankers = getTankers();

    res.writeHead(200);
    res.end(JSON.stringify({
      vessels: tankers,
      count: tankers.length,
      stream: health(),
      generatedAt: new Date().toISOString(),
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

return {
  server, health, ingest, cleanup:removeStaleVessels, getTankers,
  start() {
    if (!API_KEY) throw new Error('AISSTREAM_API_KEY is not configured');
    if (cleanupTimer) throw new Error('AIS collector is already started');
    stopped = false;
    cleanupTimer = setInterval(removeStaleVessels,cleanupMs);
    cleanupTimer.unref?.();
    server.listen(port,host);
    connect();
  },
  stop() {
    stopped = true;
    connected = false;
    clearTimeout(reconnectTimer);
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    socket?.terminate();
    server.close();
    server.closeAllConnections();
  },
};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const collector = createCollector();
  try { collector.start(); } catch (error) { console.error(error.message); process.exitCode = 1; }
  process.once('SIGINT',() => collector.stop());
  process.once('SIGTERM',() => collector.stop());
}















