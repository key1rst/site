import React from "react";
import { createRoot } from "react-dom/client";
import { useRoute, Shell, Link } from "./shared";
import { InquiryForm } from "./public";
import {
  MockHome,
  MockCatalog,
  MockProductDetail,
  MockStock,
  MockAbout,
  MockTeamProfile,
  MockInsights,
} from "./mockPublic";
import { Staff } from "./staff";
import { Portal } from "./portal";
import "./styles.css";
import "./experience.css";
import "./reference-theme.css";
import "./mock-public.css";

function App() {
  const [route, navigate] = useRoute();
  const path = route.split("?")[0];
  let content;
  if (path === "/") content = <MockHome navigate={navigate} />;
  else if (path === "/products")
    content = <MockCatalog navigate={navigate} route={route} />;
  else if (path.startsWith("/products/"))
    content = (
      <MockProductDetail
        slug={decodeURIComponent(path.slice("/products/".length))}
        navigate={navigate}
      />
    );
  else if (path === "/stock") content = <MockStock navigate={navigate} />;
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
  else if (path === "/about") content = <MockAbout navigate={navigate} />;
  else if (path.startsWith("/team/"))
    content = (
      <MockTeamProfile
        slug={decodeURIComponent(path.slice(6))}
        navigate={navigate}
      />
    );
  else if (path === "/insights") content = <MockInsights navigate={navigate} />;
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
    <Shell navigate={navigate} route={route}>
      {content}
    </Shell>
  );
}

createRoot(document.getElementById("root")).render(<App />);
