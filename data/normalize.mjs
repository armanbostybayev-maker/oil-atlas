import { number } from "../utils/numbers.mjs";
export const BARRELS_PER_TONNE = 7.33;
export const TONNES_YEAR_TO_BPD = BARRELS_PER_TONNE / 365;
export const FIELDS = {
  consumption: "Потребление нефти/нефтепродуктов, барр./сут.",
  production: "Добыча нефти и жидкостей, барр./сут.",
  crude: "Добыча сырой нефти, барр./сут.",
  ngpl: "Добыча NGPL, барр./сут.",
  gdp: "ВВП, млрд USD",
  growth: "Рост ВВП, %",
  inflation: "Инфляция CPI, %",
  diesel: "Дизель/дистилляты, % потребления",
  gasoline: "Бензин, % потребления",
  lpg: "LPG, % потребления",
  jet: "Jet/керосин, % потребления",
  residual: "Мазут/Residual Fuel Oil, % потребления",
  gasolinePrice: "Цена бензина, USD",
  dieselPrice: "Цена дизеля, USD",
  jetPrice: "Цена Jet/керосина, USD",
  lpgPrice: "Цена LPG, USD",
  residualPrice: "Цена мазута, USD",
};
export const YEAR_FIELDS = {
  consumption: "Год потребления",
  production: "Год добычи",
  crude: "Год добычи",
  ngpl: "Год добычи",
  gdp: "Год ВВП",
  growth: "Год роста",
  inflation: "Год инфляции",
  diesel: "Год потребления",
  gasoline: "Год потребления",
  lpg: "Год потребления",
  jet: "Год потребления",
  residual: "Год потребления",
};
export function countryModel(feature) {
  const raw = feature.properties;
  return {
    id: String(raw.fid),
    name: raw.NAME_EN,
    nameRu: raw.NAME_RU,
    raw,
    values: Object.fromEntries(
      Object.entries(FIELDS).map(([k, f]) => [k, number(raw[f])]),
    ),
    years: Object.fromEntries(
      Object.entries(YEAR_FIELDS).map(([k, f]) => [k, number(raw[f])]),
    ),
    priceUnit: raw["Единица/тип цены"] || null,
    priceDate: raw["Дата цены"] || null,
  };
}
const ownerAliases = [
  [/^BP(?:\s|$)/i, "BP"],
  [/^Ampol Limited/i, "Ampol Limited"],
  [/^ExxonMobil(?:\s|$)/i, "ExxonMobil"],
  [/^Viva Energy Australia/i, "Viva Energy Australia"],
];
export function ownerName(value) {
  if (
    !value ||
    /^(нет |неизвест|не установлен|не подтвержд|Текущий владелец\/оператор указан|Историческая\/малая|Исторический оператор\/владелец|Исторический украинский оператор)/i.test(
      value.trim(),
    )
  )
    return null;
  const cleaned = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  // Do not divide joint ventures or infer ownership shares from prose.
  for (const [re, name] of ownerAliases)
    if (re.test(cleaned) && !/[;%]|совмест|доля|доли/i.test(cleaned))
      return name;
  return cleaned;
}
export function ageValue(value) {
  if (
    !value ||
    /около|примерно|юрид|юрлиц|предшествен|основан|не обязательно/i.test(value)
  )
    return null;
  const match = value.trim().match(/^(\d{1,3})\s*(?:год|года|лет)\b/u);
  // JS word boundaries are ASCII; use explicit Cyrillic suffix below.
  const m =
    match || value.trim().match(/^(\d{1,3})\s*(?:года?|лет)(?:\s|\(|$)/u);
  return m ? Number(m[1]) : null;
}
export function refineryModel(feature) {
  const p = feature.properties,
    capacity =
      number(p["Переработка, т/год (пересчитано)"]) ??
      number(p["Мощность переработки, т/год"]) ??
      (number(p["Переработка, млн т/год"]) === null
        ? null
        : number(p["Переработка, млн т/год"]) * 1e6),
    rawStatus = p["Статус"];
  const status =
    {
      действующий: "Active",
      закрыт: "Closed",
      модернизация: "Modernization",
      неизвестно: "Unknown",
    }[rawStatus] || "Unknown";
  const details = p["Статус на 2026 г."] || "";
  const statusConflict =
    (status === "Active" && /закрыт|прекращен|остановлен/i.test(details)) ||
    (status === "Unknown" && /прекращен|закрыт/i.test(details));
  return {
    id: String(p.fid),
    name: p["Официальное название"] || p.name,
    originalName: p.name,
    coordinates: feature.geometry?.coordinates,
    capacity: capacity !== null && capacity >= 0 ? capacity : null,
    capacityBpd:
      capacity !== null && capacity >= 0 ? capacity * TONNES_YEAR_TO_BPD : null,
    owner: ownerName(p["Владелец завода"]),
    status,
    rawStatus,
    age: ageValue(p["Возраст / срок работы завода"]),
    statusConflict,
    raw: p,
  };
}
