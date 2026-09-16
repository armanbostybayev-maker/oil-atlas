import { useSyncExternalStore } from "react";
import { ru } from "./ru.mjs";
let language = (() => {
  try {
    return localStorage.getItem("oil-atlas-language") === "ru" ? "ru" : "en";
  } catch {
    return "en";
  }
})();
const listeners = new Set();
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function useLanguage() {
  return useSyncExternalStore(
    subscribe,
    () => language,
    () => "en",
  );
}
export function setLanguage(value) {
  language = value === "ru" ? "ru" : "en";
  document.documentElement.lang = language;
  try {
    localStorage.setItem("oil-atlas-language", language);
  } catch {}
  listeners.forEach((fn) => fn());
}
const escape = (s) =>
  Array.from(s, (c) => ("\\^$.*+?()[]{}|".includes(c) ? "\\" + c : c)).join("");
const fragments = new RegExp(
  Object.keys(ru)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|"),
  "g",
);
/** Only display strings are translated; IDs, field names and source records stay unchanged. */
export function t(value) {
  if (language !== "ru" || typeof value !== "string") return value;
  return Object.hasOwn(ru, value)
    ? ru[value]
    : value.replace(fragments, (key) => ru[key]);
}
if (typeof document !== "undefined") document.documentElement.lang = language;
