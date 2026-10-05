import React, { useState } from 'react';
import { t, useLanguage } from '../controls/i18n.jsx';
import { format } from '../utils/numbers.mjs';
import { metricYear } from '../analytics/atlas.mjs';
export default function CountryRanking({countries,metric,onSelect}) {
  const language=useLanguage(), [all,setAll]=useState(false);
  const ranked=countries.filter(c=>Number.isFinite(c[metric.id])).sort((a,b)=>b[metric.id]-a[metric.id] || a.name.localeCompare(b.name));
  return <section className="country-trade-ranking" aria-label={t('Country ranking')}>
    <h3>{t('Country ranking')}</h3>
    <p>{t('Countries with data')}: {ranked.length} / {countries.length}</p>
    <p>{t('Latest complete years; country years may differ. This is not a same-year global ranking.')}</p>
    <ol>{ranked.slice(0,all ? ranked.length : 20).map(c=><li key={c.id}><button onClick={()=>onSelect(c.id)}><span>{language==='ru' ? c.nameRu || c.name : c.name}<small>{metricYear(c,metric.id)}</small></span><strong>{format(c[metric.id])}<small>{t(metric.unit)}</small></strong></button></li>)}</ol>
    {ranked.length>20 && <button onClick={()=>setAll(!all)}>{t(all?'Show top 20':'Show all countries')}</button>}
    <p><a href="https://www.jodidata.org/oil/database/data-downloads.aspx" target="_blank" rel="noopener noreferrer">JODI-Oil ↗</a> · <a href="https://www.opec.org/assets/assetdb/asb-2025.pdf" target="_blank" rel="noopener noreferrer">OPEC ASB 2025 ↗</a></p>
  </section>;
}
