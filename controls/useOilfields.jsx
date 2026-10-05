import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decodeOilfields, EMPTY_FIELD_FILTERS, filterOilfields, oilfieldAnalytics } from '../analytics/oilfields.mjs';
const KEY = 'oil-atlas-fields-v1';
function saved() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY)) || {};
    const filters = { ...EMPTY_FIELD_FILTERS };
    for (const key of Object.keys(filters)) if (key !== 'bounds' && typeof value.filters?.[key] === 'string') filters[key] = value.filters[key];
    const bounds = value.filters?.bounds;
    if (Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isFinite)) filters.bounds = bounds;
    return { filters, fields: value.fields !== false, clusters: value.clusters !== false, analytics: value.analytics !== false, panel: value.panel !== false, tankers: value.tankers !== false };
  } catch { return { filters: { ...EMPTY_FIELD_FILTERS }, fields: true, clusters: true, analytics: true, panel: true, tankers: true }; }
}
export default function useOilfields() {
  const [preferences,setPreferences] = useState(saved);
  const [registry,setRegistry] = useState(null);
  const [error,setError] = useState('');
  const [attempt,setAttempt] = useState(0);
  const [viewport,setViewport] = useState(null);
  const [selected,setSelected] = useState(null);
  const timer = useRef(null);
  const currentViewport = useRef(null);
  useEffect(() => {
    try { localStorage.setItem(KEY,JSON.stringify(preferences)); } catch { /* Private/storage-limited browser. */ }
  },[preferences]);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch(import.meta.env.BASE_URL + 'data/oilfields.json',{ signal:controller.signal }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then(data => setRegistry({ fields:decodeOilfields(data),quality:data.quality })).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    });
    return () => controller.abort();
  },[attempt]);
  useEffect(() => () => clearTimeout(timer.current),[]);
  const onViewport = useCallback(viewport => {
    currentViewport.current = viewport;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setViewport(viewport),180);
  },[]);
  const setPreference = useCallback((key,value) => setPreferences(previous => ({...previous,[key]:value})),[]);
  const fields = registry?.fields || [];
  const filtered = useMemo(() => filterOilfields(fields,preferences.filters),[registry,preferences.filters]);
  const analytics = useMemo(() => oilfieldAnalytics(preferences.fields ? filtered : [],viewport?.bounds),[filtered,viewport,preferences.fields]);
  return { preferences, setPreference, fields, filtered, analytics, selected, setSelected, onViewport, currentViewport,
    quality:registry?.quality, loading:!registry && !error, error, retry:() => setAttempt(value => value + 1) };
}
