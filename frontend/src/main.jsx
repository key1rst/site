import React, { useLayoutEffect } from "react";
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
import "./localization.css";

function App() {
  useLayoutEffect(startLocalization, []);
  const locale = useLocale();
  const [route, navigate] = useRoute();
  const path = route.split("?")[0];
  let content;
  if (path === "/") content = <Home navigate={navigate} />;
  else if (path === "/products")
    content = <Catalog navigate={navigate} route={route} />;
  else if (path.startsWith("/products/"))
    content = (
      <ProductDetail
        slug={decodeURIComponent(path.slice("/products/".length))}
        navigate={navigate}
      />
    );
  else if (path === "/stock") content = <Stock navigate={navigate} />;
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
      {content}
    </Shell>
  );
}

createRoot(document.getElementById("root")).render(<App />);
