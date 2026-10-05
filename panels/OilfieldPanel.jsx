import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { t, useLanguage } from '../controls/i18n.jsx';
import { EMPTY_FIELD_FILTERS, FIELD_STATUSES, fieldStatus, present, safeSourceUrl, statusStyle, validFieldCoordinates } from '../analytics/oilfields.mjs';
import { createTankerCard } from '../map/TankerCard.mjs';
import { oilfieldName, countryName } from '../utils/country-display.mjs';
import { oilfieldIconSvg, offshoreIconSvg } from '../map/oilfield-icon.mjs';
import '../styles/oilfields.css';

const number = value => typeof value === 'number' ? value.toLocaleString(undefined,{ maximumFractionDigits:8 }) : String(value);

export function Fold({ title, children, open, onChange, defaultOpen = true, className = '' }) {
  const [ownOpen,setOwnOpen] = useState(defaultOpen);
  const id = useId();
  const expanded = open ?? ownOpen;
  return <section className={`field-fold ${className}`}>
    <button type="button" className="field-fold-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => onChange ? onChange(!expanded) : setOwnOpen(!expanded)}>
      <span>{title}</span><span aria-hidden="true" className="field-chevron">{expanded ? '⌃' : '⌄'}</span>
    </button>
    <div id={id} className="field-fold-body" data-open={expanded} inert={!expanded} aria-hidden={!expanded}><div>{children}</div></div>
  </section>;
}

export function FieldLayerControls({ fields, tankersEnabled, onTankersChange, pipelineVisibility, onPipelineChange }) {
  const { preferences:p, setPreference } = fields;
  return <section className="panel field-layer-controls"><button type="button" className="oilfields-layer-toggle" aria-pressed={p.fields} onClick={() => setPreference('fields',!p.fields)}><span>{t('Oilfields')}</span><span aria-hidden="true">{p.fields ? '●' : '○'} {t(p.fields ? 'Layer on' : 'Layer off')}</span></button><details><summary>{t('Map layers')}</summary><div>
    {[[t('Tankers'),tankersEnabled,onTankersChange],[t('Oilfields'),p.fields,value => setPreference('fields',value)],[t('Oilfield clusters'),p.clusters,value => setPreference('clusters',value)],[t('Oilfield analytics'),p.analytics,value => setPreference('analytics',value)]].map(([label,value,change]) => <label key={label}><input type="checkbox" checked={value} onChange={event => change(event.target.checked)} />{label}</label>)}
  {[['oil','Нефтепроводы'],['gas','Газопроводы']].map(([type,label])=><label key={type}><input type="checkbox" checked={Boolean(pipelineVisibility?.[type])} onChange={e=>onPipelineChange(type,e.target.checked)} />{label}</label>)}
    </div></details></section>;
}

function FieldFilters({ fields, onSelect }) {
  const language = useLanguage();
  const { preferences, setPreference } = fields;
  const [draft,setDraft] = useState(preferences.filters);
  const [page,setPage] = useState(0);
  useEffect(() => { setDraft(preferences.filters); setPage(0); },[preferences.filters]);
  const options = useMemo(() => Object.fromEntries(['country','status','objectType','fuelType','operator','coordinateAccuracy'].map(key => [key,[...new Set(fields.fields.map(field => key === 'status' ? fieldStatus(field) : field[key] || (key === 'coordinateAccuracy' ? 'unknown' : '')).filter(Boolean))].sort((a,b) => a.localeCompare(b))])),[fields.fields]);
  const update = (key,value) => setDraft(previous => ({...previous,[key]:value}));
  const apply = event => { event.preventDefault(); setPreference('filters',draft); };
  const reset = () => { const clean = {...EMPTY_FIELD_FILTERS}; setDraft(clean); setPreference('filters',clean); };
  const select = (key,label,values) => <label key={key}>{t(label)}<select aria-label={t(label)} value={draft[key]} onChange={event => update(key,event.target.value)}><option value="">{t('All')}</option>{values.map(value => <option value={value} key={value}>{key === 'status' ? t(FIELD_STATUSES[value]?.label || value) : t(value)}</option>)}</select></label>;
  return <Fold title={t('Oilfield filters')} defaultOpen={false}>
    <form className="field-filters" onSubmit={apply}>
      <label className="field-wide">{t('Find oilfield')}<input type="search" value={draft.query} onChange={event => update('query',event.target.value)} placeholder={t('Name or ID')} /></label>
      {select('country','Oilfield country',options.country || [])}
      {select('status','Oilfield status',options.status || [])}
      {select('objectType','Object type',options.objectType || [])}
      {select('fuelType','Fuel type',options.fuelType || [])}
      {select('operator','Operator',options.operator || [])}
      {select('accuracy','Coordinate accuracy',options.coordinateAccuracy || [])}
      {select('reserves','Reserves data',['yes','no'])}{select('production','Production data',['yes','no'])}
      {[['discovery','Discovery year'],['start','Production start year']].map(([key,label]) => <fieldset className="field-wide" key={key}><legend>{t(label)}</legend><label>{t('From')}<input aria-label={`${t(label)}: ${t('From')}`} type="number" min="1800" max="2200" value={draft[key+'From']} onChange={event => update(key+'From',event.target.value)} /></label><label>{t('To')}<input aria-label={`${t(label)}: ${t('To')}`} type="number" min={draft[key+'From'] || 1800} max="2200" value={draft[key+'To']} onChange={event => update(key+'To',event.target.value)} /></label></fieldset>)}
      <div className="field-filter-actions field-wide"><button type="submit" className="field-primary">{t('Apply')}</button><button type="button" onClick={reset}>{t('Reset filters')}</button></div>
      <button className="field-wide field-area-button" type="button" disabled={!fields.currentViewport.current?.bounds} onClick={() => {
        const next = {...draft,bounds:fields.currentViewport.current.bounds}; setDraft(next); setPreference('filters',next);
      }}>{t('Show only in current map area')}</button>
      {draft.bounds && <button className="field-wide" type="button" onClick={() => { const next = {...draft,bounds:null}; setDraft(next); setPreference('filters',next); }}>{t('Clear area restriction')}</button>}
    </form>
    <p className="field-note" role="status">{t('Found objects')}: {fields.filtered.length.toLocaleString()} · {t('With coordinates')}: {fields.filtered.filter(validFieldCoordinates).length.toLocaleString()}</p>
    <div className="field-results" aria-label={t('Oilfield search results')}>
      {fields.filtered.slice(page*20,page*20+20).map(field => <button key={field.id} onClick={() => onSelect(field)} title={`${field.name} · ${field.country || ''}`}><span>{oilfieldName(field,language)}</span><small>{countryName(field.country,language)}{!validFieldCoordinates(field) ? ` · ${t('No coordinates')}` : ''}</small></button>)}
    </div>
    {fields.filtered.length > 20 && <div className="field-pages"><button disabled={page === 0} onClick={() => setPage(page-1)}>{t('Previous')}</button><span>{page+1} / {Math.ceil(fields.filtered.length/20)}</span><button disabled={(page+1)*20 >= fields.filtered.length} onClick={() => setPage(page+1)}>{t('Next')}</button></div>}
  </Fold>;
}

function Attributes({ pairs }) {
  const available = pairs.filter(([,value]) => present(value));
  if (!available.length) return <p className="field-note">{t('No open data')}</p>;
  return <dl className="field-attributes">{available.map(([label,value]) => <div key={label}><dt>{t(label)}</dt><dd title={String(value)}>{/year|^ID$|^Latitude$|^Longitude$/i.test(label) ? String(value) : number(value)}</dd></div>)}</dl>;
}

export function FieldDetails({ field }) {
  const language = useLanguage();
  const available = prefix => ['', 'Unit', 'Year', 'Class'].some(suffix => present(field[prefix+suffix]));
  const measure = (prefix,label) => <Attributes pairs={[
    [label,field[prefix]],['Unit',field[prefix+'Unit']],['Data year',field[prefix+'Year']],['Reserve class',field[prefix+'Class']],
  ]} />;
  const source = safeSourceUrl(field.sourceUrl);
  return <div className="field-detail" data-field-id={field.id}>
    <h3 title={field.name}>{oilfieldName(field,language)}</h3>
    <span className="field-status" style={{'--status-color':statusStyle(fieldStatus(field)).color}}>{t(FIELD_STATUSES[fieldStatus(field)]?.label || field.status || 'Unknown status')}</span>
    <Fold title={t('Basic information')}>
      <Attributes pairs={[
        ['ID',field.id],['Local name',field.localName],['Country',countryName(field.country,language)],['Region',field.region],['Object type',field.objectType ? t(field.objectType) : null],['Fuel type',field.fuelType ? t(field.fuelType) : null],['Coordinate accuracy',field.coordinateAccuracy ? t(field.coordinateAccuracy) : null],['Latitude',field.lat],['Longitude',field.lon],['Operator',field.operator],['Owner',field.owner],['Parent company',field.parentCompany],['Basin',field.basin],['Block / licence',field.block],['Project / complex',field.project],['Discovery year',field.discoveryYear],['FID year',field.fidYear],['Production start year',field.productionStart],['Status source',field.statusSource],['Status year',field.statusYear],
      ]} />
    </Fold>
    <Fold title={t('Production')}>
      {available('oilProduction') || available('gasProduction') ? <>{available('oilProduction') ? measure('oilProduction','Oil production') : null}{available('gasProduction') ? measure('gasProduction','Gas production') : null}</> : <p className="field-note">{t('No open data')}</p>}
    </Fold>
    <Fold title={t('Reserves')}>
      {available('oilReserves') || available('gasReserves') ? <>{available('oilReserves') ? measure('oilReserves','Oil reserves') : null}{available('gasReserves') ? measure('gasReserves','Gas reserves') : null}</> : <p className="field-note">{t('No open data')}</p>}
    </Fold>
    {source && <a className="field-source" href={source} target="_blank" rel="noopener noreferrer">{t('Open source')} ↗</a>}
  </div>;
}

function Chart({ title, entries, filterKey, fields, vertical = false }) {
  const max = Math.max(1,...entries.map(entry => entry.count));
  const filter = fields.preferences.filters;
  return <section className="field-chart" aria-label={t(title)}><h3>{t(title)}</h3>
    <div className={vertical ? 'field-chart-columns' : 'field-chart-rows'}>{entries.map(({name,count}) => {
      const label = filterKey === 'status' ? t(FIELD_STATUSES[name]?.label || name) : name;
      return <button key={name} title={`${label}: ${count.toLocaleString()}`} aria-label={`${label}: ${count.toLocaleString()}`} aria-pressed={filter[filterKey] === name} onClick={() => fields.setPreference('filters',{...filter,[filterKey]:filter[filterKey] === name ? '' : name})} style={{'--bar':`${count/max*100}%`,'--bar-color':filterKey === 'status' ? statusStyle(name).color : '#367e88'}}>
        <span className="field-chart-label">{label}</span><span className="field-chart-track"><i /></span><strong>{count.toLocaleString()}</strong>
      </button>;
    })}</div>{!entries.length && <p className="field-note">{t('No objects in view')}</p>}
  </section>;
}

export function TankerAttributes({ vessel, grouped = true }) {
  const language = useLanguage();
  const host = useRef(null);
  useEffect(() => {
    host.current.replaceChildren(createTankerCard(vessel,t,{ grouped }));
  },[vessel,language,grouped]);
  return <div ref={host} data-tanker-id={vessel.mmsi} />;
}

export default function OilfieldPanel({ fields, selectedTanker, onFieldSelect }) {
  useLanguage();
  const { analytics:a, preferences:p } = fields;
  return <aside className={`panel oilfield-panel ${p.panel ? 'is-open' : 'is-collapsed'}`} aria-label={t('Oilfield explorer')}>
    <Fold title={t('Oilfield explorer')} open={p.panel} onChange={value => fields.setPreference('panel',value)}>
      <div className="oilfield-panel-scroll">
        {fields.loading && <p className="field-note" role="status">{t('Loading oilfield registry…')}</p>}
        {fields.error && <p role="alert">{t('Oilfield registry unavailable')} <button onClick={fields.retry}>{t('Retry')}</button></p>}
        {!fields.loading && !fields.error && <>
          <FieldFilters fields={fields} onSelect={onFieldSelect} />
          {p.analytics && <Fold title={t('Oilfield analytics')}>
            <p className="field-note">{t('Visible map area and active filters')}</p>
            <div className="field-kpis"><div><strong data-testid="field-visible-count">{a.total.toLocaleString()}</strong><span>{t('Oilfields in view')}</span></div><div><strong>{a.countries.toLocaleString()}</strong><span>{t('Countries')}</span></div></div>
            {!p.fields && <p className="field-note">{t('Oilfield layer is hidden')}</p>}
            <Chart title="Status distribution" entries={a.statuses} filterKey="status" fields={fields} vertical />
            <Chart title="Top 5 countries" entries={a.topCountries} filterKey="country" fields={fields} />
            <Chart title="Top 5 operators" entries={a.topOperators} filterKey="operator" fields={fields} />
            <Attributes pairs={[["With reserves data",a.withReserves],["With production data",a.withProduction],["Exact coordinates",a.exact],["Approximate coordinates",a.approximate],["Unknown accuracy",a.unknownAccuracy]]} />
            <p className="field-note">{t('Reserves are not summed: classes, years and units differ; objects may overlap.')}</p>
          </Fold>}
          <div className="field-legend" aria-label={t('Oilfields')}>{[[oilfieldIconSvg(),'Onshore oilfields'],[offshoreIconSvg(),'Offshore oilfields']].map(([svg,label]) => <span key={label}><img width="26" height="26" alt="" src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)} />{t(label)}</span>)}</div>
          <p className="field-note">{t('Location type is estimated from coordinates and coastline; coastal locations may be inaccurate.')}</p>
          <p className="field-note field-quality">{t('Registry')}: {fields.quality?.total.toLocaleString()} · {t('Without valid coordinates')}: {fields.quality?.invalidCoordinateIds.length.toLocaleString()}. {t('These records remain searchable but are not drawn on the map.')}</p>
        </>}
      </div>
    </Fold>
  </aside>;
}
