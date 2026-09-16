import { t, useLanguage } from "../controls/i18n.jsx";
import React from "react";
export default function Quality({ quality, onClose }) {
  useLanguage();
  return (
    <aside className="panel details quality" aria-label={t("Data quality")}>
      <header>
        <span className="eyebrow">{t("DATA QUALITY / METHODOLOGY")}</span>
        <button aria-label={t("Close data quality")} onClick={onClose}>
          {t("\xD7")}
        </button>
      </header>
      <h2>{t("Know the limits")}</h2>
      <dl className="facts">
        {t(
          [
            ["Total refinery records", quality.totalRefineries],
            ["Matched to countries", quality.matched],
            ["Unmatched", quality.unmatched.length],
            ["Coastal fallback ≤5 km", quality.coastalFallback.length],
            ["Missing capacity", quality.missingCapacity],
            ["Missing owner", quality.missingOwner],
            ["Unknown status", quality.missingStatus],
            ["Missing reliable age", quality.missingAge],
            ["Invalid coordinates", quality.invalidCoordinates.length],
            ["Duplicate candidates", quality.duplicateCandidates.length],
            [
              "Shared-capacity candidates",
              quality.possibleSharedCapacity.length,
            ],
            ["Conflicting statuses", quality.statusConflicts.length],
            ["Fuel price records", quality.priceRecords],
          ].map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{t(k)}</dt>
              <dd>{t(v)}</dd>
            </React.Fragment>
          )),
        )}
      </dl>
      <h3>{t("Unmatched refineries")}</h3>
      {t(
        quality.unmatched.map((r) => (
          <p key={r.id}>
            {r.name}
            <small>
              {t(r.coordinates.join(", "))}
              {t("\xB7")}
              {t(r.method)}
            </small>
          </p>
        )),
      )}
      <h3>{t("How to read the map")}</h3>
      <details>
        <summary>{t("Duplicate and shared-capacity review")}</summary>
        {t(
          [
            ...quality.duplicateCandidates,
            ...quality.possibleSharedCapacity,
          ].map((p, i) => (
            <p key={i}>
              {t("Records")}
              {t(p.id)}
              {t("/")}
              {t(p.other)}
              <small>{t(p.reason)}</small>
            </p>
          )),
        )}
      </details>
      <p>
        {t(
          "Capacity totals sum known records, including historical and closed refineries. Missing is never zero. A country without matched refineries is not proof of zero national capacity.",
        )}
      </p>
      <p>
        {t(
          "Ratios requiring a full capacity denominator are withheld when any refinery capacity is missing or duplicate candidates remain. Production and consumption can refer to different years, shown in each tooltip and profile.",
        )}
      </p>
      <p>
        {t(
          "Approximate conversion: 1 tonne \u2248 7.33 barrels; annual tonnes \xD7 7.33 / 365 = barrels/day. Crude density varies; capacity is not actual throughput.",
        )}
      </p>
      <p>
        {t(
          "Country colors use quintiles, with a separate No data class. Negative and positive growth / inflation use a diverging scale.",
        )}
      </p>
      <p>
        {t(
          "Spatial join uses full source polygons, then nearest boundary within 5 km; a second candidate within 1 km of the best match is rejected. Country labels use NAME_EN.",
        )}
      </p>
      <details>
        <summary>
          {t("Status conflicts (")}
          {t(quality.statusConflicts.length)}
          {t(")")}
        </summary>
        {t(
          quality.statusConflicts.map((r) => (
            <p key={r.id}>
              <strong>{r.name}</strong>
              <small>
                {t(r.status)}
                {t("/")}
                {t(r.details)}
              </small>
            </p>
          )),
        )}
      </details>
      <p>
        {t("Unrecognized statuses:")}
        {t(" ")}
        {t(quality.unrecognizedStatuses.join(", ") || "None")}
      </p>
      <a className="clear" href="/data/quality.json" download>
        {t("Download diagnostics JSON \u2193")}
      </a>
    </aside>
  );
}
