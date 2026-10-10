import React from "react";
import { createRoot } from "react-dom/client";
import { useRoute, Shell, Link } from "./shared";
import {
  Home,
  Catalog,
  ProductDetail,
  Stock,
  InquiryForm,
  About,
} from "./public";
import { Staff } from "./staff";
import { Portal } from "./portal";
import "./styles.css";

function App() {
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
  return <Shell navigate={navigate}>{content}</Shell>;
}

createRoot(document.getElementById("root")).render(<App />);
