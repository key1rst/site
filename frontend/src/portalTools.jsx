import React, { useEffect, useState } from "react";
import { api, Link } from "./shared";

export function PortalAccount({ session, navigate }) {
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [saved, setSaved] = useState([]);
  const [proformas, setProformas] = useState([]);
  const [product, setProduct] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const headers = { "X-CSRF-Token": session.csrf_token };
  useEffect(() => {
    Promise.all([
      api("/portal/profile"),
      session.role === "customer" ? api("/products") : [],
      session.role === "customer" ? api("/portal/saved-products") : [],
      session.role === "customer" ? api("/portal/proformas") : [],
    ])
      .then(([details, catalog, favorites, invoices]) => {
        setProfile(details);
        setProducts(catalog);
        setSaved(favorites);
        setProformas(invoices);
      })
      .catch((failure) => setError(failure.message));
  }, [session]);
  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setProfile(
        await api("/portal/profile", {
          method: "PUT",
          headers,
          body: JSON.stringify({ contact_name: profile.contact_name }),
        }),
      );
      setNotice("Contact name updated.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function changeSaved(id, method) {
    setBusy(true);
    setError("");
    try {
      await api(`/portal/saved-products/${id}`, { method, headers });
      setSaved(await api("/portal/saved-products"));
      setProduct("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="portal-section">
      <h2>Account and documents</h2>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {profile && (
        <form className="quote-form" onSubmit={saveProfile}>
          <p>
            {profile.company_name} · {profile.email} · company{" "}
            {profile.verification_status}. Contact staff through your inquiry
            messages for company or email changes.
          </p>
          <label>
            Contact name
            <input
              required
              minLength="2"
              maxLength="160"
              value={profile.contact_name}
              onChange={(event) =>
                setProfile({ ...profile, contact_name: event.target.value })
              }
            />
          </label>
          <button className="ghost-button" disabled={busy}>
            Update contact name
          </button>
        </form>
      )}
      {session.role === "customer" && (
        <>
          <h3>Saved products</h3>
          <div className="quote-actions">
            <label>
              Published product
              <select
                value={product}
                onChange={(event) => setProduct(event.target.value)}
              >
                <option value="">Select a product</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="ghost-button"
              disabled={!product || busy}
              onClick={() => changeSaved(product, "PUT")}
            >
              Save product
            </button>
          </div>
          {saved.length ? (
            saved.map((item) => (
              <div className="context-cta" key={item.id}>
                <Link to={`/products/${item.slug}`} navigate={navigate}>
                  {item.name} · {item.grade}
                </Link>
                <button
                  className="inline-button"
                  disabled={busy}
                  onClick={() => changeSaved(item.id, "DELETE")}
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p>No saved products yet.</p>
          )}
          <h3>Proforma invoices</h3>
          {proformas.length ? (
            proformas.map((item) => (
              <div className="context-cta" key={item.id}>
                <p>
                  {item.reference} · {item.currency} {item.total}
                </p>
                <a
                  href={`/api/portal/proformas/${item.id}/pdf`}
                  className="ghost-button"
                >
                  Download PDF
                </a>
              </div>
            ))
          ) : (
            <p>No proforma invoices have been issued.</p>
          )}
          <p className="muted">
            A proforma records the agreed quotation terms. Payment and shipment
            are tracked separately.
          </p>
        </>
      )}
    </section>
  );
}

export function PortalDocuments({ session, reference }) {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDocuments([]);
    setFile(null);
    setError("");
    api(`/portal/inquiries/${reference}/documents`)
      .then(setDocuments)
      .catch((failure) => setError(failure.message));
  }, [reference]);
  async function upload(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("File exceeds 10 MB.");
      const authorization = await api(
        `/portal/inquiries/${reference}/upload-token`,
        { method: "POST", headers: { "X-CSRF-Token": session.csrf_token } },
      );
      await api(`/inquiries/${reference}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Upload-Token": authorization.upload_token,
          "X-Filename": encodeURIComponent(file.name),
          "X-Filename-Encoding": "utf8-percent",
        },
        body: file,
      });
      setDocuments(await api(`/portal/inquiries/${reference}/documents`));
      setFile(null);
      event.target.reset();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="portal-section">
      <h3>Documents for {reference}</h3>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {documents.length ? (
        documents.map((document) => (
          <div className="history" key={document.id}>
            <p>
              {document.filename} · {Math.ceil(document.bytes / 1024)} KB ·{" "}
              {document.scan_status}
            </p>
            {document.scan_status === "clean" ? (
              <a
                className="inline-button"
                href={`/api/portal/documents/${document.id}`}
              >
                Download
              </a>
            ) : (
              <small>Download awaits approved security scanning.</small>
            )}
          </div>
        ))
      ) : (
        <p>No uploaded documents.</p>
      )}
      {session.role === "supplier" && (
        <form onSubmit={upload}>
          <label>
            Upload PDF, PNG or JPEG (max 10 MB)
            <input
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(event) => setFile(event.target.files[0] || null)}
            />
          </label>
          <button className="ghost-button" disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload document"}
          </button>
        </form>
      )}
    </div>
  );
}
