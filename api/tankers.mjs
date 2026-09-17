import WebSocket from "ws";

const AIS_URL = "wss://stream.aisstream.io/v0/stream";

// Для первого теста берём весь мир.
// Формат AISStream: [latitude, longitude].
const WORLD = [[[-90, -180], [90, 180]]];

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

  const lat = numberOrNull(meta.Latitude);
  const lon = numberOrNull(meta.Longitude);

  if (
    lat === null ||
    lon === null ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return null;
  }

  return {
    mmsi: String(meta.MMSI ?? ""),
    imo: null,
    name: String(meta.ShipName || "").trim() || "Unknown vessel",
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
      error: "AISSTREAM_API_KEY is not configured",
    });
  }

  const vessels = new Map();

  try {
    const socket = new WebSocket(AIS_URL);

    const finish = () => {
      try {
        socket.close();
      } catch {}

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        vessels: [...vessels.values()],
        count: vessels.size,
        generatedAt: new Date().toISOString(),
      });
    };

    const timer = setTimeout(finish, 8000);

    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: WORLD,
          FilterMessageTypes: [
            "PositionReport",
            "StandardClassBPositionReport",
            "ExtendedClassBPositionReport",
          ],
        }),
      );
    });

    socket.on("message", raw => {
      try {
        const event = JSON.parse(raw.toString());

        const vessel = normalizePosition(event);

        if (!vessel?.mmsi) return;

        vessels.set(vessel.mmsi, vessel);
      } catch {}
    });

    socket.on("error", error => {
      clearTimeout(timer);

      if (!res.headersSent) {
        res.status(502).json({
          error: "AISStream connection failed",
          detail: error.message,
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
}