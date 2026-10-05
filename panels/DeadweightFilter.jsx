import React, { useEffect, useRef, useState } from 'react';
import { t, useLanguage } from '../controls/i18n.jsx';
import {
  DEADWEIGHT_CLASSES,
  deadweightSelectionState,
  selectAllDeadweightClasses,
  toggleDeadweightClass,
} from '../map/vessel-types.mjs';

export default function DeadweightFilter({selected,onChange,counts,enabled=true}) {
  useLanguage();
  const [open,setOpen] = useState(false);
  const all = useRef(null);
  const selection = deadweightSelectionState(selected);
  const known = Object.values(counts || {}).reduce((sum,value)=>sum+(Number(value)||0),0);

  useEffect(()=>{ if (all.current) all.current.indeterminate=selection.indeterminate; },[selection.indeterminate,open]);

  return <section className="panel deadweight-filter" aria-label={t('Filter by deadweight')}>
    <button className="deadweight-filter-trigger" aria-expanded={open} aria-controls="deadweight-filter-options" onClick={()=>setOpen(value=>!value)}>
      <span>{t('By deadweight')}</span>
      <span>{selection.checked ? known : selected.length} {open?'▴':'▾'}</span>
    </button>
    {open && <div id="deadweight-filter-options" className="deadweight-filter-options">
      <label className="deadweight-class-all">
        <input ref={all} type="checkbox" checked={selection.checked} disabled={!enabled} onChange={event=>onChange(selectAllDeadweightClasses(event.target.checked))}/>
        <span>{t('All deadweight classes')}</span><span>{known}</span>
      </label>
      <div className="deadweight-class-list">
        {DEADWEIGHT_CLASSES.map(item=><label key={item.id}>
          <input type="checkbox" checked={selected.includes(item.id)} disabled={!enabled} onChange={event=>onChange(toggleDeadweightClass(selected,item.id,event.target.checked))}/>
          <span><strong>{item.label}</strong><small>{t(item.description)}</small></span>
          <span className="deadweight-class-count">{counts?.[item.id]||0}</span>
        </label>)}
      </div>
      <small className="deadweight-filter-note">{t('DWT ranges; vessels without deadweight stay visible when all classes are selected.')}</small>
    </div>}
  </section>;
}
