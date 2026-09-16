export const CLASSIFICATION = {
  exportRatio: 1.5,
  hubRatio: 1.25,
  dependentRatio: 0.5,
  balancedMin: 0.8,
  balancedMax: 1.2,
};
export const CLASSES = {
  "Raw Oil Exporter": "#d0a76c",
  "Refining Hub": "#548fa5",
  "Large Consumer Market": "#9b8cb6",
  "Balanced Market": "#80b4a5",
  "Import Dependent": "#c48177",
  "Insufficient Data": "#dce3e6",
};
const metric = (
  id,
  label,
  unit,
  year = "refinery inventory; capacity years vary",
) => ({ id, label, unit, year });
export const MODES = {
  overview: {
    label: "Overview",
    icon: "◉",
    metrics: [metric("capacity", "Refining capacity", "Mt/year")],
  },
  balance: {
    label: "Oil Balance",
    icon: "⇄",
    metrics: [
      metric("classification", "Country typology", "category"),
      metric(
        "pcRatio",
        "Production / Consumption",
        "×",
        "production / consumption years",
      ),
      metric(
        "rcRatio",
        "Refining / Consumption",
        "×",
        "capacity inventory / consumption year",
      ),
    ],
  },
  capacity: {
    label: "Refining Capacity",
    icon: "◒",
    metrics: [
      metric("capacity", "Total capacity", "Mt/year"),
      metric("count", "Refinery count", "refineries"),
      metric("average", "Average capacity", "Mt/year"),
      metric("median", "Median capacity", "Mt/year"),
      metric("maximum", "Largest refinery", "Mt/year"),
    ],
  },
  production: {
    label: "Production",
    icon: "↗",
    metrics: [
      metric("production", "Total liquids", "bbl/day", "production"),
      metric("crude", "Crude oil", "bbl/day", "crude"),
      metric("ngpl", "NGPL", "bbl/day", "ngpl"),
    ],
  },
  consumption: {
    label: "Consumption",
    icon: "↘",
    metrics: [
      metric(
        "consumption",
        "Oil / products consumption",
        "bbl/day",
        "consumption",
      ),
      metric(
        "consumptionPerRefinery",
        "Consumption per refinery",
        "bbl/day/refinery",
        "consumption",
      ),
      metric(
        "consumptionCapacity",
        "Consumption / Refining",
        "×",
        "consumption / capacity inventory",
      ),
    ],
  },
  infrastructure: {
    label: "Refinery Infrastructure",
    icon: "▦",
    metrics: [
      metric("count", "Refinery count", "refineries"),
      metric("average", "Average capacity", "Mt/year"),
      metric("median", "Median capacity", "Mt/year"),
      metric("maximum", "Largest refinery", "Mt/year"),
      metric("largestShare", "Largest refinery share", "%"),
      metric("hhi", "Capacity concentration · HHI", "0–10,000"),
    ],
  },
  age: {
    label: "Refinery Age",
    icon: "◷",
    metrics: [
      metric(
        "averageAge",
        "Average reported operating age",
        "years",
        "reported lifetime / 2026 for active plants",
      ),
      metric("medianAge", "Median reported operating age", "years"),
      ...[30, 50, 70].map((n) =>
        metric("age" + n, `Refineries >${n} years`, "refineries"),
      ),
    ],
  },
  status: {
    label: "Refinery Status",
    icon: "◌",
    metrics: [
      metric(
        "statusCount",
        "Selected status count",
        "refineries",
        "status · 2026",
      ),
      metric("statusShare", "Selected status share", "%", "status · 2026"),
      metric(
        "statusCapacity",
        "Selected status capacity",
        "Mt/year",
        "status · 2026; capacity years vary",
      ),
    ],
  },
  products: {
    label: "Product Mix",
    icon: "▤",
    metrics: ["diesel", "gasoline", "lpg", "jet", "residual"].map((id) =>
      metric(
        id,
        {
          diesel: "Diesel",
          gasoline: "Gasoline",
          lpg: "LPG",
          jet: "Jet / Kerosene",
          residual: "Residual Fuel Oil",
        }[id],
        "%",
        "consumption",
      ),
    ),
  },
  economics: {
    label: "Economics",
    icon: "⌁",
    metrics: [
      metric("gdp", "GDP", "billion USD", "gdp"),
      metric("growth", "GDP growth", "%", "growth"),
      metric("inflation", "CPI inflation", "%", "inflation"),
      metric(
        "refiningIntensity",
        "Refining intensity",
        "t/year / billion USD",
        "capacity inventory / GDP year",
      ),
      metric(
        "consumptionIntensity",
        "Consumption intensity",
        "bbl/day / billion USD",
        "consumption / GDP years",
      ),
      metric(
        "productionIntensity",
        "Production intensity",
        "bbl/day / billion USD",
        "production / GDP years",
      ),
    ],
  },
  prices: {
    label: "Fuel Prices",
    icon: "＄",
    metrics: ["gasoline", "diesel", "jet", "lpg", "residual"].map((id) =>
      metric(
        id + "Price",
        {
          diesel: "Diesel",
          gasoline: "Gasoline",
          lpg: "LPG",
          jet: "Jet / Kerosene",
          residual: "Residual Fuel Oil",
        }[id],
        "USD · source unit",
        "source date",
      ),
    ),
  },
  owners: {
    label: "Owners",
    icon: "⌂",
    metrics: [
      metric("capacity", "Owner refining footprint", "Mt/year"),
      metric("count", "Owner refinery count", "refineries"),
    ],
  },
  anomalies: {
    label: "Anomalies",
    icon: "◇",
    metrics: [metric("anomaly", "Country signals", "matching countries")],
  },
};
export const ANOMALIES = [
  "High Production + Low Refining",
  "High Refining + Low Domestic Consumption",
  "High Consumption + Low Refining",
  "Many Small Refineries",
  "Few Very Large Refineries",
  "High Closed Capacity Share",
  "Old Active Refinery Fleet",
  "Large Refining Surplus",
  "Large Refining Deficit",
];
export const PRODUCTS = ["diesel", "gasoline", "lpg", "jet", "residual"];
