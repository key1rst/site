import React from "react";

const iconPaths = {
  home: <><path d="m3 10 9-7 9 7v10H3V10Z" /><path d="M9 20v-7h6v7" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c-3 3-4 6-4 9s1 6 4 9M12 3c3 3 4 6 4 9s-1 6-4 9" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  package: <><path d="M3 7 12 3l9 4v10l-9 4-9-4V7ZM3 7l9 4 9-4M12 11v10" /></>,
  file: <><path d="M6 2h8l5 5v15H6V2ZM14 2v6h5M9 12h7M9 16h7" /></>,
  quotation: <><path d="M6 2h8l5 5v15H6V2ZM14 2v6h5M9 12h7M9 16h7" /><path d="M12 10v8m2-6c-.7-.6-3-.8-3 .5 0 1.7 3 1 3 2.7 0 1.4-2.2 1.5-3 1" /></>,
  truck: <><path d="M2 6h12v11H2zM14 10h4l4 4v3h-8z" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  factory: <><path d="M3 21V9l6 4V9l6 4V5h6v16H3Z" /><path d="M6 17h2m3 0h2m3 0h2M18 5V2" /></>,
  proforma: <><path d="M6 2h8l5 5v15H6V2ZM14 2v6h5M9 12h7M9 16h7" /><path d="m10 19 1.5 1.5L15 17" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1" /></>,
  chart: <><path d="M3 21h18M5 17h3v4H5zM11 12h3v9h-3zM17 5h3v16h-3z" /></>,
  mail: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="m3 7 9 7 9-7" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m10 2-.5 2-2 1-2-.8-2 3 1.5 1.5-.2 2.3L3 12l1 4 2-.1 1.5 1.5L7 20l4 2 1-2 2-1 2 .8 2-3-1.5-1.5.2-2.3L21 12l-1-4-2 .1-1.5-1.5L17 4l-4-2-1 2-2-2Z" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  shield: <><path d="M12 2 20 5v6c0 5-3.4 8.7-8 11-4.6-2.3-8-6-8-11V5l8-3Z" /><path d="m8.5 12 2.4 2.4 4.7-5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  headset: <><path d="M3 13v-2a9 9 0 0 1 18 0v2M3 13h3v6H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2ZM21 13h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2ZM18 19c0 2-2 3-6 3" /></>,
  diamond: <><path d="M7 3h10l5 6-10 12L2 9l5-6ZM2 9h20M7 3l-2 6 7 12 7-12-2-6" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /><path d="M12 12 21 3" /></>,
  pin: <><path d="M12 22s7-7 7-13a7 7 0 1 0-14 0c0 6 7 13 7 13Z" /><circle cx="12" cy="9" r="2" /></>,
  flask: <><path d="M9 2h6M10 2v7L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V2M7 16h10" /></>,
};

export function Icon({ name, size = 20, className = "", ...props }) {
  const iconName = {
    products: "database", stock: "package", inquiries: "file",
    customers: "users", suppliers: "factory", crm: "chart",
    messages: "mail", documents: "file",
  }[name] || name;
  return (
    <svg
      className={`ds-icon mx-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {iconPaths[iconName] || iconPaths.package}
    </svg>
  );
}

const statusTone = {
  new: "info",
  pending: "warning",
  not_reviewed: "neutral",
  reviewing: "warning",
  technical_review: "warning",
  price_review: "warning",
  negotiating: "warning",
  quotation_preparing: "info",
  quotation_sent: "info",
  issued: "info",
  sent: "info",
  queued: "info",
  retry_wait: "warning",
  dead_letter: "error",
  paused: "neutral",
  enabled: "success",
  unscanned: "warning",
  clean: "success",
  proforma_issued: "purple",
  planned: "purple",
  booked: "purple",
  approved: "success",
  accepted: "success",
  completed: "success",
  shipped: "success",
  dispatched: "success",
  in_transit: "info",
  under_evaluation: "warning",
  supplier_offer: "warning",
  delivered: "success",
  won: "success",
  rejected: "error",
  declined: "error",
  cancelled: "neutral",
  lost: "error",
  exception: "error",
  failed: "error",
  closed: "neutral",
};

export function StatusTag({ value, children, tone }) {
  const key = String(value || "").toLowerCase().replaceAll(" ", "_");
  return (
    <span className={`ds-status ds-status-${tone || statusTone[key] || "neutral"}`}>
      {children || String(value || "Unknown").replaceAll("_", " ")}
    </span>
  );
}
