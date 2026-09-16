import React from "react";
import { BASEMAPS } from "../map/basemaps.mjs";
import { t, useLanguage } from "./i18n.jsx";

export default function BaseMapSwitcher({ value, onChange }) {
  useLanguage();
  return <label className="panel basemap-label">
    <span>{t("BASEMAP")}</span>
    <select aria-label={t("Basemap")} value={value} onChange={e => onChange(e.target.value)}>
      {Object.entries(BASEMAPS).map(([id, base]) => <option key={id} value={id}>
        {t(({ osm: "OSM", satellite: "Satellite", topo: "Topographic" })[id] || base.name)}{base.requiresKey ? t(" · key required") : ""}
      </option>)}
    </select>
  </label>;
}
