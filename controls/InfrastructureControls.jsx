import React from "react";
import { t } from "./i18n.jsx";
import { INFRASTRUCTURE_TYPES } from "../map/InfrastructureLayer.mjs";
import "../styles/infrastructure.css";

export default function InfrastructureControls({ visibility, onChange, counts, error, onAnalytics }) {
  return <section className="panel infrastructure-controls" aria-label={t("Infrastructure layers")}>
    <header><strong>{t("Oil & gas infrastructure")}</strong></header>
    <button type="button" onClick={onAnalytics}>Аналитика трубопроводов</button>
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
    <small className="infrastructure-attribution">Data sources: <a href="https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/" target="_blank" rel="noopener noreferrer">GEM oil tracker</a> · <a href="https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/" target="_blank" rel="noopener noreferrer">GEM gas tracker</a>. Attribution applies to imported data only; check each feature’s source and release. Routes may be approximate.</small>
  </section>;
}
