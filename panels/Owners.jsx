import { t, useLanguage } from "../controls/i18n.jsx";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { format } from "../utils/numbers.mjs";
export default function Owners({ owners, selected, onSelect, onHover }) {
  const language = useLanguage(),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const container = useRef(null),
    trigger = useRef(null),
    search = useRef(null);
  const active = owners.find((o) => o.name === selected),
    max = owners[0]?.capacity || 1;
  const results = useMemo(
    () =>
      owners
        .map((owner, index) => ({ owner, rank: index + 1 }))
        .filter(({ owner }) =>
          owner.name
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
        ),
    [owners, query],
  );
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (e) => {
      if (!container.current?.contains(e.target)) {
        setOpen(false);
        onHover("");
      }
    };
    const escape = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        onHover("");
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onHover]);
  const choose = (name) => {
    onSelect(name === selected ? "" : name);
    onHover("");
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <aside
      className="owners-picker"
      ref={container}
      aria-label={
        language === "ru"
          ? "Компании — владельцы НПЗ"
          : "Refinery owner companies"
      }
    >
      <button
        ref={trigger}
        className="panel owners-trigger"
        aria-expanded={open}
        aria-controls="all-owner-companies"
        onClick={() => {
          setOpen(!open);
          onHover("");
        }}
      >
        <span>▦</span>
        <span>
          {language === "ru" ? "Все компании" : "All companies"}
          <small>
            {active
              ? active.name
              : `${owners.length} ${language === "ru" ? "владельцев НПЗ" : "refinery owners"}`}
          </small>
        </span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <section
          id="all-owner-companies"
          className="panel owners-dropdown"
          aria-label={
            language === "ru" ? "Список всех компаний" : "All companies list"
          }
        >
          <header>
            <span className="eyebrow">
              {language === "ru" ? "ВЛАДЕЛЬЦЫ НПЗ" : "REFINERY OWNERS"}
            </span>
            <button
              aria-label={
                language === "ru"
                  ? "Закрыть список компаний"
                  : "Close company list"
              }
              onClick={() => {
                setOpen(false);
                onHover("");
                trigger.current?.focus();
              }}
            >
              ×
            </button>
          </header>
          <input
            ref={search}
            className="owner-search"
            aria-label={
              language === "ru" ? "Поиск компании" : "Search companies"
            }
            placeholder={
              language === "ru" ? "Найти компанию…" : "Find a company…"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="panel-subtitle">
            {t("Known capacity · Mt/year")}
            <span>
              {results.length} / {owners.length}
            </span>
          </p>
          {active && (
            <div className="owner-summary">
              <strong>{active.name}</strong>
              <p>
                {active.count} {t("refineries")} · {format(active.capacity)}{" "}
                {t("Mt/year")} · {active.countries} {t("countries")}
              </p>
              <small>
                {t("Largest:")} {active.largest?.name || t("No data")}
              </small>
              <small>
                {t("Capacity coverage:")} {active.knownCapacity}/{active.count}
              </small>
              <button
                className="clear"
                onClick={() => {
                  onSelect("");
                  onHover("");
                }}
              >
                {t("Clear owner filter")} ×
              </button>
            </div>
          )}
          <ol className="owner-results">
            {results.map(({ owner: o, rank }) => (
              <li key={o.name}>
                <button
                  className={selected === o.name ? "selected" : ""}
                  aria-pressed={selected === o.name}
                  onMouseEnter={() => onHover(o.name)}
                  onMouseLeave={() => onHover("")}
                  onFocus={() => onHover(o.name)}
                  onBlur={() => onHover("")}
                  onClick={() => choose(o.name)}
                  title={`${o.name}\n${o.count} ${t("refineries")} · ${o.countries} ${t("countries")}\n${t("Largest:")} ${o.largest?.name || t("No data")}`}
                >
                  <span className="rank">{String(rank).padStart(2, "0")}</span>
                  <span className="owner-name">
                    {o.name}
                    <i
                      style={{ width: ((o.capacity || 0) / max) * 100 + "%" }}
                    />
                  </span>
                  <b>{t(format(o.capacity))}</b>
                </button>
              </li>
            ))}
          </ol>
          {!results.length && (
            <p className="muted">{t("No matching records")}</p>
          )}
          <small>
            {t(
              "Source owner groups; joint ventures are not split into equity shares.",
            )}
          </small>
        </section>
      )}
    </aside>
  );
}
