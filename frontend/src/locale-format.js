import { getLocale } from "./localization-runtime";

// Business dates stay Gregorian; changing the UI language must not silently
// change a quotation or shipment date to another calendar system.
export function formatDate(value, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return new Intl.DateTimeFormat(
    getLocale() === "fa" ? "fa-IR-u-ca-gregory" : "en-US",
    withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" },
  ).format(date);
}

export function formatNumber(value) {
  return new Intl.NumberFormat(getLocale() === "fa" ? "fa-IR" : "en-US").format(value);
}
