import React, { useEffect, useState } from "react";
import { api } from "./shared";

const empty = {
  product_text: "",
  quantity: "",
  unit: "MT",
  destination_country: "",
  origin: "",
  message: "",
};

export function PortalDraft({ session, onSubmitted }) {
  const [form, setForm] = useState(empty);
  const [expires, setExpires] = useState(null);
  const [reference, setReference] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const headers = { "X-CSRF-Token": session.csrf_token };

  useEffect(() => {
    api("/portal/draft")
      .then((draft) => {
        setForm({
          ...draft.payload,
          quantity: draft.payload.quantity ?? "",
          unit: draft.payload.unit ?? "MT",
        });
        setExpires(draft.expires_at);
        setReference(draft.submitted_reference);
      })
      .catch((failure) => setError(failure.message))
      .finally(() => setLoading(false));
  }, [session]);

  async function persist(payload = form) {
    const draft = await api("/portal/draft", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        ...payload,
        quantity: payload.quantity === "" ? null : payload.quantity,
      }),
    });
    setExpires(draft.expires_at);
    setReference(draft.submitted_reference);
    return draft;
  }
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await persist();
      setNotice("Draft saved to your private account.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const draft = await persist();
      const result = await api("/portal/draft/submit", {
        method: "POST",
        headers,
        body: JSON.stringify({
          privacy_accepted: consent,
          updated_at: draft.updated_at,
        }),
      });
      setReference(result.reference);
      setNotice(`Submission recorded: ${result.reference}`);
      onSubmitted();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function startNew() {
    setBusy(true);
    setError("");
    try {
      await persist(empty);
      setForm(empty);
      setConsent(false);
      setReference(null);
      setNotice("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setNotice("");
  }

  if (loading)
    return (
      <section className="portal-section notice">
        Loading your saved draft…
      </section>
    );
  return (
    <section className="portal-section">
      <h2>
        {session.role === "customer"
          ? "Prepare a buy request"
          : "Prepare a supplier offer"}
      </h2>
      <p>
        Saved drafts are private to your account and expire after 30 days. Your
        verified company and contact identify the submission.
      </p>
      {expires && (
        <p className="muted">
          Draft expires {new Date(expires).toLocaleDateString()}.
        </p>
      )}
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
      {reference ? (
        <div className="context-cta">
          <p>Recorded as {reference}.</p>
          <button className="ghost-button" disabled={busy} onClick={startNew}>
            Start a new draft
          </button>
        </div>
      ) : (
        <form className="quote-form" onSubmit={submit}>
          <label>
            Product or grade
            <input
              required
              maxLength="160"
              value={form.product_text}
              onChange={(event) => update("product_text", event.target.value)}
            />
          </label>
          <div className="form-grid">
            <label>
              Quantity
              <input
                required
                type="number"
                min="0.000001"
                step="any"
                value={form.quantity}
                onChange={(event) => update("quantity", event.target.value)}
              />
            </label>
            <label>
              Unit
              <select
                value={form.unit}
                onChange={(event) => update("unit", event.target.value)}
              >
                {["MT", "KG", "Litre", "Barrel", "Drum", "IBC"].map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </label>
            <label>
              Destination country
              <input
                required={session.role === "customer"}
                maxLength="80"
                value={form.destination_country}
                onChange={(event) =>
                  update("destination_country", event.target.value)
                }
              />
            </label>
            <label>
              Country of origin
              <input
                maxLength="80"
                value={form.origin}
                onChange={(event) => update("origin", event.target.value)}
              />
            </label>
          </div>
          <label>
            Specifications and commercial details
            <textarea
              rows="4"
              maxLength="4000"
              value={form.message}
              onChange={(event) => update("message", event.target.value)}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            I consent to storing this submission for review in this local
            prototype. Approved privacy terms are required before public launch.
          </label>
          <div className="quote-actions">
            <button
              className="ghost-button"
              type="button"
              disabled={busy}
              onClick={save}
            >
              Save draft
            </button>
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : "Submit to the company"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
