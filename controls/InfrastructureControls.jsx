import React from "react";
import { t } from "./i18n.jsx";
import { INFRASTRUCTURE_TYPES } from "../map/InfrastructureLayer.mjs";
import "../styles/infrastructure.css";

export default function InfrastructureControls({ visibility, onChange, counts, error }) {
  return <section className="panel infrastructure-controls" aria-label={t("Infrastructure layers")}>
    <header><strong>{t("Oil & gas infrastructure")}</strong></header>
    <p>{t("Public route and facility data; geographic coverage varies.")}</p>
    <div className="infrastructure-options">
      {INFRASTRUCTURE_TYPES.map(item => <label key={item.id}>
        <input type="checkbox" checked={Boolean(visibility[item.id])} onChange={event => onChange(item.id, event.target.checked)} />
        <span className="infrastructure-swatch" style={{ background: item.color }} />
        <span>{t(item.label)}</span>
        <small>{counts[item.id] == null ? "—" : counts[item.id]}</small>
      </label>)}
    </div>
    {error && <small className="infrastructure-error" role="status">{error}</small>}
    <small>{t("Empty layers are placeholders until verified datasets are imported.")}</small>
  </section>;
}
