import { t, useLanguage } from "./i18n.jsx";
import React, { useMemo, useState } from "react";
export default function Search({ atlas, onCountry, onRefinery, onOwner }) {
  useLanguage();
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [index, setIndex] = useState(0);
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (q.length < 2) return [];
    return [
      ...atlas.stats
        .filter((c) =>
          (c.name + " " + c.nameRu).toLocaleLowerCase().includes(q),
        )
        .map((c) => ({
          type: "Country",
          name: c.name,
          id: c.id,
        })),
      ...atlas.refineries
        .filter((r) =>
          (r.name + " " + r.originalName).toLocaleLowerCase().includes(q),
        )
        .slice(0, 12)
        .map((r) => ({
          type: "Refinery",
          name: r.name,
          id: r.id,
        })),
      ...atlas.owners
        .filter((o) => o.name.toLocaleLowerCase().includes(q))
        .slice(0, 8)
        .map((o) => ({
          type: "Owner",
          name: o.name,
          id: o.name,
        })),
    ].slice(0, 16);
  }, [query, atlas]);
  function select(r) {
    if (!r) return;
    ({
      Country: onCountry,
      Refinery: onRefinery,
      Owner: onOwner,
    })[r.type](r.id);
    setOpen(false);
    setQuery("");
  }
  return (
    <div className="search">
      <span aria-hidden="true">{t("\u2315")}</span>
      <input
        aria-label={t("Search country, refinery or owner")}
        placeholder={t("Search country, refinery, owner")}
        value={query}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="search-results"
        aria-activedescendant={
          open && results[index] ? "result-" + index : undefined
        }
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(i + 1, results.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
          }
          if (e.key === "Enter") select(results[index]);
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {t(
        query && (
          <button aria-label={t("Clear search")} onClick={() => setQuery("")}>
            {t("\xD7")}
          </button>
        ),
      )}
      {t(
        open && query.length >= 2 && (
          <div
            id="search-results"
            className="search-results panel"
            role="listbox"
          >
            {t(
              results.length ? (
                results.map((r, i) => (
                  <button
                    role="option"
                    aria-selected={i === index}
                    id={"result-" + i}
                    className={i === index ? "focused" : ""}
                    key={r.type + r.id}
                    onClick={() => select(r)}
                  >
                    <span>{r.name}</span>
                    <small>{t(r.type)}</small>
                  </button>
                ))
              ) : (
                <p>{t("No matching records")}</p>
              ),
            )}
          </div>
        ),
      )}
    </div>
  );
}
