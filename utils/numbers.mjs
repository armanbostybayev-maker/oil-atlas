export const finite = (v) => typeof v === "number" && Number.isFinite(v);
export function number(value) {
  if (value == null || String(value).trim() === "") return null;
  const s = String(value)
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".")
    .replace(/%$/, "");
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s) && Number.isFinite(Number(s))
    ? Number(s)
    : null;
}
export const sum = (values) => {
  const v = values.filter(finite);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};
export const mean = (values) => {
  const v = values.filter(finite);
  return v.length ? sum(v) / v.length : null;
};
export const quantile = (values, p) => {
  const v = values.filter(finite).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) * p;
  return v[Math.floor(i)] + (v[Math.ceil(i)] - v[Math.floor(i)]) * (i % 1);
};
export const ratio = (a, b) => (finite(a) && finite(b) && b > 0 ? a / b : null);
export const format = (v) =>
  finite(v)
    ? new Intl.NumberFormat(
        typeof document !== "undefined" &&
          document.documentElement.lang === "ru"
          ? "ru-RU"
          : "en",
        {
          maximumFractionDigits: 2,
          notation: Math.abs(v) >= 1e6 ? "compact" : "standard",
        },
      ).format(v)
    : "No data";
export const text = (v) =>
  v == null || String(v).trim() === "" ? "No data" : String(v);
