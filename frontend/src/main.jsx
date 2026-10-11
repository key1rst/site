import React, { Suspense, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { useRoute, Shell, Link } from "./shared";
import { Home, Catalog, ProductDetail, Stock, InquiryForm, About } from "./public";
import { Staff } from "./staff";
import { Portal } from "./portal";
import { PublicPeople } from "./PublicPeople";
import { startLocalization, useLocale } from "./localization-runtime";
import "./styles.css";
import "./experience.css";
import "./reference-theme.css";
import "./design-system.css";
import "./home.css";
import "./localization.css";

const DevCatalog = import.meta.env.DEV
  ? React.lazy(() =>
      import("./mockPublic").then((module) => ({ default: module.MockCatalog })),
    )
  : null;
const DevHomePreview = import.meta.env.DEV
  ? React.lazy(() => import("./devHomePreview"))
  : null;
const DevProductDetail = import.meta.env.DEV
  ? React.lazy(() =>
      import("./mockPublic").then((module) => ({ default: module.MockProductDetail })),
    )
  : null;
const DevStock = import.meta.env.DEV
  ? React.lazy(() =>
      import("./mockPublic").then((module) => ({ default: module.MockStock })),
    )
  : null;
const demoProductSlugs = new Set([
  "base-oil-sn150",
  "base-oil-sn500",
  "base-oil-sn600",
  "bright-stock",
  "hydraulic-oil-46",
  "lithium-grease-ep2",
]);

function App() {
  useLayoutEffect(startLocalization, []);
  const locale = useLocale();
  const [route, navigate] = useRoute();
  const path = route.split("?")[0];
  let content;
  if (path === "/") content = <Home navigate={navigate} DevHomePreview={DevHomePreview} />;
  else if (path === "/products")
    content = import.meta.env.DEV ? (
      <DevCatalog navigate={navigate} route={route} />
    ) : (
      <Catalog navigate={navigate} route={route} />
    );
  else if (path.startsWith("/products/")) {
    const slug = decodeURIComponent(path.slice("/products/".length));
    content = import.meta.env.DEV && demoProductSlugs.has(slug) ? (
      <DevProductDetail slug={slug} navigate={navigate} />
    ) : (
      <ProductDetail slug={slug} navigate={navigate} />
    );
  }
  else if (path === "/stock")
    content = import.meta.env.DEV
      ? <DevStock navigate={navigate} />
      : <Stock navigate={navigate} />;
  else if (path === "/buy")
    content = (
      <InquiryForm
        key={`buy-${route}`}
        kind="buy"
        navigate={navigate}
        route={route}
      />
    );
  else if (path === "/sell")
    content = (
      <InquiryForm key="sell" kind="sell" navigate={navigate} route={route} />
    );
  else if (path === "/contact")
    content = (
      <InquiryForm
        key="contact"
        kind="contact"
        navigate={navigate}
        route={route}
      />
    );
  else if (path === "/about") content = <About navigate={navigate} />;
  else if (path === "/team") content = <PublicPeople navigate={navigate} />;
  else if (path.startsWith("/team/"))
    content = (
      <div className="container page">
        <h1>Public profile unavailable</h1>
        <p className="page-lead">Individual biographies and photographs await company approval.</p>
        <Link to="/team" navigate={navigate}>View public record names →</Link>
      </div>
    );
  else if (path === "/insights")
    content = (
      <div className="container page">
        <h1>Knowledge center</h1>
        <p className="page-lead">
          Approved technical articles are being prepared. Ask the team for
          information about a specific product.
        </p>
        <Link to="/contact" navigate={navigate}>
          Ask a question →
        </Link>
      </div>
    );
  else if (path === "/staff") content = <Staff navigate={navigate} />;
  else if (path === "/portal") content = <Portal navigate={navigate} />;
  else
    content = (
      <div className="container page">
        <h1>Page not found</h1>
        <Link to="/" navigate={navigate}>
          Return home ↗
        </Link>
      </div>
    );
  return (
    <Shell navigate={navigate} route={route} locale={locale}>
      <Suspense
        fallback={<div className="container page notice" role="status">Loading products…</div>}
      >
        {content}
      </Suspense>
    </Shell>
  );
}

createRoot(document.getElementById("root")).render(<App />);
