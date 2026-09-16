import React from "react";
import { useLanguage, setLanguage } from "./i18n.jsx";
export default function LanguageSwitcher() {
  const language = useLanguage();
  return (
    <label className="panel language-switcher">
      <span aria-hidden="true">◎</span>
      <span>{language === "ru" ? "ЯЗЫК" : "LANGUAGE"}</span>
      <select
        aria-label="Language / Язык"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        <option value="en">English</option>
        <option value="ru">Русский</option>
      </select>
    </label>
  );
}
