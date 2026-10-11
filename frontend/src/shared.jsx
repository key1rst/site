import React, { useEffect, useState } from "react";
import { companyProfile } from "./companyProfile";
import { Icon } from "./design-system";
import { getLocale, localizePath, setLocale, syncLocaleFromUrl } from "./localization-runtime";

export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : "Please check the information and try again.";
    throw new Error(detail);
  }
  return data;
}

export function useRoute() {
  const [route, setRoute] = useState(
    window.location.pathname + window.location.search,
  );
  useEffect(() => {
    const update = () => {
      syncLocaleFromUrl();
      setRoute(window.location.pathname + window.location.search);
    };
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  function navigate(to, options = {}) {
    const target = localizePath(to, getLocale());
    window.history.pushState({}, "", target);
    setRoute(target);
    if (!options.preserveScroll) window.scrollTo(0, 0);
  }
  return [route, navigate];
}

export function Link({ to, navigate, children, ...props }) {
  const href = localizePath(to, getLocale());
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          navigate(href);
        }
      }}
    >
      {children}
    </a>
  );
}

function BrandLogo({ footer = false, locale = "en" }) {
  return (
    <span className={footer ? "brand-lockup footer-lockup" : "brand-lockup"}>
      <span className="brand-words">
        <strong data-no-translate lang={locale}>{locale === "fa" ? companyProfile.nameFa : companyProfile.name}</strong>
        <small data-no-translate lang={locale === "fa" ? "en" : "fa"}>{locale === "fa" ? companyProfile.name : companyProfile.nameFa}</small>
      </span>
    </span>
  );
}

export function Shell({ navigate, route, locale, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const path = route.split("?")[0];
  const go = (to) => {
    setMenuOpen(false);
    navigate(to);
  };
  const current = (to) =>
    path === to || (to === "/products" && path.startsWith("/products/"))
      ? "page"
      : undefined;
  const cta =
    path === "/products"
      ? {
          title: "Need a Custom Quantity or Specific Grade?",
          text: "Send your product, quantity, and destination for review.",
          links: [["Request a Quote", "/buy"]],
        }
      : path.startsWith("/products/")
        ? {
            title: "Need a quotation for this product?",
            text: "Share the grade, quantity, and destination for a reviewed quotation.",
            links: [["Request a Quote", "/buy"]],
          }
        : path === "/about"
          ? {
              title: "Discuss your requirements with us",
              text: "Discuss a purchasing requirement or a private offer with the company.",
              links: [
                ["Request a Quote", "/buy"],
                ["Contact Our Sales Team", "/contact"],
              ],
            }
          : {
              title: "Ready to Discuss Your Requirements?",
              text: "Send a purchase requirement or contact the company directly through the inquiry form.",
              links: [
                ["Request a Quote", "/buy"],
                ["View Products", "/products"],
                ["Contact Us", "/contact"],
              ],
            };
  useEffect(() => setMenuOpen(false), [route]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner container">
          <Link
            to="/"
            navigate={go}
            className="brand"
            aria-label="Padna Sivan home"
          >
            <BrandLogo locale={locale} />
          </Link>
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="menu-toggle-icon" aria-hidden="true" />
            Menu
          </button>
          <nav
            id="primary-navigation"
            aria-label="Main navigation"
            className={menuOpen ? "is-open" : ""}
          >
            <Link to="/" navigate={go} aria-current={current("/")}>
              Home
            </Link>
            <Link
              to="/products"
              navigate={go}
              aria-current={current("/products")}
            >
              Products
            </Link>
            <Link
              to="/buy"
              navigate={go}
              className="mobile-only-link"
              aria-current={current("/buy")}
            >
              Buy from us
            </Link>
            <Link to="/stock" navigate={go} aria-current={current("/stock")}>
              Current stock
            </Link>
            <Link
              to="/buy"
              navigate={go}
              className="desktop-buy-link"
              aria-current={current("/buy")}
            >
              Buy from us
            </Link>
            <Link to="/sell" navigate={go} aria-current={current("/sell")}>
              Sell to us
            </Link>
            <Link to="/about" navigate={go} aria-current={current("/about")}>
              About us
            </Link>
            <Link
              to="/contact"
              navigate={go}
              aria-current={current("/contact")}
            >
              Contact
            </Link>
            <Link
              to="/products"
              navigate={go}
              className="nav-search"
              aria-label="Search products"
            >
              <Icon name="search" size={19} />
            </Link>
            <button
              className="language-toggle"
              type="button"
              lang={locale === "fa" ? "en" : "fa"}
              aria-label={locale === "fa" ? "Switch to English" : "تغییر زبان به فارسی"}
              onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
            >
              {locale === "fa" ? "English" : "فارسی"}
            </button>
          </nav>
          <Link to="/buy" navigate={navigate} className="button button-small">
            Request a Quote <span className="direction-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </header>
      <main id="main-content">{children}</main>
      {path !== "/staff" && path !== "/portal" && (
        <section className="footer-cta" aria-label="Commercial inquiry">
          <div className="container footer-cta-inner">
            <div>
              <span>INDUSTRIAL MATERIALS · DIRECT COMPANY INQUIRIES</span>
              <h2>{cta.title}</h2>
              <p>{cta.text}</p>
            </div>
            <div className="mx-footer-cta-actions">
              {cta.links.map(([label, to], index) => (
                <Link
                  key={to}
                  to={to}
                  navigate={navigate}
                  className={index ? "mx-footer-cta-outline" : "button"}
                >
                  {label} <span className="direction-arrow" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <footer className="site-footer">
        <div className="container footer-inner mx-footer-grid">
          <div className="mx-footer-brand">
            <BrandLogo footer locale={locale} />
            <p>Bitumen, petroleum products, base oils, industrial solvents, and petrochemical materials.</p>
          </div>
          <div className="mx-footer-column">
            <strong>Quick Links</strong>
            <Link to="/" navigate={navigate}>
              Home
            </Link>
            <Link to="/products" navigate={navigate}>
              Products
            </Link>
            <Link to="/stock" navigate={navigate}>
              Current Stock
            </Link>
            <Link to="/buy" navigate={navigate}>
              Buy From Us
            </Link>
            <Link to="/sell" navigate={navigate}>
              Sell To Us
            </Link>
            <Link to="/about" navigate={navigate}>
              About Us
            </Link>
            <Link to="/contact" navigate={navigate}>
              Contact
            </Link>
          </div>
          <div className="mx-footer-column">
            <strong>Products</strong>
            <Link to="/products?category=Base%20Oils" navigate={navigate}>
              Base Oils
            </Link>
            <Link
              to="/products?category=Bitumen"
              navigate={navigate}
            >
              Bitumen
            </Link>
            <Link to="/products?category=Industrial%20Solvents" navigate={navigate}>
              Industrial Solvents
            </Link>
          </div>
          <div className="mx-footer-column">
            <strong>Contact Us</strong>
            <span>Use the inquiry form to reach the appropriate team.</span>
            <Link to="/contact" navigate={navigate}>
              Contact our team →
            </Link>
          </div>
          <div className="mx-footer-column">
            <strong>Account</strong>
            <Link to="/staff" navigate={navigate}>
              Staff sign in
            </Link>
            <Link to="/portal" navigate={navigate}>
              Client portal
            </Link>
          </div>
          <small>Company profile supplied by the project owner. Product and stock entries appear only when approved in the CRM. Industry visuals are illustrative.</small>
        </div>
        <div className="mx-footer-legal">
          <div className="container">
            © {new Date().getFullYear()} {companyProfile.name}.
          </div>
        </div>
      </footer>
    </>
  );
}

export function SectionHead({ eyebrow, title, text }) {
  return (
    <div className="section-head">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export function useData(path) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  useEffect(() => {
    let active = true;
    setState({ loading: true, data: null, error: "" });
    api(path)
      .then((data) => active && setState({ loading: false, data, error: "" }))
      .catch(
        (error) =>
          active &&
          setState({ loading: false, data: null, error: error.message }),
      );
    return () => {
      active = false;
    };
  }, [path]);
  return state;
}

export function DataState({ state, empty, retry }) {
  if (state.loading)
    return (
      <div className="notice" role="status">
        Loading information…
      </div>
    );
  if (state.error)
    return (
      <div className="notice error" role="alert">
        {state.error}{" "}
        <button className="inline-button" onClick={retry}>
          Retry
        </button>
      </div>
    );
  if (!state.data?.length) return <div className="notice">{empty}</div>;
  return null;
}
