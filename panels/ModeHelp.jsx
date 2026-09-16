import React, { useEffect, useRef } from "react";
import { MODES } from "../analytics/config.mjs";
import { DESCRIPTIONS } from "../analytics/descriptions.mjs";
import { t, useLanguage } from "../controls/i18n.jsx";
export default function ModeHelp({ mode, onClose }) {
  const language = useLanguage(),
    dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement,
      node = dialog.current;
    node.showModal();
    const close = (event) => {
      event.preventDefault();
      onClose();
    };
    node.addEventListener("cancel", close);
    return () => {
      node.removeEventListener("cancel", close);
      node.close();
      previous?.focus();
    };
  }, [onClose]);
  const headings =
    language === "ru"
      ? ["Что показывает", "Как рассчитывается", "Ограничения данных"]
      : ["What it shows", "How it is calculated", "Data limitations"];
  return (
    <dialog
      ref={dialog}
      className="mode-help panel"
      aria-labelledby="mode-help-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <span className="eyebrow">
          {language === "ru" ? "ОБ АНАЛИЗЕ" : "ABOUT THIS ANALYSIS"}
        </span>
        <button
          autoFocus
          onClick={onClose}
          aria-label={
            language === "ru"
              ? "Закрыть описание"
              : "Close analysis description"
          }
        >
          ×
        </button>
      </header>
      <h2 id="mode-help-title">{t(MODES[mode].label)}</h2>
      {DESCRIPTIONS[mode][language].map((paragraph, i) => (
        <section key={i}>
          <h3>{headings[i]}</h3>
          <p>{paragraph}</p>
        </section>
      ))}
    </dialog>
  );
}
