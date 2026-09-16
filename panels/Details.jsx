import { t, useLanguage } from "../controls/i18n.jsx";
import React from "react";
import { format, text } from "../utils/numbers.mjs";
import { PRODUCTS } from "../analytics/config.mjs";
import { metricYear } from "../analytics/atlas.mjs";
export const COUNTRY_METRICS = [
  ["production", "Oil production", "bbl/day"],
  ["consumption", "Consumption", "bbl/day"],
  ["crude", "Crude oil", "bbl/day"],
  ["ngpl", "NGPL", "bbl/day"],
  ["capacity", "Known recorded capacity", "Mt/year"],
  ["count", "Number of refineries", ""],
  ["active", "Active refineries", ""],
  ["average", "Average refinery size", "Mt/year"],
  ["pcRatio", "Production / Consumption", "×"],
  ["rcRatio", "Refining / Consumption", "×"],
  ["gdp", "GDP", "billion USD"],
  ["growth", "GDP growth", "%"],
  ["inflation", "CPI inflation", "%"],
  ["gasolinePrice", "Gasoline price", "USD"],
  ["dieselPrice", "Diesel price", "USD"],
];
export function ProductMix({ country }) {
  useLanguage();
  return (
    <section className="product-mix">
      <h3>
        {t("Product consumption mix")}
        {t(" ")}
        <span>{t(country.years.consumption || "Year unavailable")}</span>
      </h3>
      {t(
        PRODUCTS.map((k, i) => (
          <div className="mix-row" key={k}>
            <span>
              {t(
                {
                  diesel: "Diesel",
                  gasoline: "Gasoline",
                  lpg: "LPG",
                  jet: "Jet / Kerosene",
                  residual: "Residual fuel",
                }[k],
              )}
            </span>
            <div className="track">
              <i
                style={{
                  width:
                    country[k] === null
                      ? 0
                      : Math.min(100, Math.max(0, country[k])) + "%",
                  background: [
                    "#4c8c9c",
                    "#76a9ae",
                    "#a6bbba",
                    "#bda681",
                    "#929bb1",
                  ][i],
                }}
              />
            </div>
            <b>
              {t(format(country[k]))}
              {t(country[k] === null ? "" : "%")}
            </b>
          </div>
        )),
      )}
      <small>{t("Missing shares are not imputed or rescaled to 100%.")}</small>
    </section>
  );
}
export function RawFields({ raw }) {
  useLanguage();
  return (
    <details className="raw">
      <summary>{t("All source fields & references")}</summary>
      <dl>
        {t(
          Object.entries(raw).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{t(k)}</dt>
              <dd>
                {t(
                  String(v || "").match(/^https?:\/\//)
                    ? String(v)
                        .split(/\s*;\s*/)
                        .map((url, i) =>
                          /^https?:\/\/\S+$/.test(url) ? (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t("Source")}
                              {t(i + 1)}
                              {t("\u2197")}
                              {t(" ")}
                            </a>
                          ) : (
                            <span key={i}>{t(url)}</span>
                          ),
                        )
                    : v == null || String(v).trim() === ""
                      ? t("No data")
                      : text(v),
                )}
              </dd>
            </React.Fragment>
          )),
        )}
      </dl>
    </details>
  );
}
export default function Details({
  country,
  refinery,
  atlas,
  onClose,
  onCompare,
  onCountry,
}) {
  useLanguage();
  if (!country && !refinery) return null;
  if (refinery)
    return (
      <aside className="panel details" aria-label={t("Refinery details")}>
        <header>
          <span className="eyebrow">{t("REFINERY PROFILE")}</span>
          <button aria-label={t("Close details")} onClick={onClose}>
            {t("\xD7")}
          </button>
        </header>
        <h2>{refinery.name}</h2>
        <p className="muted">
          {t(atlas.byId.get(refinery.country)?.name || "Unmatched country")}
          {t(" \xB7")}
          {t(" ")}
          {t(refinery.status)}
        </p>
        <div className="hero-value">
          {t(
            format(refinery.capacity === null ? null : refinery.capacity / 1e6),
          )}
          {t(" ")}
          <small>{t("Mt/year")}</small>
        </div>
        <p className="muted">
          {t("Reported / converted capacity \xB7 reference years vary")}
        </p>
        <dl className="facts">
          <dt>{t("Owner")}</dt>
          <dd>{t(refinery.owner || "No data")}</dd>
          <dt>{t("Reported operating age")}</dt>
          <dd>
            {t(format(refinery.age))}
            {t(" years")}
          </dd>
          <dt>{t("Country match")}</dt>
          <dd>
            {t(refinery.method)}
            {t(
              refinery.distanceKm > 0
                ? " · " + format(refinery.distanceKm) + " km"
                : "",
            )}
          </dd>
          <dt>{t("Coordinates")}</dt>
          <dd>
            {t(refinery.coordinates?.map((n) => n.toFixed(5)).join(", "))}
          </dd>
        </dl>
        {t(
          refinery.statusConflict && (
            <p className="caution">
              {t(
                "Short and detailed source statuses conflict. Classification follows the short \u201C\u0421\u0442\u0430\u0442\u0443\u0441\u201D field.",
              )}
            </p>
          ),
        )}
        {t(
          refinery.duplicateWarning && (
            <p className="caution">
              {t(
                "Possible duplicate or shared complex capacity. This record is retained for review; its reported capacity may overlap another record.",
              )}
            </p>
          ),
        )}
        <RawFields raw={refinery.raw} />
      </aside>
    );
  const similar = atlas.similar(country.id);
  return (
    <aside className="panel details" aria-label={t("Country details")}>
      <header>
        <span className="eyebrow">{t("COUNTRY PROFILE")}</span>
        <button aria-label={t("Close details")} onClick={onClose}>
          {t("\xD7")}
        </button>
      </header>
      <h2>{country.name}</h2>
      <p className="muted">
        {country.nameRu}
        {t(" \xB7")}
        {t(country.classification)}
      </p>
      <button
        className="primary compare-button"
        onClick={() => onCompare(country.id)}
      >
        {t("Compare countries \u21C4")}
      </button>
      <div className="coverage-note">
        {t("Capacity coverage ")}
        {t(country.knownCapacity)}
        {t("/")}
        {t(country.count)}
        {t(" records \xB7 includes historical / closed sites.")}
        {t(" ")}
        {t(
          country.completeCapacity
            ? "Complete within this inventory."
            : "Missing capacity or duplicate candidates: dependent ratios are unavailable.",
        )}
        {t(
          country.duplicateWarnings > 0 &&
            ` ${country.duplicateWarnings} records need duplicate / shared-capacity review. Recorded sums may overcount.`,
        )}
      </div>
      <dl className="metric-facts">
        {t(
          COUNTRY_METRICS.map(([k, label, unit]) => (
            <div key={k}>
              <dt>
                {t(label)}
                <small>{t(metricYear(country, k))}</small>
              </dt>
              <dd>
                {t(format(country[k]))}
                <small>
                  {t(
                    k.endsWith("Price")
                      ? country.priceUnit || "Unit unavailable"
                      : unit,
                  )}
                </small>
              </dd>
            </div>
          )),
        )}
      </dl>
      <ProductMix country={country} />
      {t(
        country.anomalies.length > 0 && (
          <section>
            <h3>{t("Analytical signals")}</h3>
            {t(
              country.anomalies.map((a) => (
                <p className="signal" key={a}>
                  {t(a)}
                </p>
              )),
            )}
          </section>
        ),
      )}
      <section>
        <h3>{t("Similar countries")}</h3>
        {t(
          similar.length ? (
            similar.map((s) => (
              <button
                className="similar"
                key={s.country.id}
                onClick={() => onCountry(s.country.id)}
              >
                {s.country.name}
                <span>
                  {t(s.distance.toFixed(2))}
                  {t("\xB7")}
                  {t(s.features)}
                  {t("features")}
                </span>
              </button>
            ))
          ) : (
            <p className="muted">
              {t("Insufficient shared data (minimum 6 features).")}
            </p>
          ),
        )}
        <small>
          {t(
            "Standardized Euclidean distance; lower is closer. Mixed source years.",
          )}
        </small>
      </section>
      <RawFields raw={country.raw} />
    </aside>
  );
}
export function Comparison({ ids, atlas, onSecond, onClose }) {
  useLanguage();
  const a = atlas.byId.get(ids[0]),
    b = atlas.byId.get(ids[1]);
  if (!a) return null;
  return (
    <aside className="panel comparison" aria-label={t("Country comparison")}>
      <header>
        <span className="eyebrow">{t("COMPARE COUNTRIES")}</span>
        <button onClick={onClose} aria-label={t("Close comparison")}>
          {t("\xD7")}
        </button>
      </header>
      <h2>{a.name}</h2>
      <label>
        {t("Compare with")}
        <select value={ids[1] || ""} onChange={(e) => onSecond(e.target.value)}>
          <option value="">{t("Choose another country")}</option>
          {t(
            atlas.stats
              .filter((c) => c.id !== a.id)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              )),
          )}
        </select>
      </label>
      {t(
        b && (
          <>
            <table>
              <thead>
                <tr>
                  <th>{t("Indicator")}</th>
                  <th>{a.name}</th>
                  <th>{b.name}</th>
                </tr>
              </thead>
              <tbody>
                {t(
                  COUNTRY_METRICS.slice(0, 11).map(([k, label, unit]) => (
                    <tr key={k}>
                      <td>
                        {t(label)}
                        <small>{t(unit)}</small>
                      </td>
                      {t(
                        [a, b].map((c) => (
                          <td key={c.id}>
                            {t(format(c[k]))}
                            <small>{t(metricYear(c, k))}</small>
                          </td>
                        )),
                      )}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
            <h3>{a.name}</h3>
            <ProductMix country={a} />
            <h3>{b.name}</h3>
            <ProductMix country={b} />
            <p className="caution">
              {t(
                "Capacity is the sum of known records, including closed facilities. Compare coverage:",
              )}
              {t(a.knownCapacity)}
              {t("/")}
              {t(a.count)}
              {t("vs")}
              {t(b.knownCapacity)}
              {t("/")}
              {t(b.count)}
              {t(".")}
            </p>
          </>
        ),
      )}
    </aside>
  );
}
