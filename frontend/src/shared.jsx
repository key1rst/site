import React, { useEffect, useState } from "react";

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
  function navigate(to) {
    window.history.pushState({}, "", to);
    setRoute(to);
    window.scrollTo(0, 0);
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
            aria-label="Industrial Oils home"
          >
            <span className="brand-mark">IO</span>
            <span>
              INDUSTRIAL
              <br />
              <b>OILS</b>
            </span>
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
              Request a quote
            </Link>
            <Link to="/stock" navigate={go} aria-current={current("/stock")}>
              Current stock
            </Link>
            <Link to="/sell" navigate={go} aria-current={current("/sell")}>
              Sell to us
            </Link>
            <Link to="/about" navigate={go} aria-current={current("/about")}>
              About
            </Link>
            <Link
              to="/contact"
              navigate={go}
              aria-current={current("/contact")}
            >
              Contact
            </Link>
            <Link to="/portal" navigate={go} aria-current={current("/portal")}>
              Client portal
            </Link>
          </nav>
          <Link to="/buy" navigate={navigate} className="button button-small">
            Request a quote <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <main id="main-content">{children}</main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <b>INDUSTRIAL OILS</b>
            <p>Product discovery and commercial inquiries.</p>
          </div>
          <div>
            <Link to="/products" navigate={navigate}>
              Products
            </Link>
            <Link to="/stock" navigate={navigate}>
              Stock
            </Link>
            <Link to="/contact" navigate={navigate}>
              Contact
            </Link>
            <Link to="/staff" navigate={navigate}>
              Staff sign in
            </Link>
            <Link to="/portal" navigate={navigate}>
              Client portal
            </Link>
          </div>
          <small>Company identity and contact details pending approval.</small>
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
