import React, { useId, useRef, useState, useEffect } from "react";

export default function IndicatorSelect({ label, value, options, onChange }) {
  const id = useId(), root = useRef(null), trigger = useRef(null);
  const [open, setOpen] = useState(false), [index, setIndex] = useState(0);
  const selected = Math.max(0, options.findIndex(o => o.value === value));
  const choose = i => { onChange(options[i].value); setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    const outside = e => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => { if (open) document.getElementById(`${id}-${index}`)?.scrollIntoView({ block: "nearest" }); }, [open, index, id]);
  return <div className="indicator-select" ref={root}>
    <button ref={trigger} type="button" role="combobox" aria-label={label}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
      aria-activedescendant={open ? `${id}-${index}` : undefined}
      onClick={() => { setIndex(selected); setOpen(!open); }}
      onKeyDown={e => {
        if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(e.key)) {
          e.preventDefault(); e.stopPropagation();
          if (e.key === "Escape") { setOpen(false); return; }
          if (e.key === "Enter" || e.key === " ") { if (open) choose(index); else { setIndex(selected); setOpen(true); } return; }
          setOpen(true);
          setIndex(e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : Math.max(0, Math.min(options.length - 1, (open ? index : selected) + (e.key === "ArrowDown" ? 1 : -1))));
        } else if (e.key === "Tab") setOpen(false);
        else if (e.key.length === 1) {
          const found = options.findIndex(o => o.label.toLocaleLowerCase().startsWith(e.key.toLocaleLowerCase()));
          if (found >= 0) { setIndex(found); setOpen(true); }
        }
      }}><span>{options[selected]?.label}</span><span aria-hidden="true">⌄</span></button>
    {open && <div id={id} role="listbox" aria-label={label}>
      {options.map((o, i) => <div key={o.value} id={`${id}-${i}`} role="option" aria-selected={o.value === value}
        className={i === index ? "focused" : ""} onMouseDown={e => e.preventDefault()}
        onClick={() => choose(i)}>{o.label}<span>{o.value === value ? "✓" : ""}</span></div>)}
    </div>}
  </div>;
}
