import React from "react";
import "../styles/overlay.css";

// Intrinsic grid rows reserve real space for panels, regardless of language or content.
// Only the layout owns screen placement; its children stay in normal document flow.
export default function MapOverlayLayout({ brand, search, right, workspace, legend, tools, summary, reset }) {
  return <div className="map-overlay-layout">
    <div className="overlay-brand">{brand}</div>
    <div className="overlay-search">{search}</div>
    <div className="overlay-right">{right}</div>
    <div className="overlay-workspace" key="workspace">{workspace}</div>
    <div id="map-notices" className="overlay-notices" />
    <div className="overlay-bottom-left">{legend}{tools}</div>
    <div className="overlay-summary">{summary}</div>
    <div className="overlay-navigation">{reset}<div id="map-navigation" /></div>
  </div>;
}
