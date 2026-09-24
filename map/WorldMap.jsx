import { t, useLanguage } from "../controls/i18n.jsx";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TankerLayer } from "./TankerLayer.mjs";
import { InfrastructureLayer, createInfrastructureCard } from "./InfrastructureLayer.mjs";
import { createTankerCard } from "./TankerCard.mjs";
import {
  Map,
  NavigationControl,
  ScaleControl,
  Popup,
  LngLatBounds,
  setWorkerUrl,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAPS } from "./basemaps.mjs";
import { makeStyle, featureCollection, radiusExpression } from "./layers.mjs";
import { format } from "../utils/numbers.mjs";
import { metricYear } from "../analytics/atlas.mjs";
setWorkerUrl(workerUrl);
const worldZoom = () =>
  Math.max(-0.7, Math.min(1.6, Math.log2(window.innerWidth / 512) - 0.15));
export default function WorldMap({
  geometry,
  atlas,
  rows,
  state,
  values,
  scale,
  metric,
  onSelect,
  onReady,
  hoverOwner,
  selectedRefinery = "",
  focus,
  onViewportChange,
  tankers = null,
  tankersEnabled = false,
  selectedVesselTypes,
  infrastructureVisibility = {},
  onInfrastructureCounts,
  onInfrastructureError,
}) {
  const language = useLanguage();
  const element = useRef(null),
    mapRef = useRef(null),
    live = useRef({}),
    tankerLayer = useRef(null),
    infrastructureLayer = useRef(null),
    infrastructurePopup = useRef(null),
    tankerPopup = useRef(null),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  live.current = {
    atlas,
    state,
    values,
    metric,
    onSelect,
    onViewportChange,
    onInfrastructureCounts,
    onInfrastructureError,
  };
  useEffect(() => {
    let instance;
    try {
      instance = new Map({
        container: element.current,
        style: makeStyle(),
        center: [0, 18],
        zoom: worldZoom(),
        minZoom: -0.7,
        maxZoom: 17,
        renderWorldCopies: false,
        attributionControl: {
          compact: true,
        },
      });
    } catch (e) {
      setNotice("WebGL unavailable: " + e.message);
      return;
    }
    mapRef.current = instance;
    const navigation = new NavigationControl({
        showCompass: false,
      });
    instance.addControl(navigation, "bottom-right");
    const controls = document.getElementById("map-navigation");
    if (controls) controls.append(navigation._container);
    instance.on("moveend", () => live.current.onViewportChange?.({
      center: instance.getCenter().toArray(), zoom: instance.getZoom(),
      bearing: instance.getBearing(), pitch: instance.getPitch(),
    }));
    instance.addControl(new ScaleControl(), "bottom-left");
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "370.5px",
    });
    instance.on("error", (e) => {
      setNotice(
        "Basemap unavailable. Local countries and refineries remain available.",
      );
    });
    instance.on("style.load", () => {
      instance.addSource("countries", {
        type: "geojson",
        data: geometry,
        promoteId: "id",
        tolerance: 0.6,
      });
      instance.addLayer({
        id: "countries-fill",
        type: "fill",
        source: "countries",
        paint: {
          "fill-color": ["coalesce", ["feature-state", "color"], "#e1e8e9"],
          "fill-opacity": 0.9,
        },
      });
      instance.addLayer({
        id: "countries-border",
        type: "line",
        source: "countries",
        paint: {
          "line-color": "#a9bec4",
          "line-width": 0.55,
        },
      });
      instance.addLayer({
        id: "country-selection",
        type: "line",
        source: "countries",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "line-color": "#e32636",
          "line-width": 3.2,
        },
      });
      // Label sprites are generated locally, so NAME_EN never depends on remote fonts.
      const labels = atlas.stats.map((c) => {
        const canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d");
        ctx.font = "500 22px Segoe UI";
        canvas.width = Math.ceil(ctx.measureText(c.name).width) + 16;
        canvas.height = 42;
        ctx.font = "500 22px Segoe UI";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(255,255,255,.9)";
        ctx.strokeText(c.name, 8, 21);
        ctx.fillStyle = "#526973";
        ctx.fillText(c.name, 8, 21);
        instance.addImage(
          "label-" + c.id,
          ctx.getImageData(0, 0, canvas.width, canvas.height),
          {
            pixelRatio: 2,
          },
        );
        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: c.center,
          },
          properties: {
            icon: "label-" + c.id,
          },
        };
      });
      instance.addSource("labels", {
        type: "geojson",
        data: featureCollection(labels),
      });
      instance.addLayer({
        id: "country-labels",
        type: "symbol",
        source: "labels",
        layout: {
          "icon-image": ["get", "icon"],
          "icon-allow-overlap": false,
          "icon-padding": 10,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.75, 5, 1],
        },
      });
      instance.addSource("refineries", {
        type: "geojson",
        data: featureCollection([]),
      });
      instance.addLayer({
        id: "refinery-circles",
        type: "circle",
        source: "refineries",
        paint: {
          "circle-radius": radiusExpression,
          "circle-color": [
            "case",
            ["==", ["get", "capacity"], null],
            "#9aaab0",
            "#247e91",
          ],
          "circle-opacity": 0.8,
          "circle-stroke-color": [
            "case",
            ["==", ["get", "id"], selectedRefinery || ""],
            "#e32636",
            "#ffffff",
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "id"], selectedRefinery || ""],
            4,
            1,
          ],
        },
      });
      tankerLayer.current = new TankerLayer(instance, { onSelect: (vessel, lngLat) => {
        tankerPopup.current?.remove();
        const content = createTankerCard(vessel, t);
        tankerPopup.current = new Popup({ maxWidth: "420px", offset: 18 }).setLngLat(lngLat).setDOMContent(content).addTo(instance);
      }});
      infrastructureLayer.current = new InfrastructureLayer(instance, {
        onSelect: (feature, lngLat, type) => {
          infrastructurePopup.current?.remove();
          infrastructurePopup.current = new Popup({ maxWidth: "390px", offset: 12 })
            .setLngLat(lngLat).setDOMContent(createInfrastructureCard(type, feature.properties)).addTo(instance);
        },
        onCounts: counts => live.current.onInfrastructureCounts?.(counts),
        onError: error => live.current.onInfrastructureError?.(error),
      });
      setReady(true);
      onReady?.(instance);
      if (import.meta.env.DEV) window.__oilAtlasMap = instance;
    });
    instance.on("click", (event) => {
      if (!instance.getLayer("countries-fill")) return;
      if (instance.getLayer("tankers") && instance.queryRenderedFeatures(event.point, { layers: ["tankers"] }).length) return;
      const found = instance.queryRenderedFeatures(event.point, {
        layers: ["refinery-circles", "countries-fill"],
      })[0];
      if (found)
        live.current.onSelect(
          found.layer.id === "refinery-circles"
            ? {
                type: "refinery",
                id: found.properties.id,
              }
            : {
                type: "country",
                id: found.properties.id,
              },
        );
    });
    instance.on("idle", () => {
      if (
        element.current &&
        instance.getLayer("countries-fill") &&
        instance.queryRenderedFeatures({
          layers: ["countries-fill"],
        }).length > 0
      )
        element.current.dataset.ready = "true";
    });
    instance.on("mousemove", (event) => {
      if (!instance.getLayer("refinery-circles")) return;

      const refinery = instance.queryRenderedFeatures(event.point, {
        layers: ["refinery-circles"],
      })[0];

      const country = instance.queryRenderedFeatures(event.point, {
        layers: ["countries-fill"],
      })[0];

      instance.getCanvas().style.cursor =
        refinery || country ? "pointer" : "";

      if (!refinery) {
        popup.remove();
        return;
      }

      const { atlas } = live.current;
      const r = atlas.refineriesById.get(refinery.properties.id);

      if (!r) {
        popup.remove();
        return;
      }

      const lines = [
        atlas.byId.get(r.country)?.name || t("Unmatched country"),
        r.owner || t("Owner: No data"),
        `${format(r.capacity === null ? null : r.capacity / 1e6)} Mt/year · capacity years vary`,
        r.status,
      ];

      const content = document.createElement("div");
      const heading = document.createElement("strong");

      heading.textContent = r.name;
      content.append(heading);

      for (const line of lines) {
        const div = document.createElement("div");
        div.textContent = line;
        content.append(div);
      }

      popup
        .setLngLat(event.lngLat)
        .setDOMContent(content)
        .addTo(instance);
    });
    instance.on("mouseout", () => popup.remove());
    return () => {
      tankerPopup.current?.remove();
      infrastructurePopup.current?.remove();
      infrastructureLayer.current?.destroy();
      infrastructureLayer.current = null;
      tankerLayer.current?.destroy();
      tankerLayer.current = null;
      popup.remove();
      instance.remove();
    };
  }, [geometry, atlas]);
  useEffect(() => {
    if (!ready || !infrastructureLayer.current) return;
    for (const [type, enabled] of Object.entries(infrastructureVisibility)) {
      infrastructureLayer.current.setVisible(type, enabled);
    }
    infrastructurePopup.current?.remove();
  }, [ready, infrastructureVisibility]);
  useEffect(() => {
    if (!ready || !tankerLayer.current) return;
    tankerLayer.current.setData(tankers || []);
    tankerLayer.current.setVisible(tankersEnabled);
    if (!tankersEnabled) tankerPopup.current?.remove();
  }, [ready, tankers, tankersEnabled]);
  useEffect(() => {
    if (!ready || !tankerLayer.current) return;
    tankerLayer.current.setFilter(selectedVesselTypes, state.owner);
    tankerPopup.current?.remove();
  }, [ready, selectedVesselTypes, state.owner]);
  useEffect(() => {
    if (!ready) return;
    const container = mapRef.current.getContainer();
    for (const [selector, label] of [
      [".maplibregl-ctrl-zoom-in", "Zoom in"],
      [".maplibregl-ctrl-zoom-out", "Zoom out"],
      [".maplibregl-ctrl-attrib-button", "Toggle attribution"],
    ]) {
      const control = container.querySelector(selector);
      if (control) {
        control.setAttribute("aria-label", t(label));
        control.setAttribute("title", t(label));
      }
    }
  }, [ready, language]);
  useEffect(() => {
    if (!ready) return;
    const m = mapRef.current;
    for (const c of atlas.stats)
      m.setFeatureState(
        {
          source: "countries",
          id: c.id,
        },
        {
          color:
            state.mode === "overview"
              ? "#e0e8e9"
              : scale.color(values.get(c.id)),
        },
      );
    m.setPaintProperty(
      "countries-fill",
      "fill-opacity",
      state.basemap === "atlas" ? 0.92 : state.mode === "overview" ? 0.13 : 0.7,
    );
    m.setFilter("country-selection", [
      "==",
      ["get", "id"],
      state.country || "",
    ]);
  }, [ready, atlas, values, scale, state.mode, state.country, state.basemap]);
  useEffect(() => {
    if (!ready) return;

    const m = mapRef.current;

    m.setPaintProperty(
      "refinery-circles",
      "circle-stroke-color",
      [
        "case",
        ["==", ["get", "id"], selectedRefinery || ""],
        "#e32636",
        "#ffffff",
      ],
    );

    m.setPaintProperty(
      "refinery-circles",
      "circle-stroke-width",
      [
        "case",
        ["==", ["get", "id"], selectedRefinery || ""],
        4,
        1,
      ],
    );
  }, [ready, selectedRefinery]);
  useEffect(() => {
    if (!ready) return;
    mapRef.current.getSource("refineries").setData(
      featureCollection(
        rows
          .filter((r) => r.validCoordinates)
          .map((r) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: r.coordinates,
            },
            properties: {
              id: r.id,
              owner: r.owner || "",
              capacity: r.capacity,
              status: r.status,
            },
          })),
      ),
    );
  }, [ready, rows]);
  useEffect(() => {
    if (!ready) return;
    const m = mapRef.current;
    m.setPaintProperty(
      "refinery-circles",
      "circle-opacity",
      hoverOwner
        ? ["case", ["==", ["get", "owner"], hoverOwner], 1, 0.12]
        : state.mode === "overview"
          ? 0.8
          : 0.57,
    );
    m.setPaintProperty(
      "refinery-circles",
      "circle-stroke-width",
      hoverOwner ? ["case", ["==", ["get", "owner"], hoverOwner], 2.5, 0.5] : 1,
    );
  }, [ready, hoverOwner, state.mode]);
  useEffect(() => {
    if (!ready) return;
    const m = mapRef.current,
      b = BASEMAPS[state.basemap];
    setNotice("");
    if (m.getLayer("basemap")) m.removeLayer("basemap");
    if (m.getSource("basemap")) m.removeSource("basemap");
    m.setPaintProperty("background", "background-color", b.color || "#edf3f5");
    if (b.requiresKey) {
      setNotice(
        "CARTO requires a provider API key. Showing the local Atlas map; configure VITE_CARTO_API_KEY.",
      );
      return;
    }
    if (b.url) {
      m.addSource("basemap", {
        type: "raster",
        tiles: [b.url],
        tileSize: 256,
        maxzoom: b.maxzoom,
        attribution: b.attribution,
      });
      m.addLayer(
        {
          id: "basemap",
          type: "raster",
          source: "basemap",
        },
        "countries-fill",
      );
    }
  }, [ready, state.basemap]);
  useEffect(() => {
    if (!ready || !focus) return;
    const m = mapRef.current;
    if (focus.world) {
      m.flyTo({
        center: [0, 18],
        zoom: worldZoom(),
        duration: 700,
      });
      return;
    }
    const points = focus.points?.filter((p) => Array.isArray(p));
    if (!points?.length) return;
    if (points.length === 1) {
      m.flyTo({
        center: points[0],
        zoom: focus.zoom || 5,
        duration: 700,
      });
      return;
    }
    const b = new LngLatBounds();
    points.forEach((p) => b.extend(p));
    m.fitBounds(b, {
      padding:
        window.innerWidth < 700
          ? 65
          : {
              top: 140,
              bottom: 140,
              left: 120,
              right: 340,
            },
      maxZoom: 6,
      duration: 850,
    });
  }, [ready, focus]);
  return (
    <>
      <div
        ref={element}
        className="world-map"
        aria-label={t("Interactive world oil map")}
      />
      {t(
        notice && document.getElementById("map-notices") && createPortal((
          <div role="status" className="map-notice">
            {t(notice)}
            <button
              aria-label={t("Dismiss map notice")}
              onClick={() => setNotice("")}
            >
              {t("\xD7")}
            </button>
          </div>
        ), document.getElementById("map-notices")),
      )}
    </>
  );
}








