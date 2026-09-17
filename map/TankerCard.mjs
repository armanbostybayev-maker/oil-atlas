export function createTankerCard(vessel) {
  const content = document.createElement("div");
  content.style.width = "360px"; content.style.maxWidth = "calc(100vw - 60px)";
  content.style.fontFamily = "Segoe UI, Arial, sans-serif";

  const value = (v) =>
    v === null || v === undefined || v === "" ? "—" : String(v);

  const number = (v, digits = 1) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(digits) : "—";
  };

  const angle = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n < 360
      ? `${Math.round(n)}°`
      : "—";
  };

  const speed = Number(vessel.speed);
  const moving = Number.isFinite(speed) && speed > 0.5;

  const title = document.createElement("div");
  title.textContent = value(vessel.name);
  title.style.fontSize = "19px";
  title.style.fontWeight = "700";
  title.style.color = "#17232b";

  const subtitle = document.createElement("div");
  subtitle.textContent =
    vessel.vesselSubtype ||
    vessel.typeName ||
    `Tanker · AIS type ${value(vessel.vesselType)}`;

  subtitle.style.fontSize = "13px";
  subtitle.style.fontWeight = "600";
  subtitle.style.color = "#e32636";
  subtitle.style.margin = "3px 0 12px";

  content.append(title, subtitle);

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "minmax(0, 1fr) minmax(0, 1fr)";
  grid.style.borderTop = "1px solid #dce3e7";
  grid.style.borderLeft = "1px solid #dce3e7";

  function field(label, data) {
    const cell = document.createElement("div");
    cell.style.padding = "8px 9px";
    cell.style.borderRight = "1px solid #dce3e7";
    cell.style.borderBottom = "1px solid #dce3e7";

    const caption = document.createElement("div");
    caption.textContent = label;
    caption.style.fontSize = "10px";
    caption.style.textTransform = "uppercase";
    caption.style.letterSpacing = ".4px";
    caption.style.color = "#7b8991";

    const result = document.createElement("div");
    result.textContent = value(data);
    result.style.fontSize = "13px";
    result.style.fontWeight = "600";
    result.style.color = "#25343c";
    result.style.marginTop = "3px";
    result.style.overflowWrap = "anywhere";

    cell.append(caption, result);
    grid.append(cell);
  }

  field("MMSI", vessel.mmsi);
  field("IMO", vessel.imo);

  field("Call Sign", vessel.callSign);

  field(
    "Vessel Type",
    vessel.vesselSubtype ||
      vessel.typeName ||
      `Tanker ${value(vessel.vesselType)}`
  );

  field(
    "Status",
    vessel.status || (moving ? "Underway" : "Stopped / anchored")
  );

  field(
    "Speed / Course",
    `${number(vessel.speed)} kn / ${angle(vessel.course)}`
  );

  field("Heading", angle(vessel.heading));

  field(
    "Draught",
    Number.isFinite(Number(vessel.draught))
      ? `${number(vessel.draught)} m`
      : "—"
  );

  field("Destination", vessel.destination);

  let lastPosition = "—";
  if (vessel.timestamp) {
    const date = new Date(vessel.timestamp);
    if (!Number.isNaN(date.getTime())) {
      lastPosition = date.toLocaleString();
    }
  }

  field("Last AIS Position", lastPosition);
  field("Latitude", number(vessel.lat, 5));
  field("Longitude", number(vessel.lon, 5));

  content.append(grid);

  return content;
}

