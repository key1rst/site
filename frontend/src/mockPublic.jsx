import React, { useEffect, useMemo, useState } from "react";
import { Link } from "./shared";
import { Icon } from "./design-system";
import { formatNumber } from "./locale-format";
import heroImage from "./assets/mock-hero.png";
import drumImage from "./assets/mock-drum.png";
import logisticsImage from "./assets/mock-logistics.png";
import teamImage from "./assets/mock-team.png";
import { stageQuoteDraft } from "./quoteDraft";
import {
  demoBenefits,
  demoCategories,
  demoCompany,
  demoFaqs,
  demoHomeStats,
  demoInsights,
  demoOverviewRows,
  demoPackaging,
  demoProducts,
  demoSpecs,
  demoTeam,
} from "./mockData";

function Arrow() {
  return <span className="mx-arrow" aria-hidden="true">→</span>;
}
function SectionTitle({ title, subtitle, link, linkText, navigate }) {
  return (
    <div className="mx-section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {link && (
        <Link to={link} navigate={navigate} className="mx-text-link">
          {linkText || "View all"} <Arrow />
        </Link>
      )}
    </div>
  );
}
function Action({ to, navigate, children, outline = false }) {
  return (
    <Link
      to={to}
      navigate={navigate}
      className={outline ? "mx-action mx-action-outline" : "mx-action"}
    >
      {children} <Arrow />
    </Link>
  );
}
function Status({ value }) {
  return (
    <span
      className={`mx-status ${value === "Limited" ? "mx-status-limited" : ""}`}
    >
      <span />
      {value === "Limited" ? "Limited Stock" : "In Stock"}
    </span>
  );
}
function DemoNote() {
  return <span className="mx-demo-note">Demo content</span>;
}
function quoteUrl(product, extra = {}) {
  return `/buy?${new URLSearchParams({ product_text: product.fullName || product.name, ...extra }).toString()}`;
}

function PhotoStrip({ item, className = "" }) {
  return (
    <div
      className={`mx-photo-strip ${className}`}
      style={{
        backgroundImage: `url(${logisticsImage})`,
        backgroundPosition: `${item.position} center`,
      }}
      role="img"
      aria-label={`${item.name} packaging illustration`}
    />
  );
}
function TeamPortrait({ member }) {
  return (
    <div
      className="mx-team-photo"
      style={{
        backgroundImage: `url(${teamImage})`,
        backgroundPosition: `${member.position} center`,
      }}
      role="img"
      aria-label={`Illustrative portrait for ${member.name}`}
    />
  );
}
function Packaging({ compact = false }) {
  return (
    <div
      className={compact ? "mx-packaging mx-packaging-compact" : "mx-packaging"}
    >
      {demoPackaging.map((item) => (
        <div className="mx-packaging-card" key={item.name}>
          <PhotoStrip item={item} />
          <strong>{item.name}</strong>
          <small>{item.detail}</small>
        </div>
      ))}
    </div>
  );
}
function Team({ navigate }) {
  return (
    <div className="mx-team-grid">
      {demoTeam.map((member) => (
        <Link
          to={`/team/${member.slug}`}
          navigate={navigate}
          className="mx-team-card"
          key={member.name}
        >
          <TeamPortrait member={member} />
          <strong>{member.name}</strong>
          <span>{member.role}</span>
        </Link>
      ))}
    </div>
  );
}
function BenefitList({ compact = false }) {
  return (
    <div
      className={compact ? "mx-benefits mx-benefits-compact" : "mx-benefits"}
    >
      {demoBenefits.map((item) => (
        <div className="mx-benefit" key={item.title}>
          <Icon name={item.icon} size={30} />
          <div>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StockTable({ navigate, short = false }) {
  const rows = short ? demoProducts.slice(0, 6) : demoProducts;
  return (
    <div className="mx-table-scroll">
      <table className="mx-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Grade</th>
            <th>Origin</th>
            <th>Quantity</th>
            <th>Packing</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((product) => (
            <tr key={product.slug}>
              <td>
                {product.category === "Base Oils" ? "Base Oil" : product.name}
              </td>
              <td>{product.grade}</td>
              <td>{product.origin}</td>
              <td>{formatNumber(product.quantity)} MT</td>
              <td>{product.packing}</td>
              <td>
                <Status value={product.status} />
              </td>
              <td>
                <Link
                  className="mx-table-action"
                  to={quoteUrl(product)}
                  navigate={navigate}
                >
                  Enquire <Arrow />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Hero({ mode, navigate, children, search, onSearch }) {
  return (
    <section
      className={`mx-hero mx-hero-${mode}`}
      style={{
        backgroundImage: `linear-gradient(90deg,rgba(2,23,46,.98),rgba(2,23,46,.78) 37%,rgba(2,23,46,.14) 74%),url(${heroImage})`,
      }}
    >
      <div className="mx-container mx-hero-inner">
        <div className="mx-hero-content">
          {children}
          {search && (
            <form className="mx-hero-search" onSubmit={onSearch}>
              <Icon name="search" size={19} />
              <input
                aria-label="Search products"
                value={search.value}
                onChange={search.onChange}
                placeholder="Search products, grades or specifications..."
              />
              <button type="submit">Search</button>
            </form>
          )}
        </div>
        <div className="mx-hero-side">
          SUPPLYING
          <br />
          INDUSTRY
          <br />
          WORLDWIDE
          <span />
        </div>
      </div>
    </section>
  );
}

function Insights({ navigate, cards = true }) {
  return cards ? (
    <div className="mx-insights-grid">
      {demoInsights.map((item) => (
        <article className="mx-insight" key={item.title}>
          <img src={item.image} alt="" loading="lazy" />
          <div>
            <small>{item.category}</small>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <div className="mx-industries">
      {[
        "Automotive",
        "Industrial Manufacturing",
        "Marine & Shipping",
        "Power Generation",
        "Construction & Mining",
        "Metallurgy & Steel",
      ].map((name, i) => (
        <div key={name}>
          <Icon
            name={["truck", "gear", "package", "flask", "target", "diamond"][i]}
            size={22}
          />
          {name}
        </div>
      ))}
    </div>
  );
}

export function MockHome({ navigate }) {
  const [search, setSearch] = useState("");
  return (
    <div className="mx-page mx-home">
      <Hero mode="home" navigate={navigate}>
        <h1>
          <em>Global Supplier of</em>
          <br />
          Base Oils & Industrial Lubricants
        </h1>
        <h2>Reliable Sourcing. Assured Quality. Worldwide Delivery.</h2>
        <p>
          Your trusted global partner for base oils, industrial lubricants,
          greases and related products. We connect supply with demand across
          international markets with integrity, quality and service.
        </p>
        <form
          className="mx-hero-search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/products?q=${encodeURIComponent(search.trim())}`);
          }}
        >
          <Icon name="search" size={19} />
          <input
            aria-label="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, grades or specifications..."
          />
          <button type="submit">Search</button>
        </form>
        <div className="mx-hero-actions">
          <Action to="/products" navigate={navigate}>
            View Products
          </Action>
          <Action to="/buy" navigate={navigate} outline>
            Request a Quote
          </Action>
          <Action to="/sell" navigate={navigate} outline>
            Sell To Us
          </Action>
        </div>
      </Hero>
      <div className="mx-container">
        <section className="mx-category-grid" aria-label="Product categories">
          {demoCategories.map((category) => (
            <Link
              to={`/products?category=${encodeURIComponent(category.name)}`}
              navigate={navigate}
              className="mx-category-card"
              key={category.name}
            >
              <img src={category.image} alt="" loading="lazy" />
              <span>
                <strong>
                  {category.name} <Arrow />
                </strong>
                <small>{category.description}</small>
              </span>
            </Link>
          ))}
        </section>
        <div className="mx-availability-choice">
          <section>
            <SectionTitle
              title="Current Availability"
              link="/stock"
              linkText="View All Stock"
              navigate={navigate}
            />
            <StockTable navigate={navigate} short />
          </section>
          <aside className="mx-why-panel">
            <h2>Why Choose Us</h2>
            <BenefitList />
          </aside>
        </div>
        <section className="mx-section">
          <SectionTitle
            title="Logistics & Packaging"
            subtitle="Multiple packaging options to meet your supply chain needs worldwide."
            link="/about"
            linkText="Learn More"
            navigate={navigate}
          />
          <Packaging />
        </section>
        <section className="mx-section">
          <SectionTitle
            title="Featured Products"
            link="/products"
            linkText="View All Products"
            navigate={navigate}
          />
          <div className="mx-featured-grid">
            {demoProducts.slice(0, 4).map((product) => (
              <Link
                to={`/products/${product.slug}`}
                navigate={navigate}
                className="mx-featured-card"
                key={product.slug}
              >
                <img src={product.image} alt="" loading="lazy" />
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.group}</small>
                  <p>{product.description}</p>
                  <b>
                    View Details <Arrow />
                  </b>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="mx-section mx-home-markets">
          <div>
            <SectionTitle
              title="Global Markets Served"
              subtitle="Supplying industries worldwide with reliable products and delivery."
            />
            <div className="mx-stat-cards">
              {demoHomeStats.map((item) => (
                <div key={item.label}>
                  <Icon name={item.icon} /> <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mx-map" aria-label="Illustrative global presence">
            <span>North America</span>
            <span>Europe</span>
            <span>Middle East</span>
            <span>Asia Pacific</span>
            <span>South America</span>
            <span>Africa</span>
          </div>
          <div>
            <SectionTitle
              title="Latest Insights"
              subtitle="Market insights, industry updates and technical resources."
              link="/insights"
              navigate={navigate}
            />
            <Insights cards={false} />
          </div>
        </section>
        <section className="mx-section mx-home-lower">
          <div>
            <SectionTitle
              title="Our Leadership Team"
              subtitle="A team of industry experts committed to your success."
            />
            <Team navigate={navigate} />
          </div>
          <div>
            <SectionTitle
              title="Latest Insights"
              subtitle="Market insights, industry updates and technical resources."
              link="/insights"
              navigate={navigate}
            />
            <Insights />
          </div>
        </section>
      </div>
    </div>
  );
}

const filterOptions = {
  category: [
    "Base Oils",
    "Industrial Lubricants",
    "Greases",
    "Related Products",
  ],
  grade: ["SN150", "SN500", "SN600", "BS150", "ISO VG 46", "EP2"],
  origin: ["UAE", "S. Korea", "Singapore", "China"],
  packing: ["Drum", "IBC", "Flexitank", "ISO Tank"],
  status: ["In Stock", "Limited"],
  application: ["Automotive", "Industrial", "Marine"],
};
function CatalogCard({ product, navigate }) {
  return (
    <article className="mx-catalog-card">
      <Status value={product.status} />
      <div className="mx-catalog-card-top">
        <img src={product.image} alt="" loading="lazy" />
        <div>
          <h3>{product.name}</h3>
          <span>{product.group}</span>
          <p>{product.description}</p>
        </div>
      </div>
      <dl>
        <div>
          <dt>Origin</dt>
          <dd>{product.origin}</dd>
        </div>
        <div>
          <dt>Available</dt>
          <dd>{formatNumber(product.quantity)} MT</dd>
        </div>
        <div>
          <dt>Packing</dt>
          <dd>{product.packing}</dd>
        </div>
      </dl>
      <div className="mx-card-actions">
        <Action to={quoteUrl(product)} navigate={navigate}>
          Request Quote
        </Action>
        <Action to={`/products/${product.slug}`} navigate={navigate} outline>
          View Details
        </Action>
      </div>
    </article>
  );
}

export function MockCatalog({ navigate, route }) {
  const url = new URLSearchParams(route.split("?")[1] || "");
  const routeSearch = url.get("q") || "";
  const [query, setQuery] = useState(routeSearch);
  const filters = Object.fromEntries(
    Object.keys(filterOptions).map((key) => [key, url.get(key) || ""]),
  );
  const [view, setView] = useState("grid");
  const [sort, setSort] = useState("relevance");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  useEffect(() => setQuery(routeSearch), [routeSearch]);
  const filtered = useMemo(() => {
    const found = demoProducts.filter((product) => {
      const text =
        `${product.name} ${product.fullName} ${product.grade} ${product.category} ${product.description}`.toLowerCase();
      if (routeSearch && !text.includes(routeSearch.toLowerCase()))
        return false;
      return Object.entries(filters).every(
        ([key, value]) => !value || product[key] === value,
      );
    });
    if (sort === "name") found.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "quantity") found.sort((a, b) => b.quantity - a.quantity);
    return found;
  }, [route, sort]);
  const setFilter = (key, value) => {
    const params = new URLSearchParams(route.split("?")[1] || "");
    if (value) params.set(key, value);
    else params.delete(key);
    navigate(`/products${params.size ? `?${params}` : ""}`, {
      preserveScroll: true,
    });
  };
  const clear = () => {
    setQuery("");
    navigate("/products", { preserveScroll: true });
  };
  return (
    <div className="mx-page mx-catalog">
      <Hero
        mode="catalog"
        navigate={navigate}
        search={{ value: query, onChange: (e) => setQuery(e.target.value) }}
        onSearch={(e) => {
          e.preventDefault();
          const params = new URLSearchParams(route.split("?")[1] || "");
          if (query.trim()) params.set("q", query.trim());
          else params.delete("q");
          navigate(`/products${params.size ? `?${params}` : ""}`);
        }}
      >
        <div className="mx-breadcrumb">Home › Products</div>
        <h1>
          Products & <em>Current Stock</em>
        </h1>
        <h2>
          High-Quality Base Oils, Industrial Lubricants & Related Products
        </h2>
        <p>
          Explore our wide range of base oils, industrial lubricants, greases
          and specialty products with real-time stock availability. Reliable
          sourcing. Assured quality. Worldwide delivery.
        </p>
      </Hero>
      <div className="mx-container mx-filter-container">
        <div className="mx-filter-ribbon">
          {Object.entries(filterOptions).map(([key, options]) => (
            <label key={key}>
              <span>
                {key === "status"
                  ? "Availability"
                  : key[0].toUpperCase() + key.slice(1)}
              </span>
              <select
                value={filters[key]}
                onChange={(e) => setFilter(key, e.target.value)}
              >
                <option value="">
                  {`All ${key === "status" ? "Availability" : {
                    category: "Categories", grade: "Grades", origin: "Origins",
                    packing: "Packings", application: "Applications",
                  }[key]}`}
                </option>
                {options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
      <div className="mx-container mx-catalog-layout">
        <aside
          className={`mx-filter-sidebar ${showMobileFilters ? "is-open" : ""}`}
        >
          <div className="mx-filter-sidebar-heading">
            <h2>Filter Products</h2>
            <div>
              <button type="button" onClick={clear}>
                Reset All
              </button>
              <button
                type="button"
                className="mx-mobile-filter-toggle"
                aria-expanded={showMobileFilters}
                onClick={() => setShowMobileFilters((open) => !open)}
              >
                {showMobileFilters ? "Hide filters" : "Show filters"}
              </button>
            </div>
          </div>
          {Object.entries(filterOptions).map(([key, options]) => (
            <fieldset key={key}>
              <legend>
                {key === "status"
                  ? "Availability"
                  : key[0].toUpperCase() + key.slice(1)}
              </legend>
              {options.map((option) => (
                <label key={option}>
                  <input
                    type="checkbox"
                    checked={filters[key] === option}
                    onChange={() =>
                      setFilter(key, filters[key] === option ? "" : option)
                    }
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          ))}
          <button
            type="button"
            className="mx-action mx-filter-apply"
            onClick={() => {
              setShowMobileFilters(false);
              document
                .querySelector(".mx-listings-heading")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Apply Filters
          </button>
        </aside>
        <div className="mx-catalog-main">
          <div className="mx-listings-heading">
            <h2>Product Listings</h2>
            <div>
              <span role="status">
                {`Showing ${filtered.length ? `1–${filtered.length}` : "0"} of ${filtered.length} products`}
              </span>
              <label>
                Sort by{" "}
                <select
                  aria-label="Sort products"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="relevance">Relevance</option>
                  <option value="name">Name</option>
                  <option value="quantity">Quantity</option>
                </select>
              </label>
              <div className="mx-view-toggle" aria-label="Product view">
                <button
                  type="button"
                  className={view === "grid" ? "active" : ""}
                  aria-pressed={view === "grid"}
                  onClick={() => setView("grid")}
                >
                  ▦ Grid View
                </button>
                <button
                  type="button"
                  className={view === "table" ? "active" : ""}
                  aria-pressed={view === "table"}
                  onClick={() => setView("table")}
                >
                  ▤ Table View
                </button>
              </div>
            </div>
          </div>
          {filtered.length ? (
            view === "grid" ? (
              <div className="mx-catalog-grid">
                {filtered.map((product) => (
                  <CatalogCard
                    product={product}
                    navigate={navigate}
                    key={product.slug}
                  />
                ))}
              </div>
            ) : (
              <div className="mx-table-scroll">
                <table className="mx-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Grade</th>
                      <th>Origin</th>
                      <th>Available</th>
                      <th>Packing</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((product) => (
                      <tr key={product.slug}>
                        <td>
                          <Link
                            to={`/products/${product.slug}`}
                            navigate={navigate}
                          >
                            {product.name}
                          </Link>
                        </td>
                        <td>{product.category}</td>
                        <td>{product.grade}</td>
                        <td>{product.origin}</td>
                        <td>{formatNumber(product.quantity)} MT</td>
                        <td>{product.packing}</td>
                        <td>
                          <Link
                            to={quoteUrl(product)}
                            navigate={navigate}
                            className="mx-table-action"
                          >
                            Request Quote <Arrow />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="mx-empty">
              <h3>No matching products</h3>
              <p>Try a broader search or send us the grade you need.</p>
              <button type="button" onClick={clear} className="mx-action">
                Clear filters
              </button>
              <Action
                to={`/buy?product_text=${encodeURIComponent(routeSearch)}`}
                navigate={navigate}
                outline
              >
                Request a Quote
              </Action>
            </div>
          )}
          <section className="mx-section mx-catalog-stock" id="stock">
            <SectionTitle
              title="Current Stock Overview"
              link="/stock"
              linkText="View All Stock"
              navigate={navigate}
            />
            <StockTable navigate={navigate} />
          </section>
        </div>
      </div>
      <div className="mx-trust-strip">
        <div className="mx-container">
          {[
            {
              icon: "shield",
              title: "Quality Assured",
              text: "Strict quality control and third-party inspection.",
            },
            {
              icon: "globe",
              title: "Global Logistics",
              text: "Reliable worldwide shipping and flexible packaging.",
            },
            {
              icon: "file",
              title: "Full Documentation",
              text: "COA, MSDS and export documents provided.",
            },
            {
              icon: "headset",
              title: "Expert Support",
              text: "Our team helps you find the right product fast.",
            },
          ].map((item) => (
            <div key={item.title}>
              <Icon name={item.icon} size={36} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MockStock({ navigate }) {
  return (
    <div className="mx-page">
      <Hero mode="compact">
        <div className="mx-breadcrumb">Home › Current Stock</div>
        <h1>
          Current <em>Stock</em>
        </h1>
        <p>
          Explore our sample availability and request a quote for the product
          you need.
        </p>
        <DemoNote />
      </Hero>
      <div className="mx-container mx-stock-page">
        <SectionTitle
          title="Current Availability"
          subtitle="Quantities and availability shown here are demo content."
        />
        <StockTable navigate={navigate} />
        <div className="mx-section">
          <SectionTitle title="Browse by Product Family" />
          <div className="mx-category-grid">
            {demoCategories.map((item) => (
              <Link
                className="mx-category-card"
                key={item.name}
                to={`/products?category=${encodeURIComponent(item.name)}`}
                navigate={navigate}
              >
                <img src={item.image} alt="" />
                <span>
                  <strong>
                    {item.name} <Arrow />
                  </strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailQuote({ product, navigate }) {
  const [fields, setFields] = useState({
    quantity: "",
    destination_country: "",
    packing: "",
    incoterms: "",
    company_name: "",
    email: "",
    message: "",
  });
  const change = (e) =>
    setFields((current) => ({ ...current, [e.target.name]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    stageQuoteDraft({
      quantity: fields.quantity,
      unit: "MT",
      destination_country: fields.destination_country,
      company_name: fields.company_name,
      email: fields.email,
      message:
        `Preferred packing: ${fields.packing}. Incoterms: ${fields.incoterms}. ${fields.message}`.trim(),
    });
    navigate(quoteUrl(product));
  };
  return (
    <form className="mx-detail-quote" onSubmit={submit}>
      <h2>Request to Buy</h2>
      <p>Get the best price and availability for {product.fullName}.</p>
      <div className="mx-detail-quote-grid">
        <label>
          Quantity (MT) <span>*</span>
          <input
            name="quantity"
            type="number"
            min="0.001"
            step="any"
            value={fields.quantity}
            onChange={change}
            required
            placeholder="e.g. 1,000"
          />
        </label>
        <label>
          Destination Country <span>*</span>
          <input
            name="destination_country"
            value={fields.destination_country}
            onChange={change}
            required
            placeholder="Your destination"
          />
        </label>
        <label>
          Preferred Packing <span>*</span>
          <select
            name="packing"
            value={fields.packing}
            onChange={change}
            required
          >
            <option value="">Select packing</option>
            {demoPackaging.map((item) => (
              <option key={item.name}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Incoterms <span>*</span>
          <select
            name="incoterms"
            value={fields.incoterms}
            onChange={change}
            required
          >
            <option value="">Select incoterms</option>
            {["FOB", "CIF", "CFR", "DAP"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Company Name <span>*</span>
          <input
            name="company_name"
            value={fields.company_name}
            onChange={change}
            required
            placeholder="Your company name"
          />
        </label>
        <label>
          Email <span>*</span>
          <input
            name="email"
            type="email"
            value={fields.email}
            onChange={change}
            required
            placeholder="you@company.com"
          />
        </label>
        <label className="mx-span-two">
          Additional Requirements
          <textarea
            name="message"
            value={fields.message}
            onChange={change}
            placeholder="Tell us your specific requirements..."
            rows="3"
          />
        </label>
      </div>
      <button className="mx-action" type="submit">
        Request a Quote <Arrow />
      </button>
      <small>🔒 Continue to review and submit your business inquiry.</small>
    </form>
  );
}

export function MockProductDetail({ slug, navigate }) {
  const product = demoProducts.find((item) => item.slug === slug);
  const [photo, setPhoto] = useState("drum");
  if (!product)
    return (
      <div className="mx-container mx-not-found">
        <h1>Product not found</h1>
        <Action to="/products" navigate={navigate}>
          Browse Products
        </Action>
      </div>
    );
  const gallery = [
    { key: "drum", src: drumImage, alt: "Illustrative oil drum at a refinery" },
    { key: "beaker", src: product.image, alt: "Illustrative oil sample" },
    {
      key: "logistics",
      src: logisticsImage,
      alt: "Illustrative logistics packaging",
    },
  ];
  const active = gallery.find((item) => item.key === photo) || gallery[0];
  const overviewRows =
    product.slug === "base-oil-sn500"
      ? demoOverviewRows
      : [
          ["Origin", product.origin],
          ["Grade", product.grade],
          ["MOQ", "On request"],
          ["Loading Port", "On request"],
          ["Packing", product.packing],
          ["Lead Time", "On request"],
          ["Incoterms", "Negotiable"],
        ];
  return (
    <div className="mx-page mx-detail">
      <Hero mode="detail">
        <div className="mx-breadcrumb">
          Home › Products › {product.category} › {product.fullName}
        </div>
        <div className="mx-detail-hero-title">
          <h1>{product.fullName}</h1>
          <Status value={product.status} />
        </div>
        <p>
          High-quality {product.group.toLowerCase()} for a wide range of
          industrial and marine applications.
        </p>
        <div className="mx-detail-badges">
          {[
            { icon: "shield", label: "Reliable Global Supply" },
            { icon: "diamond", label: "Consistent Quality" },
            { icon: "truck", label: "Worldwide Delivery" },
            { icon: "gear", label: "Technical Support" },
          ].map((item) => (
            <div key={item.label}>
              <Icon name={item.icon} size={26} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </Hero>
      <div className="mx-container mx-detail-layout">
        <div className="mx-detail-main">
          <div className="mx-detail-overview">
            <div className="mx-gallery">
              <img
                className="mx-gallery-main"
                src={active.src}
                alt={active.alt}
              />
              <div className="mx-gallery-thumbs">
                {gallery.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-label={`Show ${item.alt}`}
                    aria-pressed={photo === item.key}
                    onClick={() => setPhoto(item.key)}
                  >
                    <img src={item.src} alt="" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2>Product Overview</h2>
              <p>
                {product.fullName} is a high-quality{" "}
                {product.group.toLowerCase()} with excellent oxidation
                stability, low volatility and good low-temperature properties.
                It is widely used in industrial and marine lubricant
                applications.
              </p>
              <div className="mx-overview-table">
                {overviewRows.map(([key, value], i) => (
                  <div key={key}>
                    <span>
                      <Icon
                        name={
                          [
                            "globe",
                            "flask",
                            "package",
                            "pin",
                            "package",
                            "clock",
                            "globe",
                          ][i]
                        }
                        size={17}
                      />
                      {key}
                    </span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <section className="mx-section">
            <SectionTitle title="Technical Specifications" />
            {product.slug === "base-oil-sn500" ? (
              <div className="mx-table-scroll">
                <table className="mx-table mx-spec-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>ASTM Method</th>
                      <th>Typical Value ({product.name})</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoSpecs.map((row) => (
                      <tr key={row[0]}>
                        {row.map((cell, i) => (
                          <td key={i}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mx-table-note">
                Technical specifications for this demo product have not been
                added yet.
              </p>
            )}
            {product.slug === "base-oil-sn500" && (
              <small className="mx-table-note">
                Demo values for visual preview only. Replace with an approved
                technical data sheet before publication.
              </small>
            )}
          </section>
          <section className="mx-section">
            <SectionTitle title="Applications" />
            <div className="mx-application-grid">
              {[
                {
                  title: "Automotive Lubricants",
                  text: "Passenger cars, commercial vehicles, and engine oils.",
                  image: product.image,
                },
                {
                  title: "Industrial Lubricants",
                  text: "Hydraulic oils, gear oils, compressor oils.",
                  image: demoCategories[1].image,
                },
                {
                  title: "Marine Lubricants",
                  text: "Trunk piston engine oils and marine systems.",
                  image: heroImage,
                },
                {
                  title: "Metalworking Fluids",
                  text: "Machining, cutting fluids and industrial processes.",
                  image: demoCategories[3].image,
                },
              ].map((item) => (
                <div key={item.title}>
                  <img src={item.image} alt="" loading="lazy" />
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="mx-section">
            <SectionTitle title="Logistics & Packaging" />
            <Packaging compact />
          </section>
          <section className="mx-section">
            <SectionTitle
              title="Related Products"
              link="/products?category=Base%20Oils"
              linkText="View All Base Oils"
              navigate={navigate}
            />
            <div className="mx-featured-grid mx-related-grid">
              {demoProducts
                .filter((item) => item.slug !== slug)
                .slice(0, 3)
                .map((item) => (
                  <Link
                    key={item.slug}
                    to={`/products/${item.slug}`}
                    navigate={navigate}
                    className="mx-featured-card"
                  >
                    <img src={item.image} alt="" loading="lazy" />
                    <span>
                      <strong>{item.fullName}</strong>
                      <small>{item.group}</small>
                      <p>{item.description}</p>
                      <b>
                        View Product <Arrow />
                      </b>
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        </div>
        <aside className="mx-detail-aside">
          <DetailQuote product={product} navigate={navigate} />
          <div className="mx-assistance">
            <Icon name="headset" size={38} />
            <div>
              <h3>Need Immediate Assistance?</h3>
              <p>
                Our team is ready to support you with pricing, availability and
                technical questions.
              </p>
              <Action to="/contact" navigate={navigate} outline>
                Contact Sales
              </Action>
            </div>
          </div>
          <div className="mx-documents">
            <h3>
              <Icon name="file" /> Documents
            </h3>
            <p>Access product documentation for {product.fullName}.</p>
            {[
              "Certificate of Analysis (COA)",
              "Technical Data Sheet (TDS)",
              "Safety Data Sheet (SDS)",
            ].map((title) => (
              <div key={title}>
                <span className="mx-pdf-icon">PDF</span>
                <span>
                  <strong>{title}</strong>
                  <small>Sample document — available later</small>
                </span>
              </div>
            ))}
          </div>
          <div className="mx-side-benefits">
            <h3>Why Choose PETROVEX?</h3>
            <BenefitList compact />
          </div>
        </aside>
      </div>
      <div className="mx-container mx-faq-section">
        <SectionTitle title="Frequently Asked Questions" />
        <div className="mx-faq-grid">
          {demoFaqs.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MockAbout({ navigate }) {
  const { offices, milestones } = demoCompany;
  return (
    <div className="mx-page mx-about">
      <Hero mode="about">
        <div className="mx-overline">ABOUT PETROVEX</div>
        <h1>
          <em>A Global Partner</em>
          <br />
          in Base Oils & Industrial Lubricants
        </h1>
        <p>{demoCompany.heroDescription}</p>
        <div className="mx-hero-actions">
          <Action to="/buy" navigate={navigate}>
            Request a Quote
          </Action>
          <Action to="/contact" navigate={navigate} outline>
            Contact Our Sales Team
          </Action>
        </div>
      </Hero>
      <div className="mx-container">
        <section className="mx-about-intro-grid">
          <article>
            <img
              src={heroImage}
              alt="Illustrative refinery and storage tanks"
            />
            <h2>Our Company Story</h2>
            <p>{demoCompany.story}</p>
          </article>
          <article>
            <Icon name="target" size={42} />
            <h2>Our Mission</h2>
            <p>{demoCompany.mission}</p>
          </article>
          <article>
            <Icon name="diamond" size={42} />
            <h2>Our Values</h2>
            <dl>
              {demoCompany.values.map(([title, text]) => (
                <div key={title}>
                  <dt>{title}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </article>
        </section>
      </div>
      <section className="mx-about-metrics">
        <div className="mx-container">
          {demoCompany.metrics.map((item) => (
            <div key={item.label}>
              <Icon name={item.icon} size={42} />
              <span>
                <strong>{item.number}</strong>
                <b>{item.label}</b>
                <small>{item.detail}</small>
              </span>
            </div>
          ))}
        </div>
      </section>
      <div className="mx-container">
        <section className="mx-section mx-presence">
          <div>
            <SectionTitle
              title="Our Global Presence"
              subtitle={demoCompany.presenceDescription}
            />
            <ul>
              {demoCompany.presencePoints.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
            <a href="#markets" className="mx-action">
              View Our Markets <Arrow />
            </a>
          </div>
          <div
            id="markets"
            className="mx-map mx-map-large"
            aria-label="Illustrative global market map"
          >
            <span>North America</span>
            <span>Europe</span>
            <span>Middle East</span>
            <span>Asia Pacific</span>
            <span>South America</span>
            <span>Africa</span>
          </div>
          <img src={heroImage} alt="Illustrative port and refinery" />
        </section>
        <section className="mx-section">
          <SectionTitle
            title="Quality, Inspection & Compliance"
            subtitle="We are committed to delivering products that meet international standards, with strict quality control, independent inspection and full documentation."
          />
          <div className="mx-quality-grid">
            {demoCompany.quality.map((item) => (
              <div key={item.title}>
                <Icon name={item.icon} size={42} />
                <span>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-section mx-about-people">
          <div>
            <SectionTitle
              title="Our Offices"
              subtitle="A truly international business with local support and global reach."
              link="/contact"
              linkText="Contact Us"
              navigate={navigate}
            />
            <div className="mx-office-grid">
              {offices.map((item) => (
                <article key={item.name}>
                  <div
                    className="mx-office-photo"
                    style={{
                      backgroundPosition: item.position,
                    }}
                  />
                  <strong>{item.name}</strong>
                  <p>⌖ {item.address}</p>
                  <small>☎ {item.phone}</small>
                  <small>✉ {item.email}</small>
                </article>
              ))}
            </div>
          </div>
          <div>
            <SectionTitle
              title="Our Leadership Team"
              subtitle="A team of industry experts committed to your success."
            />
            <Team navigate={navigate} />
          </div>
        </section>
        <section className="mx-section">
          <SectionTitle
            title="Our Journey"
            subtitle="Key milestones in our growth as a trusted global supplier."
          />
          <div className="mx-timeline">
            {milestones.map((item) => (
              <div key={item.year}>
                <span />
                <strong>{item.year}</strong>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-section">
          <SectionTitle
            title="Certifications & Trusted Partners"
            subtitle="Sample certifications and inspection partners for this demo. Replace with verified credentials."
          />
          <div className="mx-cert-grid">
            {demoCompany.certifications.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function MockTeamProfile({ slug, navigate }) {
  const member = demoTeam.find((item) => item.slug === slug);
  if (!member)
    return (
      <div className="mx-container mx-not-found">
        <h1>Team member not found</h1>
        <Action to="/about" navigate={navigate}>
          About PETROVEX
        </Action>
      </div>
    );
  return (
    <div className="mx-page mx-team-profile">
      <Hero mode="compact">
        <div className="mx-breadcrumb">Home › About Us › Our Team</div>
        <h1>{member.name}</h1>
        <p>{member.role}</p>
        <DemoNote />
      </Hero>
      <div className="mx-container mx-team-profile-body">
        <TeamPortrait member={member} />
        <div>
          <SectionTitle title="Profile" />
          <p>{member.bio}</p>
          <p>
            This is an illustrative profile. The name, role, portrait and
            biography require approval before publication.
          </p>
          <Action to="/contact" navigate={navigate}>
            Contact Our Team
          </Action>
        </div>
      </div>
      <div className="mx-container mx-section">
        <SectionTitle title="Our Leadership Team" />
        <Team navigate={navigate} />
      </div>
    </div>
  );
}

export function MockInsights({ navigate }) {
  return (
    <div className="mx-page">
      <Hero mode="compact">
        <div className="mx-breadcrumb">Home › Knowledge Center</div>
        <h1>
          Knowledge <em>Center</em>
        </h1>
        <p>Sample insights and industry topics for the demo website.</p>
      </Hero>
      <div className="mx-container mx-stock-page">
        <SectionTitle
          title="Latest Insights"
          subtitle="Placeholder editorial content; replace with approved articles before launch."
        />
        <Insights navigate={navigate} />
      </div>
    </div>
  );
}
