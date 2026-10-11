import React, { useEffect, useState } from "react";
import { demoCompany } from "./mockData";

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
    const update = () =>
      setRoute(window.location.pathname + window.location.search);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  function navigate(to, options = {}) {
    window.history.pushState({}, "", to);
    setRoute(to);
    if (!options.preserveScroll) window.scrollTo(0, 0);
  }
  return [route, navigate];
}

export function Link({ to, navigate, children, ...props }) {
  return (
    <a
      href={to}
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
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}

function BrandLogo({ footer = false }) {
  return (
    <span className={footer ? "brand-lockup footer-lockup" : "brand-lockup"}>
      <svg className="brand-symbol" viewBox="0 0 40 48" aria-hidden="true">
        <path
          d="M20 2C15 12 5 24 5 33a15 15 0 0 0 30 0C35 24 25 12 20 2Z"
          fill="currentColor"
        />
        <path
          d="M21 11C18 22 11 27 11 34c0 5 4 9 9 9-3-4-3-8-1-12 2-5 5-11 2-20Z"
          fill="#fff"
          opacity=".86"
        />
      </svg>
      <span className="brand-words">
        <strong>PETROVEX</strong>
        <small>GLOBAL ENERGY SOLUTIONS</small>
      </span>
    </span>
  );
}

export function Shell({ navigate, route, children }) {
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
          text: "Get a fast, competitive quote from our team of experts.",
          links: [["Request a Quote", "/buy"]],
        }
      : path.startsWith("/products/")
        ? {
            title: "Ready to Secure Your Base Oil Supply?",
            text: "Get competitive pricing, reliable delivery and expert support from PETROVEX.",
            links: [["Request a Quote", "/buy"]],
          }
        : path === "/about"
          ? {
              title: "Let's Build a Stronger, More Efficient Tomorrow",
              text: "Partner with PETROVEX for reliable supply, assured quality and global delivery.",
              links: [
                ["Request a Quote", "/buy"],
                ["Contact Our Sales Team", "/contact"],
              ],
            }
          : {
              title: "Ready to Discuss Your Requirements?",
              text: "Get a fast, competitive quote from our team of experts.",
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
            aria-label="PETROVEX home"
          >
            <BrandLogo />
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
              to="/insights"
              navigate={go}
              aria-current={current("/insights")}
            >
              Knowledge Center
            </Link>
            <Link
              to="/contact"
              navigate={go}
              aria-current={current("/contact")}
            >
              Contact
            </Link>
          </nav>
          <Link to="/buy" navigate={navigate} className="button button-small">
            Request a Quote <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>
      <main id="main-content">{children}</main>
      {path !== "/staff" && path !== "/portal" && (
        <section className="footer-cta" aria-label="Commercial inquiry">
          <div className="container footer-cta-inner">
            <div>
              <span>GLOBAL SUPPLY. TRUSTED PARTNER.</span>
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
                  {label} <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <footer className="site-footer">
        <div className="container footer-inner mx-footer-grid">
          <div className="mx-footer-brand">
            <BrandLogo footer />
            <p>Base oils and industrial lubricants for global markets.</p>
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
              to="/products?category=Industrial%20Lubricants"
              navigate={navigate}
            >
              Industrial Lubricants
            </Link>
            <Link to="/products?category=Greases" navigate={navigate}>
              Greases
            </Link>
            <Link
              to="/products?category=Related%20Products"
              navigate={navigate}
            >
              Related Products
            </Link>
            <Link to="/insights" navigate={navigate}>
              Knowledge Center
            </Link>
          </div>
          <div className="mx-footer-column">
            <strong>Contact Us</strong>
            <span>{demoCompany.offices[0].phone}</span>
            <span>{demoCompany.offices[0].email}</span>
            <span>Dubai, UAE</span>
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
            <span>Social profiles pending</span>
          </div>
          <small>
            Demo preview: company, product, stock, team, office, certification,
            and technical details are placeholders. Industry visuals are
            illustrative.
          </small>
        </div>
        <div className="mx-footer-legal">
          <div className="container">
            © 2026 PETROVEX demo. All rights reserved.
            <span>
              Demo content is illustrative and not approved for publication.
            </span>
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
