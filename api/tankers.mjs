import WebSocket from "ws";

const AIS_URL = "wss://stream.aisstream.io/v0/stream";

// Район Персидского залива / Ормузского пролива.
// Здесь обычно достаточно AIS-трафика для проверки.
const BOUNDS = [
  [[22.0, 48.0], [30.5, 58.5]]
];

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePosition(event) {
  const meta = event?.MetaData || {};

  const report =
    event?.Message?.PositionReport ||
    event?.Message?.StandardClassBPositionReport ||
    event?.Message?.ExtendedClassBPositionReport;

  if (!report) return null;

  // Координаты берём сначала непосредственно из AIS report.
  // MetaData оставляем запасным вариантом.
  const lat = numberOrNull(
    report.Latitude ?? meta.Latitude ?? meta.latitude
  );

  const lon = numberOrNull(
    report.Longitude ?? meta.Longitude ?? meta.longitude
  );

  if (
    lat === null ||
    lon === null ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return null;
  }

  const mmsi = String(
    meta.MMSI ??
    report.UserID ??
    ""
  );

  if (!mmsi) return null;

  return {
    mmsi,
    imo: null,
    name: String(meta.ShipName || "").trim() || `MMSI ${mmsi}`,
    vesselType: "AIS",
    lat,
    lon,
    speed: numberOrNull(report.Sog),
    course: numberOrNull(report.Cog),
    heading: numberOrNull(report.TrueHeading),
    destination: null,
    timestamp: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  const apiKey = process.env.AISSTREAM_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "AISSTREAM_API_KEY is not configured"
    });
  }

  const vessels = new Map();

  let confirmation = false;
  let receivedMessages = 0;
  let lastMessageType = null;
  let streamError = null;
  let finished = false;

  const socket = new WebSocket(AIS_URL, {
    perMessageDeflate: true
  });

  const finish = () => {
    if (finished) return;
    finished = true;

    try {
      socket.close();
    } catch {}

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      vessels: [...vessels.values()],
      count: vessels.size,

      debug: {
        subscriptionConfirmed: confirmation,
        receivedMessages,
        lastMessageType,
        streamError
      },

      generatedAt: new Date().toISOString()
    });
  };

  const timer = setTimeout(finish, 15000);

  socket.on("open", () => {
    socket.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: BOUNDS,
      FilterMessageTypes: [
        "PositionReport",
        "StandardClassBPositionReport",
        "ExtendedClassBPositionReport"
      ]
    }));
  });

  socket.on("message", raw => {
    try {
      const event = JSON.parse(raw.toString());

      receivedMessages++;

      if (event?.error) {
        streamError = String(event.error);
        clearTimeout(timer);
        return finish();
      }

      lastMessageType = event?.MessageType || null;

      if (event?.MessageType === "SubscriptionConfirmation") {
        confirmation = true;
        return;
      }

      const vessel = normalizePosition(event);

      if (vessel) {
        vessels.set(vessel.mmsi, vessel);
      }
    } catch (error) {
      streamError = `Parse error: ${error.message}`;
    }
  });

  socket.on("error", error => {
    streamError = error.message;
    clearTimeout(timer);
    finish();
  });

  socket.on("close", (code, reason) => {
    if (!finished && code !== 1000) {
      streamError =
        streamError ||
        `WebSocket closed: ${code} ${reason.toString()}`;

      clearTimeout(timer);
      finish();
    }
  });
}