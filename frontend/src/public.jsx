import React, { useEffect, useState } from "react";
import heroImage from "../../ui-images/home-hero.png";
import { api, Link, SectionHead, useData, DataState } from "./shared";

export function Home({ navigate }) {
  const [query, setQuery] = useState("");
  const published = useData("/products");
  const stock = useData("/stock");
  return (
    <>
      <section className="home-hero">
        <div className="container home-hero-grid">
          <div className="home-hero-copy">
            <span className="eyebrow">
              INDUSTRIAL OILS · DIRECT COMPANY SUPPLY
            </span>
            <h1>Find the oil you need. Start the right conversation.</h1>
            <p>
              Review published products and stock, then send your requirement
              directly to the company. Supplier offers are handled privately.
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
                  placeholder="Product name or grade"
                />
                <button type="submit" className="button">
                  Search
                </button>
              </div>
            </form>
            <div className="home-hero-links">
              <Link to="/buy" navigate={navigate} className="button">
                Request a quotation <span aria-hidden="true">↗</span>
              </Link>
              <Link to="/stock" navigate={navigate} className="plain-link">
                Check published stock <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <figure className="home-hero-figure">
            <img
              src={heroImage}
              alt="Illustration of industrial hydraulic machinery"
            />
            <figcaption>Industrial equipment illustration</figcaption>
          </figure>
        </div>
      </section>
      <section
        className="container home-pathways"
        aria-label="Ways to work with us"
      >
        <Link to="/products" navigate={navigate} className="pathway-card">
          <span>01 / DISCOVER</span>
          <strong>Browse products</strong>
          <p>Review published grades, applications, and packaging.</p>
          <b>
            Open catalog <span aria-hidden="true">→</span>
          </b>
        </Link>
        <Link to="/stock" navigate={navigate} className="pathway-card">
          <span>02 / AVAILABILITY</span>
          <strong>Check stock</strong>
          <p>See inventory the company has approved for public display.</p>
          <b>
            View stock <span aria-hidden="true">→</span>
          </b>
        </Link>
        <Link to="/sell" navigate={navigate} className="pathway-card">
          <span>03 / PROCUREMENT</span>
          <strong>Offer supply to us</strong>
          <p>Submit a private supplier offer for procurement review.</p>
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
          {[
            ["Base oils", "Base Oils"],
            ["Industrial lubricants", "Industrial Lubricants"],
            ["Greases", "Greases"],
            ["Process oils", "Process Oils"],
          ].map(([label, value]) => (
            <Link
              key={value}
              to={`/products?category=${encodeURIComponent(value)}`}
              navigate={navigate}
              className="family-link"
            >
              {label} <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
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
                      {new Date(lot.updated_at).toLocaleDateString()}
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
      <section className="section container home-products">
        <div className="section-heading-row">
          <SectionHead
            eyebrow="PUBLISHED CATALOG"
            title="Product pages"
            text="Only approved product information appears here."
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
              <Link
                key={item.id}
                to={`/products/${item.slug}`}
                navigate={navigate}
                className="product-card"
              >
                <span>{item.category}</span>
                <h3>{item.name}</h3>
                <p>{item.grade || "Details available on request"}</p>
                <strong>Review product</strong>
              </Link>
            ))}
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
            <option>Base Oils</option>
            <option>Industrial Lubricants</option>
            <option>Greases</option>
            <option>Process Oils</option>
            <option>White Oil</option>
            <option>Antifreeze</option>
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
            <Link
              key={item.id}
              to={`/products/${item.slug}`}
              navigate={navigate}
              className="product-card"
            >
              <span>{item.category}</span>
              <h2>{item.name}</h2>
              <p>{item.grade || "Product details available on request"}</p>
              <strong>View details ↗</strong>
            </Link>
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
  if (state.loading)
    return <div className="container page notice">Loading product…</div>;
  if (state.error)
    return <div className="container page notice error">{state.error}</div>;
  const product = state.data;
  return (
    <div className="container page">
      <Link to="/products" navigate={navigate} className="back-link">
        ← Back to products
      </Link>
      <span className="eyebrow">{product.category}</span>
      <h1>{product.name}</h1>
      <p className="page-lead">{product.grade}</p>
      <div className="detail-grid">
        <div>
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
            Share your required quantity and destination. The team will review
            the request.
          </p>
          <Link
            to={`/buy?product_id=${product.id}`}
            navigate={navigate}
            className="button"
          >
            Request a quote ↗
          </Link>
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
                  Updated {new Date(lot.updated_at).toLocaleDateString()}
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
    <div className="container page">
      <span className="eyebrow">CURRENT STOCK</span>
      <h1>Published availability</h1>
      <p className="page-lead">
        These entries show stock approved for public display. Availability is
        subject to confirmation when you inquire.
      </p>
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
                  {new Date(lot.updated_at).toLocaleDateString()}
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
  const products = useData("/products");
  const [form, setForm] = useState({
    kind,
    company_name: "",
    contact_name: "",
    email: "",
    product_id: params.get("product_id") || "",
    lot_id: params.get("lot_id") || "",
    product_text: (params.get("product_text") || "").slice(0, 160),
    quantity: "",
    unit: "MT",
    destination_country: "",
    origin: "",
    message: "",
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
  return (
    <div className="container page">
      <span className="eyebrow">ABOUT THE COMPANY</span>
      <h1>Built for clear industrial trade.</h1>
      <p className="page-lead">
        Verified company history, locations, certifications, and team profiles
        will be published here after approval.
      </p>
      <div className="context-cta">
        <p>Need product information now?</p>
        <Link to="/contact" navigate={navigate}>
          Contact our team ↗
        </Link>
      </div>
    </div>
  );
}
