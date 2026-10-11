import React, { useEffect, useState } from "react";
import heroImage from "./assets/industrial-harbor.webp";
import heroImageMobile from "./assets/industrial-harbor-mobile.webp";
import baseOilsImage from "./assets/base-oils.webp";
import processOilsImage from "./assets/process-oils.webp";
import { consumeQuoteDraft } from "./quoteDraft";
import { api, Link, SectionHead, useData, DataState } from "./shared";
import { formatDate } from "./locale-format";
import { useLocale } from "./localization-runtime";
import { companyProfile } from "./companyProfile";
import { productCategories } from "./productCategories";

const familyCards = [
  {
    label: "Bitumen",
    category: "Bitumen",
    image: heroImageMobile,
    description: "Industrial and road bitumen inquiries.",
  },
  {
    label: "Base oils",
    category: "Base Oils",
    image: baseOilsImage,
    description: "Published base oil grades and product information.",
  },
  {
    label: "Petroleum products",
    category: "Petroleum Products",
    image: processOilsImage,
    description: "Petroleum derivatives and related materials.",
  },
  {
    label: "Industrial solvents",
    category: "Industrial Solvents",
    image: processOilsImage,
    description: "Industrial solvent requirements.",
  },
  {
    label: "Petrochemical feedstocks",
    category: "Petrochemical Feedstocks",
    image: heroImageMobile,
    description: "Raw materials for petrochemical applications.",
  },
];

function categoryImage(category) {
  return familyCards.find((item) => item.category === category)?.image || null;
}

function imageDimensions(image) {
  return image === heroImageMobile
    ? { width: 960, height: 384 }
    : { width: 1200, height: 800 };
}

function ProductCard({ item, navigate }) {
  return (
    <Link
      to={`/products/${item.slug}`}
      navigate={navigate}
      className="product-card visual-product-card"
    >
      <span className="product-card-media">
        {categoryImage(item.category) ? (
          <img
            src={categoryImage(item.category)}
            alt=""
            {...imageDimensions(categoryImage(item.category))}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="product-card-placeholder" aria-hidden="true">
            ◆
          </span>
        )}
        <small>
          {categoryImage(item.category)
            ? "Category illustration"
            : "Product information"}
        </small>
      </span>
      <span className="product-card-body">
        <span>{item.category}</span>
        <strong className="product-card-name">{item.name}</strong>
        <span className="product-card-grade">
          {item.grade || "Grade details on request"}
        </span>
        <b>
          View product <span aria-hidden="true">→</span>
        </b>
      </span>
    </Link>
  );
}

export function Home({ navigate, DevHomePreview }) {
  const persian = useLocale() === "fa";
  const [query, setQuery] = useState("");
  const published = useData("/products");
  const stock = useData("/stock");
  const showDemoHome = import.meta.env.DEV && !published.loading && !published.error && !published.data?.length;
  return (
    <>
      <section className="home-hero">
        <img
          className="home-hero-background"
          src={heroImageMobile}
          srcSet={`${heroImageMobile} 960w, ${heroImage} 1983w`}
          sizes="100vw"
          width="1983"
          height="793"
          fetchPriority="high"
          alt=""
        />
        <div className="container home-hero-grid">
          <div className="home-hero-copy">
            <span className="eyebrow" data-no-translate>
              {persian ? "قیر · فرآورده‌های نفتی · پتروشیمی" : "BITUMEN · PETROLEUM · PETROCHEMICALS"}
            </span>
            <h1>
              <em data-no-translate>{persian ? "محصولات صنعتی" : "Industrial materials"}</em>{" "}
              <span data-no-translate>{persian ? "برای تجارت داخلی و بین‌المللی" : "for regional and international trade"}</span>
            </h1>
            <p data-no-translate lang={persian ? "fa" : "en"}>
              {persian
                ? "پادنا سیوان در زمینه قیر، فرآورده‌های نفتی، روغن‌های پایه، حلال‌های صنعتی و محصولات پتروشیمی فعالیت می‌کند. فهرست محصولات تأییدشده را ببینید یا درخواست خود را مستقیم برای شرکت بفرستید."
                : "Padna Sivan works across bitumen, petroleum products, base oils, industrial solvents, and petrochemical materials. Explore approved listings or send a requirement directly to the company."}
            </p>
            <form
              className="home-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(`/products?q=${encodeURIComponent(query.trim())}`);
              }}
            >
              <label htmlFor="home-product-search">
                Search the product catalog
              </label>
              <div className="home-search-row">
                <input
                  id="home-product-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Product or grade"
                />
                <button type="submit" className="button">
                  <span data-no-translate>{persian ? "جست‌وجو" : "Search"}</span>
                </button>
              </div>
            </form>
            <div className="home-hero-links">
              <Link to="/products" navigate={navigate} className="button">
                View products <span aria-hidden="true">→</span>
              </Link>
              <Link to="/buy" navigate={navigate} className="outline-button">
                Request a quote <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
        <span className="hero-image-note">Illustrative industry image</span>
      </section>
      <section
        className="container home-pathways"
        aria-label="Ways to work with us"
      >
        <Link to="/buy" navigate={navigate} className="pathway-card">
          <span>Buy From Us</span>
          <strong>Request a quote</strong>
          <p>Customers can send a requirement without creating an account. The team reviews each submission.</p>
          <b>
            Send a requirement <span aria-hidden="true">→</span>
          </b>
        </Link>
        <Link to="/sell" navigate={navigate} className="pathway-card">
          <span>Sell To Us</span>
          <strong>Offer supply to us</strong>
          <p>Suppliers can submit products for procurement review. Offers do not appear in the public catalog.</p>
          <b>
            Submit an offer <span aria-hidden="true">→</span>
          </b>
        </Link>
      </section>
      <section className="section container home-families">
        <div className="section-heading-row">
          <SectionHead
            eyebrow="PRODUCT FAMILIES"
            title="Start with the product type"
            text="Choose a family to narrow the catalog, or search for a specific grade above."
          />
          <Link to="/products" navigate={navigate} className="section-link">
            All products <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="family-list">
          {familyCards.map((family) => (
            <Link
              key={family.category}
              to={`/products?category=${encodeURIComponent(family.category)}`}
              navigate={navigate}
              className="family-link"
            >
              <img
                src={family.image}
                alt=""
                {...imageDimensions(family.image)}
                loading="lazy"
                decoding="async"
              />
              <span className="family-link-body">
                <strong>
                  {family.label} <span aria-hidden="true">→</span>
                </strong>
                <small>{family.description}</small>
              </span>
            </Link>
          ))}
        </div>
        <nav className="home-family-more" aria-label="More product families">
          <span>More product families</span>
          {["Industrial Lubricants", "Greases", "Process Oils"].map((category) => (
            <Link
              key={category}
              to={`/products?category=${encodeURIComponent(category)}`}
              navigate={navigate}
            >
              {category} <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </section>
      <section className="section container home-products">
        <div className="section-heading-row">
          <SectionHead
            eyebrow={showDemoHome ? "DESIGN DEMO" : "PUBLISHED CATALOG"}
            title={showDemoHome ? "Explore example products" : "Product pages"}
            text={showDemoHome
              ? "The previous catalog is available locally for design review."
              : "Only approved product information appears here."}
          />
          <Link to="/products" navigate={navigate} className="section-link">
            Browse catalog <span aria-hidden="true">→</span>
          </Link>
        </div>
        {published.loading ? (
          <div className="notice" role="status">
            Loading published products…
          </div>
        ) : published.error ? (
          <div className="notice error" role="alert">
            Product information is temporarily unavailable.{" "}
            <Link to="/buy" navigate={navigate}>
              Send your requirement
            </Link>
            .
          </div>
        ) : published.data?.length ? (
          <div className="product-grid">
            {published.data.slice(0, 3).map((item) => (
              <ProductCard key={item.id} item={item} navigate={navigate} />
            ))}
          </div>
        ) : showDemoHome && DevHomePreview ? (
          <>
            <p className="home-preview-note" role="note">
              Demo products for local design review. Details and stock figures are illustrative and await company approval.
            </p>
            <React.Suspense fallback={<div className="notice" role="status">Loading example products…</div>}>
              <DevHomePreview ProductCard={ProductCard} navigate={navigate} />
            </React.Suspense>
          </>
        ) : showDemoHome ? (
          <div className="empty-action">
            <div>
              <h3>Explore the previous demo catalog</h3>
              <p>Illustrative product entries are available for local design review.</p>
            </div>
            <Link to="/products" navigate={navigate} className="ghost-button">Browse demo products</Link>
          </div>
        ) : (
          <div className="empty-action">
            <div>
              <h3>Product pages are being prepared</h3>
              <p>
                Tell us the grade and quantity you need. The team can review
                your request directly.
              </p>
            </div>
            <Link to="/buy" navigate={navigate} className="ghost-button">
              Send a requirement
            </Link>
          </div>
        )}
      </section>
      <section className="section home-availability">
        <div className="container home-availability-grid">
          <div>
            <SectionHead
              eyebrow="PUBLISHED AVAILABILITY"
              title="See what is listed now"
              text="Public stock is subject to confirmation when you inquire."
            />
            <Link to="/stock" navigate={navigate} className="plain-link">
              View all published stock <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="home-stock-list">
            {stock.loading ? (
              <p role="status">Checking published stock…</p>
            ) : stock.error ? (
              <div className="notice error" role="alert">
                Stock information is unavailable right now.{" "}
                <Link to="/buy" navigate={navigate}>
                  Send a requirement
                </Link>
                .
              </div>
            ) : stock.data?.length ? (
              stock.data.slice(0, 3).map((lot) => (
                <Link
                  key={lot.id}
                  to={`/buy?product_id=${lot.product_id}&lot_id=${lot.id}`}
                  navigate={navigate}
                  className="home-stock-row"
                >
                  <span>
                    <b>{lot.name}</b>
                    <small>
                      {lot.grade || "Grade on request"} · Updated{" "}
                      {formatDate(lot.updated_at)}
                    </small>
                  </span>
                  <span>
                    {lot.quantity === null
                      ? "Quantity on request"
                      : `${lot.quantity} ${lot.unit}`}
                  </span>
                  <strong>
                    Inquire <span aria-hidden="true">→</span>
                  </strong>
                </Link>
              ))
            ) : (
              <div className="home-stock-empty">
                <strong>No public stock is listed yet.</strong>
                <p>
                  Tell us the product and quantity you need; the team can review
                  your request.
                </p>
                <Link to="/buy" navigate={navigate} className="plain-link">
                  Send a requirement →
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export function Catalog({ navigate, route }) {
  const params = new URLSearchParams(route.split("?")[1] || "");
  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const [search, setSearch] = useState(q);
  const [draftCategory, setDraftCategory] = useState(category);
  const [revision, setRevision] = useState(0);
  useEffect(() => setSearch(q), [q]);
  useEffect(() => setDraftCategory(category), [category]);
  const state = useData(
    `/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&r=${revision}`,
  );
  function apply(event) {
    event.preventDefault();
    navigate(
      `/products?${new URLSearchParams({ q: search.trim(), category: draftCategory }).toString()}`,
    );
  }
  return (
    <div className="container page catalog-page">
      <div className="catalog-intro">
        <div>
          <span className="eyebrow">PRODUCT CATALOG</span>
          <h1>Explore our products</h1>
          <p className="page-lead">
            Search approved product information or send a requirement for an
            unlisted grade.
          </p>
        </div>
        <Link to="/buy" navigate={navigate} className="button">
          Request a quotation <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <form className="filter-bar" onSubmit={apply} role="search">
        <label>
          Search products
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or grade"
          />
        </label>
        <label>
          Category
          <select
            value={draftCategory}
            onChange={(event) => setDraftCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {productCategories.map((productCategory) => (
              <option key={productCategory} value={productCategory}>
                {productCategory}
              </option>
            ))}
          </select>
        </label>
        <button className="button" type="submit">
          Apply filters
        </button>
        {(q || category) && (
          <button
            className="ghost-button"
            type="button"
            onClick={() => navigate("/products")}
          >
            Clear
          </button>
        )}
      </form>
      {!state.loading && !state.error && (
        <p className="results-summary" role="status">
          {state.data?.length || 0} published{" "}
          {state.data?.length === 1 ? "product" : "products"} found
        </p>
      )}
      {(state.loading || state.error) && (
        <DataState
          state={state}
          retry={() => setRevision((value) => value + 1)}
        />
      )}
      {!state.loading && !state.error && !state.data?.length && (
        <div className="catalog-empty">
          <div>
            <h2>
              {q || category
                ? "No matching products"
                : "Catalog pages are being prepared"}
            </h2>
            <p>
              {q || category
                ? "Try a broader search, or tell the team exactly which grade you need."
                : "You can still submit the product and quantity you need for review."}
            </p>
          </div>
          <div className="empty-actions">
            {(q || category) && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => navigate("/products")}
              >
                Clear filters
              </button>
            )}
            <Link
              to={`/buy?product_text=${encodeURIComponent(q)}`}
              navigate={navigate}
              className="button"
            >
              Send a requirement
            </Link>
          </div>
        </div>
      )}
      {state.data?.length > 0 && (
        <div className="product-grid">
          {state.data.map((item) => (
            <ProductCard key={item.id} item={item} navigate={navigate} />
          ))}
        </div>
      )}
      <div className="context-cta">
        <p>Can’t find the product you need?</p>
        <Link to="/contact" navigate={navigate}>
          Contact us ↗
        </Link>
      </div>
    </div>
  );
}

export function ProductDetail({ slug, navigate }) {
  const state = useData(`/products/${encodeURIComponent(slug)}`);
  const [quickQuote, setQuickQuote] = useState({
    quantity: "",
    unit: "MT",
    destination_country: "",
  });
  if (state.loading)
    return <div className="container page notice">Loading product…</div>;
  if (state.error)
    return <div className="container page notice error">{state.error}</div>;
  const product = state.data;
  return (
    <div className="container page product-page">
      <div className="product-intro">
        <Link to="/products" navigate={navigate} className="back-link">
          ← Back to products
        </Link>
        <span className="eyebrow">{product.category}</span>
        <h1>{product.name}</h1>
        <p className="page-lead">
          {product.grade || "Grade details on request"}
        </p>
      </div>
      <div className="detail-grid">
        <div>
          {categoryImage(product.category) && (
            <figure className="product-visual">
              <img
                src={categoryImage(product.category)}
                alt=""
                {...imageDimensions(categoryImage(product.category))}
              />
              <figcaption>
                Illustrative {product.category.toLowerCase()} image
              </figcaption>
            </figure>
          )}
          <SectionHead eyebrow="PRODUCT INFORMATION" title="Overview" />
          <p>
            {product.description ||
              "A detailed description has not been published yet. Contact the team for current information."}
          </p>
          <h3>Applications</h3>
          <p>{product.applications || "Available on request"}</p>
          <h3>Packaging</h3>
          <p>{product.packaging || "Confirm with the team"}</p>
        </div>
        <aside className="detail-aside">
          <span className="eyebrow">COMMERCIAL INQUIRY</span>
          <h2>Request a quotation</h2>
          <p>
            Start with your quantity and destination. Complete your contact
            details on the next page.
          </p>
          <form
            className="quick-quote-form"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(
                `/buy?${new URLSearchParams({
                  product_id: product.id,
                  quantity: quickQuote.quantity,
                  unit: quickQuote.unit,
                  destination_country: quickQuote.destination_country.trim(),
                }).toString()}`,
              );
            }}
          >
            <div className="form-grid">
              <label>
                Quantity
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  required
                  value={quickQuote.quantity}
                  onChange={(event) =>
                    setQuickQuote({
                      ...quickQuote,
                      quantity: event.target.value,
                    })
                  }
                  placeholder="Amount"
                />
              </label>
              <label>
                Unit
                <select
                  value={quickQuote.unit}
                  onChange={(event) =>
                    setQuickQuote({ ...quickQuote, unit: event.target.value })
                  }
                >
                  {["MT", "KG", "Litre", "Barrel", "Drum", "IBC"].map(
                    (unit) => (
                      <option key={unit}>{unit}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <label>
              Destination country
              <input
                required
                maxLength="80"
                value={quickQuote.destination_country}
                onChange={(event) =>
                  setQuickQuote({
                    ...quickQuote,
                    destination_country: event.target.value,
                  })
                }
                placeholder="Country"
              />
            </label>
            <button className="button" type="submit">
              Continue request <span aria-hidden="true">→</span>
            </button>
          </form>
        </aside>
      </div>
      <SectionHead eyebrow="PUBLISHED STOCK" title="Current availability" />
      {product.lots.length ? (
        <div className="stock-list">
          {product.lots.map((lot) => (
            <div className="stock-row" key={lot.id}>
              <div>
                <b>{lot.origin || "Origin on request"}</b>
                <small>
                  Updated {formatDate(lot.updated_at)}
                </small>
              </div>
              <span>{lot.packing || "Packing on request"}</span>
              <strong>
                {lot.quantity === null
                  ? "Quantity on request"
                  : `${lot.quantity} ${lot.unit}`}
              </strong>
              <Link
                to={`/buy?product_id=${product.id}&lot_id=${lot.id}`}
                navigate={navigate}
              >
                Inquire ↗
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="notice">
          No public stock is listed for this product. You can still ask about
          supply.
        </div>
      )}
    </div>
  );
}

export function Stock({ navigate }) {
  const [revision, setRevision] = useState(0);
  const state = useData(`/stock?r=${revision}`);
  return (
    <div className="container page stock-page">
      <div className="stock-intro">
        <span className="eyebrow">CURRENT STOCK</span>
        <h1>Published availability</h1>
        <p className="page-lead">
          These entries show stock approved for public display. Availability is
          subject to confirmation when you inquire.
        </p>
      </div>
      <DataState
        state={state}
        empty="No stock has been approved for public display yet. Browse products or send us your requirement."
        retry={() => setRevision((value) => value + 1)}
      />
      {state.data?.length > 0 && (
        <div className="stock-list">
          {state.data.map((lot) => (
            <div className="stock-row" key={lot.id}>
              <div>
                <b>{lot.name}</b>
                <small>
                  {lot.grade || "Grade on request"} · Updated{" "}
                  {formatDate(lot.updated_at)}
                </small>
              </div>
              <span>
                {lot.origin || "Origin on request"}
                <small>{lot.packing || "Packing on request"}</small>
              </span>
              <strong>
                {lot.quantity === null
                  ? "Quantity on request"
                  : `${lot.quantity} ${lot.unit}`}
              </strong>
              <Link
                to={`/buy?product_id=${lot.product_id}&lot_id=${lot.id}`}
                navigate={navigate}
              >
                Request quote ↗
              </Link>
            </div>
          ))}
        </div>
      )}
      <div className="context-cta">
        <p>Looking for something else?</p>
        <Link to="/products" navigate={navigate}>
          Browse products ↗
        </Link>
      </div>
    </div>
  );
}

export function InquiryForm({ kind, navigate, route }) {
  const params = new URLSearchParams(route.split("?")[1] || "");
  const quoteDraft = kind === "buy" ? consumeQuoteDraft() : null;
  const products = useData("/products");
  const [form, setForm] = useState({
    kind,
    company_name: (quoteDraft?.company_name || "").slice(0, 160),
    contact_name: "",
    email: (quoteDraft?.email || "").slice(0, 254),
    product_id: params.get("product_id") || "",
    lot_id: params.get("lot_id") || "",
    product_text: (params.get("product_text") || "").slice(0, 160),
    quantity: (quoteDraft?.quantity || params.get("quantity") || "").slice(
      0,
      24,
    ),
    unit: ["MT", "KG", "Litre", "Barrel", "Drum", "IBC"].includes(
      quoteDraft?.unit || params.get("unit"),
    )
      ? quoteDraft?.unit || params.get("unit")
      : "MT",
    destination_country: (
      quoteDraft?.destination_country ||
      params.get("destination_country") ||
      ""
    ).slice(0, 80),
    origin: "",
    message: (quoteDraft?.message || "").slice(0, 2000),
    privacy_accepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState(null);
  const [uploadWarning, setUploadWarning] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const update = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        product_id: form.product_id || null,
        lot_id: form.lot_id || null,
        quantity: form.quantity || null,
        unit: kind === "contact" ? null : form.unit,
      };
      const portal = await api("/portal/me").catch(() => null);
      const result = await api("/inquiries", {
        method: "POST",
        headers: {
          "Idempotency-Key": key,
          ...(portal ? { "X-CSRF-Token": portal.csrf_token } : {}),
        },
        body: JSON.stringify(payload),
      });
      setReference(result.reference);
      if (kind === "sell" && file) {
        try {
          await api(`/inquiries/${result.reference}/documents`, {
            method: "POST",
            headers: {
              "X-Upload-Token": result.upload_token,
              "X-Filename": encodeURIComponent(file.name),
              "X-Filename-Encoding": "utf8-percent",
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });
        } catch (uploadError) {
          setUploadWarning(
            `Your offer was saved, but the document was not uploaded: ${uploadError.message}`,
          );
        }
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const title =
    kind === "buy"
      ? "Request a quotation"
      : kind === "sell"
        ? "Offer a product"
        : "Contact our team";
  const eyebrow =
    kind === "buy" ? "BUY FROM US" : kind === "sell" ? "SELL TO US" : "CONTACT";
  if (reference)
    return (
      <div className="container page form-page">
        <span className="eyebrow">REQUEST RECEIVED</span>
        <h1>Thank you.</h1>
        <p className="page-lead">
          Your submission has been saved for review. Please keep this reference:
        </p>
        <div className="reference">{reference}</div>
        {uploadWarning && (
          <div className="notice error" role="alert">
            {uploadWarning}
          </div>
        )}
        <p>
          Submitting an offer does not mean it has been accepted. The relevant
          team will review the details.
        </p>
        <Link to="/" navigate={navigate} className="button">
          Return home ↗
        </Link>
      </div>
    );
  return (
    <div className="container page form-page">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="page-lead">
        {kind === "buy"
          ? "Tell us what you need. No account is required."
          : kind === "sell"
            ? "Share your proposed supply privately for procurement review."
            : "Send a message and the appropriate team will review it."}
      </p>
      <form className="inquiry-form" onSubmit={submit}>
        <fieldset>
          <legend>
            {kind === "sell"
              ? "Your offer"
              : kind === "buy"
                ? "Your requirement"
                : "Your message"}
          </legend>
          {kind === "buy" && (
            <label>
              Published product (optional)
              <select
                name="product_id"
                value={form.product_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    product_id: event.target.value,
                    lot_id: "",
                    product_text: event.target.value
                      ? ""
                      : current.product_text,
                  }))
                }
              >
                <option value="">Other product / not listed</option>
                {products.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.grade ? ` — ${item.grade}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "buy" && form.lot_id && (
            <div className="selected-stock" role="status">
              <span>
                Published stock entry selected. Availability will be confirmed
                when the team reviews your request.
              </span>
              <button
                type="button"
                className="inline-button"
                onClick={() =>
                  setForm((current) => ({ ...current, lot_id: "" }))
                }
              >
                Remove stock selection
              </button>
            </div>
          )}
          {kind === "buy" && !form.product_id && (
            <label>
              Product name and grade
              <input
                name="product_text"
                value={form.product_text}
                onChange={update}
                required
                maxLength="160"
                placeholder="Describe the product you need"
              />
            </label>
          )}
          {kind === "sell" && (
            <label>
              Product and grade
              <input
                name="product_text"
                value={form.product_text}
                onChange={update}
                required
                maxLength="160"
                placeholder="Product name and grade"
              />
            </label>
          )}
          {kind !== "contact" && (
            <div className="form-grid">
              <label>
                Quantity
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  name="quantity"
                  value={form.quantity}
                  onChange={update}
                  required
                  placeholder="Amount"
                />
              </label>
              <label>
                Unit
                <select name="unit" value={form.unit} onChange={update}>
                  <option>MT</option>
                  <option>KG</option>
                  <option>Litre</option>
                  <option>Barrel</option>
                  <option>Drum</option>
                  <option>IBC</option>
                </select>
              </label>
            </div>
          )}
          {kind === "buy" && (
            <label>
              Destination country
              <input
                name="destination_country"
                value={form.destination_country}
                onChange={update}
                required
                maxLength="80"
                placeholder="Country"
              />
            </label>
          )}
          {kind === "sell" && (
            <label>
              Product origin
              <input
                name="origin"
                value={form.origin}
                onChange={update}
                maxLength="80"
                placeholder="Country of origin"
              />
            </label>
          )}
          <label>
            {kind === "contact" ? "Message" : "Additional details"}
            <textarea
              name="message"
              value={form.message}
              onChange={update}
              rows="5"
              maxLength="4000"
              placeholder={
                kind === "sell"
                  ? "Location, packing, terms, and document availability"
                  : "Packing, timing, specifications, or other details"
              }
              required={kind === "contact"}
            />
          </label>
          {kind === "sell" && (
            <label>
              Technical document (optional, PDF/PNG/JPEG, up to 10 MB)
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
          )}
        </fieldset>
        <fieldset>
          <legend>Company and contact</legend>
          <div className="form-grid">
            <label>
              Company name
              <input
                name="company_name"
                value={form.company_name}
                onChange={update}
                required
                minLength="2"
                maxLength="160"
              />
            </label>
            <label>
              Your name
              <input
                name="contact_name"
                value={form.contact_name}
                onChange={update}
                required
                minLength="2"
                maxLength="160"
              />
            </label>
          </div>
          <label>
            Business email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={update}
              required
            />
          </label>
        </fieldset>
        <label className="check-label">
          <input
            type="checkbox"
            name="privacy_accepted"
            checked={form.privacy_accepted}
            onChange={update}
            required
          />
          <span>
            I understand this local prototype stores my inquiry for staff
            review. Approved privacy terms are required before public launch.
          </span>
        </label>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <button className="button" disabled={busy} type="submit">
          {busy ? "Submitting…" : "Submit request ↗"}
        </button>
      </form>
    </div>
  );
}

export function About({ navigate }) {
  const locale = useLocale();
  const persian = locale === "fa";
  return (
    <div className="container page about-page">
      <div className="about-intro">
        <span className="eyebrow">ABOUT THE COMPANY</span>
        <h1 data-no-translate lang={persian ? "fa" : "en"}>
          {persian ? companyProfile.nameFa : companyProfile.name}
        </h1>
        <p className="page-lead" data-no-translate lang={persian ? "fa" : "en"}>
          {persian ? companyProfile.summaryFa : companyProfile.summary}
        </p>
      </div>
      <section className="about-company-profile" aria-label="Company profile">
        <h2>{persian ? "حوزه فعالیت" : "Products and operations"}</h2>
        <p data-no-translate lang={persian ? "fa" : "en"}>
          {persian ? companyProfile.scopeFa : companyProfile.scope}
        </p>
        <h2>{persian ? "همکاری تجاری" : "Commercial partnerships"}</h2>
        <p data-no-translate lang={persian ? "fa" : "en"}>
          {persian ? companyProfile.approachFa : companyProfile.approach}
        </p>
        <h2>{persian ? "اهداف راهبردی" : "Strategic priorities"}</h2>
        <p data-no-translate lang={persian ? "fa" : "en"}>
          {persian ? companyProfile.prioritiesFa : companyProfile.priorities}
        </p>
      </section>
      <div className="about-grid">
        <section>
          <span>01 / PRODUCTS</span>
          <h2>Published information</h2>
          <p>
            Product pages show approved descriptions, applications, packaging,
            and public stock entries.
          </p>
          <Link to="/products" navigate={navigate}>
            Explore products →
          </Link>
        </section>
        <section>
          <span>02 / BUYING</span>
          <h2>Direct inquiries</h2>
          <p>
            Customers can send a requirement without creating an account. The
            team reviews each submission.
          </p>
          <Link to="/buy" navigate={navigate}>
            Request a quotation →
          </Link>
        </section>
        <section>
          <span>03 / PROCUREMENT</span>
          <h2>Private supplier offers</h2>
          <p>
            Suppliers can submit products for procurement review. Offers do not
            appear in the public catalog.
          </p>
          <Link to="/sell" navigate={navigate}>
            Offer supply →
          </Link>
        </section>
      </div>
      <div className="context-cta">
        <p>{persian
          ? "نام‌های ثبت‌شده در سوابق عمومی شرکت را ببینید. سمت‌های فعلی پس از تأیید شرکت نمایش داده می‌شوند."
          : "See names in the public company record. Current roles await confirmation."}</p>
        <Link to="/team" navigate={navigate}>
          {persian ? "افراد و سمت‌ها" : "People and positions"} →
        </Link>
      </div>
      <div className="context-cta">
        <p>Need product information now?</p>
        <Link to="/contact" navigate={navigate}>
          Contact our team ↗
        </Link>
      </div>
    </div>
  );
}
