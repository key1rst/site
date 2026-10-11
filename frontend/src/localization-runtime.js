import { useSyncExternalStore } from "react";
import { localeStorageKey, supportedLocales, translateText } from "./localization";

const listeners = new Set();
const textSources = new WeakMap();
const attributeSources = new WeakMap();
const localizedAttributes = ["placeholder", "aria-label", "title", "alt"];
let locale = (() => {
  try {
    const requested = new URLSearchParams(window.location.search).get("lang");
    if (supportedLocales.includes(requested)) return requested;
    const stored = window.localStorage.getItem(localeStorageKey);
    return supportedLocales.includes(stored) ? stored : "en";
  } catch {
    return "en";
  }
})();
let observer;

function localizeTextNode(node) {
  if (!node.parentElement || node.parentElement.closest("[data-no-translate], script, style, noscript, textarea, [contenteditable]")) return;
  const option = node.parentElement.closest("option");
  // Many existing selects use text as the implicit value. Preserve the API and
  // filtering value before changing the visible label.
  if (option && !option.hasAttribute("value")) option.setAttribute("value", option.textContent);
  let state = textSources.get(node);
  if (!state || node.nodeValue !== state.applied) {
    state = { source: node.nodeValue, applied: node.nodeValue };
    textSources.set(node, state);
  }
  const next = translateText(state.source, locale);
  state.applied = next;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function localizeAttributes(element) {
  if (element.closest("[data-no-translate]")) return;
  let sources = attributeSources.get(element);
  if (!sources) {
    sources = new Map();
    attributeSources.set(element, sources);
  }
  for (const name of localizedAttributes) {
    if (!element.hasAttribute(name)) continue;
    const current = element.getAttribute(name);
    let state = sources.get(name);
    if (!state || current !== state.applied) {
      state = { source: current, applied: current };
      sources.set(name, state);
    }
    const next = translateText(state.source, locale);
    state.applied = next;
    if (current !== next) element.setAttribute(name, next);
  }
}

function localizeSubtree(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  localizeAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeType === Node.TEXT_NODE) localizeTextNode(walker.currentNode);
    else localizeAttributes(walker.currentNode);
  }
}

function applyLocale() {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
  document.title = locale === "fa"
    ? "پادنا سیوان | قیر، فرآورده‌های نفتی و محصولات پتروشیمی"
    : "Padna Sivan | Industrial Materials Trading";
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = locale === "fa"
    ? "پادنا سیوان در زمینه قیر، فرآورده‌های نفتی، روغن‌های پایه، حلال‌های صنعتی و محصولات پتروشیمی فعالیت می‌کند."
    : "Padna Sivan works in bitumen, petroleum products, base oils, industrial solvents, and petrochemical materials.";
  localizeSubtree(document.getElementById("root"));
}

export function localizePath(path, selectedLocale = locale) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const url = new URL(path, window.location.origin);
  if (selectedLocale === "fa") url.searchParams.set("lang", "fa");
  else url.searchParams.delete("lang");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function setLocale(next, updateUrl = true) {
  if (!supportedLocales.includes(next) || next === locale) return;
  locale = next;
  try { window.localStorage.setItem(localeStorageKey, next); } catch { /* Storage can be disabled. */ }
  if (updateUrl) window.history.replaceState(window.history.state, "", localizePath(window.location.pathname + window.location.search + window.location.hash, next));
  applyLocale();
  listeners.forEach((listener) => listener());
}

export function syncLocaleFromUrl() {
  const requested = new URLSearchParams(window.location.search).get("lang");
  setLocale(requested === "fa" ? "fa" : "en", false);
}

export function getLocale() { return locale; }
function subscribeLocale(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, () => "en");
}

export function startLocalization() {
  if (locale === "fa" && new URLSearchParams(window.location.search).get("lang") !== "fa") {
    window.history.replaceState(window.history.state, "", localizePath(window.location.pathname + window.location.search + window.location.hash));
  }
  applyLocale();
  observer?.disconnect();
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") localizeSubtree(mutation.target);
      else if (mutation.type === "attributes") localizeAttributes(mutation.target);
      else mutation.addedNodes.forEach(localizeSubtree);
    }
  });
  observer.observe(document.getElementById("root"), {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: localizedAttributes,
  });
  return () => { observer?.disconnect(); observer = undefined; };
}
