import React, { useEffect, useMemo, useRef, useState } from "react";
import { t, useLanguage } from "../controls/i18n.jsx";
import {
  VESSEL_TYPES,
  vesselSelectionState,
  toggleVesselType,
  selectAllVesselTypes,
} from "../map/vessel-types.mjs";

function searchableVesselText(vessel) {
  return [
    vessel.name, vessel.imo, vessel.mmsi, vessel.flag,
    vessel.vesselSubtype, vessel.vesselTypeName, vessel.vesselType,
    vessel.status, vessel.destination, vessel.cargoState,
    vessel.positionSource, vessel.deadweight,
  ].filter(value => value !== null && value !== undefined)
    .join(" ").toLowerCase();
}

export default function VesselTypes({
  selected, onChange, counts, company, total, knownOwners,
  enabled = true, onEnabledChange, vessels = [], onVesselSelect,
}) {
  useLanguage();
  const [open, setOpen] = useState(
    () => !window.matchMedia("(max-width: 760px)").matches
  );
  const [query, setQuery] = useState("");
  const all = useRef(null), container = useRef(null);
  const selection = vesselSelectionState(selected);
  const available = Object.values(counts || {}).reduce(
    (sum, value) => sum + (Number(value) || 0), 0
  );
  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    return vessels
      .filter(vessel => searchableVesselText(vessel).includes(normalizedQuery))
      .slice(0, 50);
  }, [normalizedQuery, vessels]);

  useEffect(() => {
    if (all.current) all.current.indeterminate = selection.indeterminate;
  }, [selection.indeterminate, open]);

  useEffect(() => {
    if (!open) return;
    const outside = event => {
      if (
        window.matchMedia("(max-width: 760px)").matches &&
        !container.current?.contains(event.target)
      ) setOpen(false);
    };
    const escape = event => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <section ref={container} className="panel vessel-types" aria-label={t("Vessel Types")}>
      <button
        className="vessel-types-trigger"
        aria-expanded={open}
        aria-controls="vessel-type-options"
        onClick={() => setOpen(!open)}
      >
        <span>{t("Tankers")}</span>
        <span>{total} {open ? "▴" : "▾"}</span>
      </button>

      {open && <div id="vessel-type-options" className="vessel-type-options">
        <label className="tanker-master-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={event => onEnabledChange?.(event.target.checked)}
          />
          <span>{t("Show tankers on map")}</span>
          <strong>{enabled ? "ON" : "OFF"}</strong>
        </label>

        <div className={!enabled ? "tanker-controls-disabled" : ""}>
          <label className="vessel-type-all">
            <input
              ref={all}
              type="checkbox"
              checked={selection.checked}
              disabled={!enabled}
              onChange={event => onChange(selectAllVesselTypes(event.target.checked))}
            />
            <span>{t("All tankers")}</span>
            <span>{available}</span>
          </label>

          <details open>
            <summary>{t("Filter by detailed type")}</summary>
            <div className="vessel-type-children">
              {VESSEL_TYPES.map(type => <label key={type.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(type.id)}
                  disabled={!enabled}
                  onChange={event => onChange(
                    toggleVesselType(selected, type.id, event.target.checked)
                  )}
                />
                <span>{t(type.label)}</span>
                <span className="vessel-type-count">{counts?.[type.id] || 0}</span>
              </label>)}
            </div>
          </details>
        </div>

        <div className="tanker-search">
          <label htmlFor="tanker-attribute-search">{t("Search tankers")}</label>
          <input
            id="tanker-attribute-search"
            type="search"
            value={query}
            autoComplete="off"
            placeholder={t("Name, IMO, MMSI, flag, type, status...")}
            onChange={event => setQuery(event.target.value)}
          />

          {normalizedQuery.length >= 2 && <div className="tanker-search-results">
            <small>
              {results.length
                ? `${results.length}${results.length === 50 ? "+" : ""} ${t("results")}`
                : t("No tankers found")}
            </small>

            {results.map((vessel, index) => <button
              type="button"
              key={vessel.vesselId || vessel.mmsi || vessel.imo || `${vessel.name || "vessel"}-${index}`}
              onClick={() => onVesselSelect?.(vessel)}
            >
              <strong>{vessel.name || t("Unknown tanker")}</strong>
              <span>
                {vessel.vesselSubtype || vessel.vesselTypeName ||
                 vessel.vesselType || t("Tanker")}
              </span>
              <small>
                {vessel.imo ? `IMO ${vessel.imo}` : ""}
                {vessel.imo && vessel.mmsi ? " · " : ""}
                {vessel.mmsi ? `MMSI ${vessel.mmsi}` : ""}
              </small>
            </button>)}
          </div>}
        </div>

        <small>{t("Global AIS feed; coverage is not complete.")}</small>
        {company && <small>{t("Company:")} {company}</small>}
        {total > 0 && knownOwners === 0 && <small>
          {t("The current AIS feed has no company information. A company filter hides vessels with unknown owners.")}
        </small>}
      </div>}
    </section>
  );
}
