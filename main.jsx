import { t, useLanguage } from "./controls/i18n.jsx";
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import WorldMap from "./map/WorldMap.jsx";
import Owners from "./panels/Owners.jsx";
import Details, { Comparison } from "./panels/Details.jsx";
import Quality from "./panels/Quality.jsx";
import Search from "./controls/Search.jsx";
import { createAtlasApp } from "./components/AtlasApp.jsx";
import "./styles/atlas.css";
const AtlasApp = createAtlasApp({
  WorldMap,
  Owners,
  Details,
  Comparison,
  Quality,
  Search,
});
class ErrorBoundary extends React.Component {
  state = {
    error: null,
  };
  static getDerivedStateFromError(error) {
    return {
      error,
    };
  }
  render() {
    return this.state.error ? (
      <main className="loading">
        <h1>{t("Unable to open Oil Atlas")}</h1>
        <p>{t(this.state.error.message)}</p>
        <button onClick={() => location.reload()}>{t("Reload")}</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Bootstrap() {
  useLanguage();
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      ["atlas.json", "countries.geojson"].map(async (f) => {
        const r = await fetch("/data/" + f, {
          signal: controller.signal,
        });
        if (!r.ok) throw new Error(`Dataset ${f}: HTTP ${r.status}`);
        return r.json();
      }),
    )
      .then(([atlas, geometry]) =>
        setData({
          atlas,
          geometry,
        }),
      )
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);
  return data ? (
    <AtlasApp data={data.atlas} geometry={data.geometry} />
  ) : (
    <main className="loading">
      <span className="brand-mark">{t("\u25C8")}</span>
      <h1>{t("Oil Atlas")}</h1>
      <p>{t(error || "Preparing the world view…")}</p>
      {t(
        error && (
          <button onClick={() => location.reload()}>{t("Retry")}</button>
        ),
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Bootstrap />
  </ErrorBoundary>,
);
