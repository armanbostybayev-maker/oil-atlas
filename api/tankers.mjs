const AIS_BACKEND = "https://oil-atlas-ais.onrender.com";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const response = await fetch(`${AIS_BACKEND}/tankers`, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`AIS backend returned ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.vessels)) {
      throw new Error("Invalid AIS backend response");
    }

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      vessels: data.vessels,
      count: data.vessels.length,
      generatedAt: data.generatedAt || new Date().toISOString()
    });
  } catch (error) {
    console.error("AIS proxy error:", error);

    res.setHeader("Cache-Control", "no-store");

    return res.status(502).json({
      error: "AIS backend unavailable",
      vessels: [],
      count: 0
    });
  }
}
