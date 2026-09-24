import { t, useLanguage } from "../controls/i18n.jsx";
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import MapOverlayLayout from "./MapOverlayLayout.jsx";
import BaseMapSwitcher from "../controls/BaseMapSwitcher.jsx";
import IndicatorSelect from "../controls/IndicatorSelect.jsx";
import LanguageSwitcher from "../controls/LanguageSwitcher.jsx";
import ModeHelp from "../panels/ModeHelp.jsx";
import {
  aggregate,
  createAnalytics,
  metricValue,
} from "../analytics/atlas.mjs";
import { MODES, CLASSES, ANOMALIES } from "../analytics/config.mjs";
import { colorScale } from "../map/layers.mjs";
import { loadTankers } from "../map/TankerLayer.mjs";
import VesselTypes from "../panels/VesselTypes.jsx";
import InfrastructureControls from "../controls/InfrastructureControls.jsx";
import { defaultInfrastructureVisibility } from "../map/InfrastructureLayer.mjs";
import {
  ALL_VESSEL_TYPES,
  normalizeFleet,
  vesselTypeCounts,
} from "../map/vessel-types.mjs";
import { readState, writeState } from "../controls/state.mjs";
import { finite, format } from "../utils/numbers.mjs";
export function createAtlasApp({
  WorldMap,
  Owners,
  Details,
  Comparison,
  Quality,
  Search,
}) {
  return function AtlasApp({ data, geometry }) {
    useLanguage();
    const mapViewport = useRef(null);
    const onViewportChange = useCallback(viewport => { mapViewport.current = viewport; }, []);
    const [help, setHelp] = useState(null);
    const closeHelp = useCallback(() => setHelp(null), []);
    const [infrastructureVisibility, setInfrastructureVisibility] = useState(defaultInfrastructureVisibility);
    const [infrastructureCounts, setInfrastructureCounts] = useState({});
    const [infrastructureError, setInfrastructureError] = useState("");
    const [tankers, setTankers] = useState([]);
    const [tankersEnabled, setTankersEnabled] = useState(true);
    const [selectedVesselTypes, setSelectedVesselTypes] =
      useState(ALL_VESSEL_TYPES);

    const fleet = useMemo(
      () => normalizeFleet(tankers),
      [tankers]
    );

    const vesselCounts = useMemo(
      () => vesselTypeCounts(fleet),
      [fleet]
    );
    useEffect(() => {
      const controller = new AbortController();

      async function refreshTankers() {
        try {
          const vessels = await loadTankers({ signal: controller.signal });
          setTankers(vessels);
          console.log(`AIS: ${vessels.length} vessels`);
        } catch (error) {
          if (error.name !== "AbortError") {
            console.error("AIS load failed:", error);
          }
        }
      }

      refreshTankers();
      const timer = setInterval(refreshTankers, 65000);

      return () => {
        controller.abort();
        clearInterval(timer);
      };
    }, []);
    const atlas = useMemo(
      () => ({
        ...createAnalytics(data),
        refineries: data.refineries,
        refineriesById: new Map(data.refineries.map((r) => [r.id, r])),
      }),
      [data],
    );
    const [state, setState] = useState(readState),
      [activePanel, setActivePanel] = useState(() => readState().country ? "country" : "analysis"),
      [selectedRefinery, setSelectedRefinery] = useState(""),
      [hoverOwner, setHoverOwner] = useState(""),
      [compare, setCompare] = useState([]),
      [focus, setFocus] = useState(null);
    const menu = activePanel === "menu", quality = activePanel === "quality";
    const activeAnalysis = state.mode === "none" ? null : state.mode;
    const analysisMode = activeAnalysis || "overview";
    const setMenu = (open) => setActivePanel(open ? "menu" : "analysis");
    const setQuality = (open) => setActivePanel(open ? "quality" : "analysis");
    const update = (patch) =>
      setState((s) => ({
        ...s,
        ...patch,
      }));
    useEffect(() => {
      writeState(state);
    }, [state]);
    useEffect(() => {
      if (state.country && !atlas.byId.has(state.country))
        update({
          country: "",
        });
      if (state.owner && !atlas.owners.some((o) => o.name === state.owner))
        update({
          owner: "",
        });
    }, [atlas]);
    useEffect(() => {
      function escape(e) {
        if (document.querySelector("dialog[open]")) return;
        if (e.key === "Escape") {
          setActivePanel("analysis");
        }
      }
      window.addEventListener("keydown", escape);
      return () => window.removeEventListener("keydown", escape);
    }, []);
    const rows = useMemo(
      () =>
        data.refineries.filter(
          (r) =>
            (!state.owner || r.owner === state.owner) &&
            (!state.status || r.status === state.status) &&
            (state.mode !== "anomalies" ||
              atlas.byId.get(r.country)?.anomalies.includes(state.anomaly)),
        ),
      [data, atlas, state.owner, state.status, state.mode, state.anomaly],
    );
    const groups = useMemo(() => {
      const m = new Map();
      rows.forEach((r) => {
        if (!m.has(r.country)) m.set(r.country, []);
        m.get(r.country).push(r);
      });
      return m;
    }, [rows]);
    const values = useMemo(
      () =>
        new Map(
          atlas.stats.map((c) => [
            c.id,
            metricValue(c, { ...state, mode: analysisMode }, groups.get(c.id) || []),
          ]),
        ),
      [atlas, state, groups],
    );
    const scale = useMemo(
        () => colorScale([...values.values()], state.metric),
        [values, state.metric],
      ),
      metric =
        MODES[analysisMode].metrics.find((m) => m.id === state.metric) ||
        MODES[analysisMode].metrics[0];
    const kpi = useMemo(() => aggregate(rows), [rows]),
      countriesWithRefineries = new Set(
        rows.map((r) => r.country).filter(Boolean),
      ).size,
      coverage = [...values.values()].filter(
        (v) =>
          finite(v) || (typeof v === "string" && v !== "Insufficient Data"),
      ).length;
    function country(id) {
      setSelectedRefinery("");
      setActivePanel(compare.length && activePanel === "comparison" ? "comparison" : "country");
      if (compare.length && activePanel === "comparison") {
        setCompare([compare[0], id === compare[0] ? "" : id]);
      } else
        update({
          country: id,
        });
      const c = atlas.byId.get(id);
      if (c)
        setFocus({
          points: [c.center],
          zoom: 3.5,
        });
    }
    function refinery(id) {
      const r = atlas.refineriesById.get(id);
      if (!r) return;
      setCompare([]);
      setActivePanel("refinery");
      setSelectedRefinery(id);
      update({
        country: r.country || "",
      });
      if (r.validCoordinates)
        setFocus({
          points: [r.coordinates],
          zoom: 7,
        });
    }
    function owner(name) {
      update({
        owner: name,
      });
      setSelectedRefinery("");
      if (name) {
        const o = atlas.owners.find((o) => o.name === name);
        setFocus({
          points: o?.rows
            .filter((r) => r.validCoordinates)
            .map((r) => r.coordinates),
        });
      }
    }
    function reset() {
      setFocus({ world: true });
    }
    function mode(id) {
      update({
        mode: id,
        metric: MODES[id].metrics[0].id,

      });
      setActivePanel("analysis");
      setSelectedRefinery("");
      setCompare([]);
    }
    const priceUnits = [
      ...new Set(atlas.stats.map((c) => c.priceUnit).filter(Boolean)),
    ];
    const selectTanker = useCallback((vessel) => {
      const lat = Number(vessel.lat);
      const lon = Number(vessel.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      setTankersEnabled(true);

      if (
        vessel.vesselTypeId &&
        !selectedVesselTypes.includes(vessel.vesselTypeId)
      ) {
        setSelectedVesselTypes((current) => [
          ...new Set([...current, vessel.vesselTypeId]),
        ]);
      }

      setFocus({
        points: [[lon, lat]],
        zoom: 8,
      });
    }, [selectedVesselTypes]);

    return (
      <main className="atlas-app" data-active-analysis={activeAnalysis || "none"}>
        {help && <ModeHelp mode={help} onClose={closeHelp} />}
        <WorldMap
          geometry={geometry}
          atlas={atlas}
          rows={rows}
          state={{ ...state, mode: analysisMode, activeAnalysis }}
          values={values}
          scale={scale}
          metric={metric}
          onSelect={({ type, id }) =>
            type === "country" ? country(id) : refinery(id)
          }
          hoverOwner={hoverOwner}
          focus={focus}
          onViewportChange={onViewportChange}
          tankers={fleet}
          tankersEnabled={tankersEnabled}
          selectedVesselTypes={selectedVesselTypes}
          infrastructureVisibility={infrastructureVisibility}
          onInfrastructureCounts={setInfrastructureCounts}
          onInfrastructureError={setInfrastructureError}
        />

        <MapOverlayLayout
          brand={<>        <div className="top-left">
          <div className="brand panel">
            <button
              className="burger"
              aria-label={t("Open analytics menu")}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {t("\u2630")}
            </button>
            <span className="brand-mark">{t("\u25C8")}</span>
            <div>
              <h1>
                {t("Oil Atlas")}
                <span>{t("WORLD INDUSTRY INTELLIGENCE")}</span>
              </h1>
            </div>
          </div>
        </div></>}
          search={<>          <Search
            atlas={atlas}
            onCountry={country}
            onRefinery={refinery}
            onOwner={owner}
          /></>}
          right={<><LanguageSwitcher />        <Owners
          owners={atlas.owners}
          selected={state.owner}
          onSelect={owner}
          onHover={setHoverOwner}
        />
            <InfrastructureControls
              visibility={infrastructureVisibility}
              onChange={(type, enabled) => {
                setInfrastructureError("");
                setInfrastructureVisibility(current => ({ ...current, [type]: enabled }));
              }}
              counts={infrastructureCounts}
              error={infrastructureError}
            />
            <VesselTypes
              selected={selectedVesselTypes}
              onChange={setSelectedVesselTypes}
              counts={vesselCounts}
              total={fleet.length}
              enabled={tankersEnabled}
              onEnabledChange={setTankersEnabled}
              vessels={fleet}
              onVesselSelect={selectTanker}
            />
</>}
          workspace={<>
            {menu ? <>        {t(
          menu && (
            <aside
              className="panel analytics-menu"
              aria-label={t("Analytics modes")}
            >
              <header>
                <span className="eyebrow">{t("EXPLORE THE INDUSTRY")}</span>
                <button
                  aria-label={t("Close analytics menu")}
                  onClick={() => setMenu(false)}
                >
                  {t("\xD7")}
                </button>
              </header>
              <p className="muted">{t("Choose a lens. Read it on the map.")}</p>
              <nav>
                {t(
                  Object.entries(MODES).map(([id, m]) => (
                    <div className="mode-menu-row" key={id}>
                      <button
                        className={state.mode === id ? "active" : ""}
                        onClick={() => mode(id)}
                      >
                        <span>{t(m.icon)}</span>
                        {t(m.label)}
                        <i>{t("\u203A")}</i>
                      </button>
                      <button
                        className="mode-info"
                        aria-label={`${t("About analysis")}: ${t(m.label)}`}
                        title={`${t("About analysis")}: ${t(m.label)}`}
                        onClick={() => setHelp(id)}
                      >
                        ⓘ
                      </button>
                    </div>
                  )),
                )}
              </nav>
              <button
                className="clear quality-button"
                onClick={() => {
                  setQuality(true);
                  setCompare([]);
                  setSelectedRefinery("");
                }}
              >
                {t("Data quality & methodology \u2197")}
              </button>
            </aside>
          ),
        )}
</> : ["country", "refinery", "comparison", "quality"].includes(activePanel) ? <>        {t(
          quality ? (
            <Quality quality={data.quality} onClose={() => setQuality(false)} />
          ) : activePanel === "comparison" ? (
            <Comparison
              ids={compare}
              atlas={atlas}
              onSecond={(id) => setCompare([compare[0], id])}
              onClose={() => { setCompare([]); setActivePanel(state.country ? "country" : "analysis"); }}
            />
          ) : (
            <Details
              country={atlas.byId.get(state.country)}
              refinery={atlas.refineriesById.get(selectedRefinery)}
              atlas={atlas}
              onClose={() => {
                update({
                  country: "",
                });
                setSelectedRefinery("");
                setActivePanel("analysis");
              }}
              onCompare={(id) => {
                setActivePanel("comparison");
                setCompare([id, ""]);
                setSelectedRefinery("");
              }}
              onCountry={country}
            />
          ),
        )}
</> : activeAnalysis ? <section className="analysis-workspace panel">        <div className="map-title">
          <span className="eyebrow">
            {t("GLOBAL EXPLORER /")}
            {t(" ")}
            {t(
              String(Object.keys(MODES).indexOf(state.mode) + 1).padStart(
                2,
                "0",
              ),
            )}
          </span>
          <h2>{t(MODES[analysisMode].label)}</h2>
          <p>
            {t(
              state.mode === "overview"
                ? "The world’s refining landscape"
                : metric.label,
            )}
            {t(" ")}
            <span>
              {t("\u2022 ")}
              {t(
                state.mode === "overview" ? "658 source records" : metric.unit,
              )}
            </span>
          </p>
        </div>
        <section className="panel map-controls" aria-label={t("Map controls")}>
          <label>
            {t("INDICATOR")}
            <IndicatorSelect label={t("Indicator")} value={state.metric}
              options={MODES[analysisMode].metrics.map(m => ({ value: m.id, label: t(m.label) }))}
              onChange={metric => update({ metric })} />
          </label>
          <label>
            {t("STATUS")}
            <select
              aria-label={t("Status filter")}
              value={state.status}
              onChange={(e) =>
                update({
                  status: e.target.value,
                })
              }
            >
              <option value="">{t("All statuses")}</option>
              {t(
                ["Active", "Closed", "Modernization", "Unknown"].map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                )),
              )}
            </select>
          </label>
          {t(
            state.mode === "anomalies" && (
              <label>
                {t("SIGNAL")}
                <select
                  aria-label={t("Anomaly category")}
                  value={state.anomaly}
                  onChange={(e) =>
                    update({
                      anomaly: e.target.value,
                    })
                  }
                >
                  {t(
                    ANOMALIES.map((a) => (
                      <option key={a} value={a}>
                        {t(a)}
                      </option>
                    )),
                  )}
                </select>
              </label>
            ),
          )}
          {t(
            state.mode === "prices" && (
              <label>
                {t("PRICE UNIT")}
                <select
                  aria-label={t("Price unit")}
                  value={state.priceUnit}
                  onChange={(e) =>
                    update({
                      priceUnit: e.target.value,
                    })
                  }
                >
                  <option value="">
                    {t(
                      priceUnits.length
                        ? "Choose source unit"
                        : "No price units in source",
                    )}
                  </option>
                  {t(
                    priceUnits.map((u) => (
                      <option key={u} value={u}>
                        {t(u)}
                      </option>
                    )),
                  )}
                </select>
              </label>
            ),
          )}
          <button className="close-analysis" onClick={() => update({ mode: "none", metric: "capacity" })}>{t("Close analysis")} ×</button>
          <button className="reset" onClick={reset}>
            {t("\u21BA Reset View")}
          </button>
        </section>
        <div className="active-filters">
          {t(
            state.owner && (
              <button onClick={() => owner("")}>
                {t("Owner:")}
                {state.owner}
                {t("\xD7")}
              </button>
            ),
          )}
          {t(
            state.status && (
              <button
                onClick={() =>
                  update({
                    status: "",
                  })
                }
              >
                {t("Status:")}
                {t(state.status)}
                {t("\xD7")}
              </button>
            ),
          )}
          {t(
            state.country && (
              <button
                onClick={() => {
                  update({
                    country: "",
                  });
                  setSelectedRefinery("");
                }}
              >
                {t("Country:")}
                {t(atlas.byId.get(state.country)?.name)}
                {t("\xD7")}
              </button>
            ),
          )}
        </div>
</section> : <button className="panel reopen-analysis" onClick={() => setMenu(true)}>{t("Open analytics menu")}</button>}
          </>}
          legend={activeAnalysis ? <>        <section
          className="panel legend"
          aria-label={t("Map legend")}
        >
          <header>
            <strong>
              {t(
                state.mode === "overview" ? "Refining capacity" : metric.label,
              )}
            </strong>
            <span>
              {t(state.mode === "overview" ? "Mt/year" : metric.unit)}
            </span>
          </header>
          {t(
            state.mode === "overview" ? (
              <>
                <div className="symbol-legend">
                  <span>
                    <i
                      style={{
                        width: 7,
                        height: 7,
                      }}
                    />
                    {t("1")}
                  </span>
                  <span>
                    <i
                      style={{
                        width: 16,
                        height: 16,
                      }}
                    />
                    {t("10")}
                  </span>
                  <span>
                    <i
                      style={{
                        width: 28,
                        height: 28,
                      }}
                    />
                    {t("50")}
                  </span>
                  <span>
                    <i className="missing-dot" />
                    {t("No data")}
                  </span>
                </div>
                <small>
                  {t("Square-root symbols \xB7 historical & current capacity")}
                </small>
              </>
            ) : state.metric === "classification" ? (
              <div className="class-legend">
                {t(
                  Object.entries(CLASSES).map(([name, color]) => (
                    <span key={name}>
                      <i
                        style={{
                          background: color,
                        }}
                      />
                      {t(name)}
                    </span>
                  )),
                )}
              </div>
            ) : state.mode === "anomalies" ? (
              <p>
                {t(coverage)}
                {t("matching countries \xB7 selected signal")}
              </p>
            ) : (
              <>
                <div
                  className="gradient"
                  style={
                    scale.diverging
                      ? {
                          background:
                            "linear-gradient(90deg,#bb8070,#e4e8e5,#69a097)",
                        }
                      : {}
                  }
                />
                <div className="legend-extents">
                  <span>{t(format(scale.min))}</span>
                  <span>{t(format(scale.max))}</span>
                </div>
                <small>
                  {t(coverage)}
                  {t("/")}
                  {t(atlas.stats.length)}
                  {t("countries with data \xB7")}
                  {t(" ")}
                  {t(
                    scale.diverging
                      ? "negative / positive"
                      : "quintile classes",
                  )}
                  <br />
                  <i className="no-data-swatch" />
                  {t("No data")}
                  {t(" ")}
                  {t(
                    state.mode === "prices"
                      ? "· No verified fuel prices in source"
                      : "",
                  )}
                </small>
                {t(
                  !scale.diverging && coverage > 0 && (
                    <small>
                      {t("Breaks:")}
                      {t(scale.cuts.map(format).join(" / "))}
                    </small>
                  ),
                )}
              </>
            ),
          )}
          {analysisMode === "age" && <small>{t("Young → old refineries")}</small>}
          {analysisMode === "capacity" && <small>{t("Lower → higher capacity")}</small>}
          <small className="year-note">
            {t(
              state.mode === "overview"
                ? "Inventory status: 2026 · capacity years vary"
                : metric.year === "production" ||
                    metric.year === "consumption" ||
                    ["crude", "ngpl", "gdp", "growth", "inflation"].includes(
                      metric.year,
                    )
                  ? "Source years: " +
                    [
                      ...new Set(
                        atlas.stats
                          .map((c) => c.years[metric.year])
                          .filter(Boolean),
                      ),
                    ]
                      .sort()
                      .join(", ")
                  : metric.year,
            )}
            {t(" ")}
            {t("\xB7 details on hover")}
          </small>
          {t(
            state.mode === "balance" && (
              <small>
                {t(
                  "Exploratory ratios across source years, not a same-year balance.",
                )}
              </small>
            ),
          )}
        </section>
</> : null}
          tools={<>        <div className="bottom-tools">
          <button
            className="panel data-button"
            onClick={() => {
              setQuality(!quality);
              setCompare([]);
              setSelectedRefinery("");
            }}
            aria-label={t("Open data quality")}
          >
            {t("\u24D8 Data quality")}
          </button>
          <BaseMapSwitcher value={state.basemap} onChange={basemap => update({ basemap })} />
        </div>
</>}
          summary={<>        <div className="kpis panel" aria-label={t("Map summary")}>
          {t(
            [
              ["Refineries", kpi.count],
              ["Active", kpi.active],
              ["Recorded Mt/year", kpi.capacity],
              ["Countries", countriesWithRefineries],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{t(format(value))}</strong>
                <span>{t(label)}</span>
              </div>
            )),
          )}
          <small>
            {t(kpi.knownCapacity)}
            {t("/")}
            {t(kpi.count)}
            {t(
              " capacity records \xB7 includes closed / possible duplicate sites",
            )}
          </small>
        </div>
</>}
          reset={<button className="panel reset-map" onClick={reset} aria-label={t("Reset View")}>↺</button>}
        />
      </main>
    );
  };
}

