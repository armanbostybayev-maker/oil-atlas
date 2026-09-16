const osm =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
const key = import.meta.env?.VITE_CARTO_API_KEY;
export const BASEMAPS = {
  atlas: { name: "Atlas · clean", color: "#edf3f5" },
  osm: {
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: osm,
    maxzoom: 19,
  },
  positron: {
    name: "CARTO Positron",
    url: `https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png${key ? "?key=" + encodeURIComponent(key) : ""}`,
    attribution: osm + ' © <a href="https://carto.com/attributions">CARTO</a>',
    maxzoom: 20,
    requiresKey: !key,
  },
  dark: {
    name: "CARTO Dark Matter",
    url: `https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png${key ? "?key=" + encodeURIComponent(key) : ""}`,
    attribution: osm + ' © <a href="https://carto.com/attributions">CARTO</a>',
    maxzoom: 20,
    requiresKey: !key,
    color: "#192a33",
  },
  satellite: {
    name: "Esri World Imagery",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxzoom: 19,
  },
  topo: {
    name: "OpenTopoMap",
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      osm +
      ' · SRTM · © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxzoom: 17,
  },
};
