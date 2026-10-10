import React, { useEffect, useRef, useState } from "react";
import { api, SectionHead } from "./shared";

const emptyQuote = () => ({
  inquiry_id: "",
  currency: "USD",
  incoterm: "",
  named_place: "",
  payment_terms: "",
  delivery_terms: "",
  validity_date: "",
  notes: "",
  origin: "",
  packing: "",
  loading_port: "",
  destination: "",
  terms: "",
  items: [{ description: "", quantity: "", unit: "MT", unit_price: "" }],
});

function quoteFormFromRevision(revision) {
  return {
    currency: revision.currency,
    incoterm: revision.incoterm,
    named_place: revision.named_place,
    payment_terms: revision.payment_terms,
    delivery_terms: revision.delivery_terms,
    validity_date: revision.validity_date,
    notes: revision.notes,
    origin: revision.origin,
    packing: revision.packing,
    loading_port: revision.loading_port,
    destination: revision.destination,
    terms: revision.terms,
    items: revision.items.map(
      ({ description, quantity, unit, unit_price }) => ({
        description,
        quantity,
        unit,
        unit_price,
      }),
    ),
  };
}

export function QuoteWorkbench({ session }) {
  const [inquiries, setInquiries] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyQuote);
  const [reason, setReason] = useState("");
  const [proforma, setProforma] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [quoteList, inquiryList] = await Promise.all([
      api("/admin/quotes"),
      api("/admin/inquiries?kind=buy"),
    ]);
    setQuotes(quoteList);
    setInquiries(inquiryList);
  }
  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);

  async function openQuote(id) {
    setMessage("");
    try {
      const result = await api(`/admin/quotes/${id}`);
      setSelected(result);
      setForm(quoteFormFromRevision(result.revisions.at(-1)));
      setReason("");
      setProforma(null);
    } catch (error) {
      setMessage(error.message);
    }
  }
  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }
  function setItem(index, name, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, [name]: value } : item,
      ),
    }));
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const current = selected?.revisions.at(-1);
      const method = !selected
        ? "POST"
        : current.state === "draft"
          ? "PUT"
          : "POST";
      const path = !selected
        ? "/admin/quotes"
        : current.state === "draft"
          ? `/admin/quotes/${selected.id}/draft`
          : `/admin/quotes/${selected.id}/revisions`;
      const payload = !selected ? form : { ...form, inquiry_id: undefined };
      const result = await api(path, {
        method,
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify(payload),
      });
      await refresh();
      await openQuote(selected?.id || result.id);
      setMessage(
        current?.state === "issued"
          ? "New draft revision created. The issued revision remains unchanged."
          : "Draft saved.",
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function act(path, success) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api(path, {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify(
          path.endsWith("/accept") || path.includes("/decision?")
            ? { reason, version: current.version }
            : {},
        ),
      });
      if (path.endsWith("/proforma")) setProforma(result);
      await refresh();
      await openQuote(path.endsWith("/duplicate") ? result.id : selected.id);
      if (path.endsWith("/proforma")) setProforma(result);
      setMessage(success);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  const current = selected?.revisions.at(-1);
  const draftChanged = Boolean(
    selected &&
    JSON.stringify(form) !== JSON.stringify(quoteFormFromRevision(current)),
  );
  return (
    <section className="admin-tools" id="quotes">
      <SectionHead
        eyebrow="SALES COMMERCIAL"
        title="Quotations"
        text="Prepare terms from an RFQ. Issued revisions are preserved and can be shared with a verified customer account."
      />
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <div className="workbench-grid">
        <div className="inbox-list">
          <button
            className="inbox-item"
            onClick={() => {
              setSelected(null);
              setForm(emptyQuote());
              setMessage("");
            }}
          >
            + New quotation
          </button>
          {quotes.map((quote) => (
            <button
              key={quote.id}
              className={
                selected?.id === quote.id ? "inbox-item active" : "inbox-item"
              }
              onClick={() => openQuote(quote.id)}
            >
              <span>
                {quote.status.toUpperCase()} · v{quote.current_version}
              </span>
              <b>{quote.company_name}</b>
              <small>{quote.reference}</small>
            </button>
          ))}
        </div>
        <div className="inquiry-detail">
          <h3>
            {selected
              ? `${selected.reference} · ${selected.company_name}`
              : "New quotation"}
          </h3>
          {selected && (
            <p>
              Current version: {current.version} · {current.state} ·{" "}
              {current.currency} {current.total}
            </p>
          )}
          {!["accepted", "cancelled"].includes(selected?.status) && (
            <form onSubmit={save} className="quote-form">
              {!selected && (
                <label>
                  Buy request
                  <select
                    required
                    value={form.inquiry_id}
                    onChange={(event) =>
                      setField("inquiry_id", event.target.value)
                    }
                  >
                    <option value="">Choose an RFQ</option>
                    {inquiries.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.reference} · {item.company_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <h4>Items</h4>
              {form.items.map((item, index) => (
                <div className="quote-item" key={index}>
                  <label>
                    Description
                    <input
                      required
                      maxLength="500"
                      value={item.description}
                      onChange={(event) =>
                        setItem(index, "description", event.target.value)
                      }
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Quantity
                      <input
                        required
                        type="number"
                        min="0.0001"
                        step="any"
                        value={item.quantity}
                        onChange={(event) =>
                          setItem(index, "quantity", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Unit
                      <select
                        value={item.unit}
                        onChange={(event) =>
                          setItem(index, "unit", event.target.value)
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
                    Unit price
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) =>
                        setItem(index, "unit_price", event.target.value)
                      }
                    />
                  </label>
                  {form.items.length > 1 && (
                    <button
                      className="inline-button"
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove item
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    items: [
                      ...current.items,
                      {
                        description: "",
                        quantity: "",
                        unit: "MT",
                        unit_price: "",
                      },
                    ],
                  }))
                }
              >
                Add item
              </button>
              <div className="form-grid">
                <label>
                  Currency
                  <select
                    value={form.currency}
                    onChange={(event) =>
                      setField("currency", event.target.value)
                    }
                  >
                    {["USD", "EUR", "GBP", "AED", "CNY", "TRY"].map(
                      (currency) => (
                        <option key={currency}>{currency}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Valid until
                  <input
                    type="date"
                    required
                    value={form.validity_date}
                    onChange={(event) =>
                      setField("validity_date", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Incoterm
                  <input
                    required
                    maxLength="20"
                    value={form.incoterm}
                    onChange={(event) =>
                      setField("incoterm", event.target.value)
                    }
                    placeholder="e.g. FOB"
                  />
                </label>
                <label>
                  Named place
                  <input
                    required
                    value={form.named_place}
                    onChange={(event) =>
                      setField("named_place", event.target.value)
                    }
                  />
                </label>
              </div>
              <label>
                Delivery terms
                <input
                  required
                  value={form.delivery_terms}
                  onChange={(event) =>
                    setField("delivery_terms", event.target.value)
                  }
                />
              </label>
              <label>
                Payment terms
                <input
                  required
                  value={form.payment_terms}
                  onChange={(event) =>
                    setField("payment_terms", event.target.value)
                  }
                />
              </label>
              <label>
                Notes
                <textarea
                  rows="3"
                  value={form.notes}
                  onChange={(event) => setField("notes", event.target.value)}
                />
              </label>
              <div className="form-grid">
                {[
                  ["origin", "Country of origin"],
                  ["packing", "Packing"],
                  ["loading_port", "Loading port"],
                  ["destination", "Destination"],
                ].map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <input
                      maxLength="160"
                      value={form[field]}
                      onChange={(event) => setField(field, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label>
                Additional commercial terms
                <textarea
                  rows="3"
                  maxLength="4000"
                  value={form.terms}
                  onChange={(event) => setField("terms", event.target.value)}
                />
              </label>
              <button className="button" disabled={busy}>
                {busy
                  ? "Saving…"
                  : current?.state === "issued"
                    ? "Create draft revision"
                    : "Save draft"}
              </button>
            </form>
          )}
          {selected && (
            <div className="quote-actions">
              <button
                className="ghost-button"
                disabled={busy}
                onClick={() =>
                  act(
                    `/admin/quotes/${selected.id}/duplicate`,
                    "A separate draft quotation was created.",
                  )
                }
              >
                Duplicate as new draft
              </button>
              {!["accepted", "cancelled", "rejected"].includes(
                selected.status,
              ) && (
                <div className="quote-form">
                  <label>
                    Reason for rejection or cancellation
                    <input
                      minLength="5"
                      maxLength="1000"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </label>
                  <div className="quote-actions">
                    {["rejected", "cancelled"].map((outcome) => (
                      <button
                        className="ghost-button"
                        key={outcome}
                        disabled={busy || reason.trim().length < 5}
                        onClick={() =>
                          act(
                            `/admin/quotes/${selected.id}/decision?outcome=${outcome}`,
                            `Quotation ${outcome}; the decision was recorded.`,
                          )
                        }
                      >
                        {outcome === "rejected"
                          ? "Record rejection"
                          : "Cancel quotation"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {current.state === "draft" && selected.status === "draft" && (
                <button
                  className="ghost-button"
                  disabled={busy || draftChanged}
                  onClick={() =>
                    act(
                      `/admin/quotes/${selected.id}/issue`,
                      "Revision issued and visible to verified customer accounts. Email has not been sent.",
                    )
                  }
                >
                  Issue current revision
                </button>
              )}
              {current.state === "draft" && draftChanged && (
                <p>Save your draft changes before issuing.</p>
              )}
              {current.state === "issued" &&
                ["issued", "sent"].includes(selected.status) &&
                (!selected.email_delivery ||
                  ["failed", "cancelled"].includes(
                    selected.email_delivery.status,
                  )) && (
                  <button
                    className="ghost-button"
                    disabled={busy || draftChanged}
                    onClick={() =>
                      act(
                        `/admin/quotes/${selected.id}/send`,
                        "Quotation email queued. Delivery is pending until the mail worker succeeds.",
                      )
                    }
                  >
                    Queue quotation email
                  </button>
                )}
              {selected.email_delivery && (
                <p>Email delivery: {selected.email_delivery.status}</p>
              )}
              {current.state === "issued" &&
                ["issued", "sent"].includes(selected.status) && (
                  <>
                    <label>
                      Acceptance evidence/reason
                      <input
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Record how acceptance was confirmed"
                      />
                    </label>
                    <button
                      className="ghost-button"
                      disabled={busy || reason.length < 5}
                      onClick={() =>
                        act(
                          `/admin/quotes/${selected.id}/accept`,
                          "Acceptance recorded.",
                        )
                      }
                    >
                      Record acceptance
                    </button>
                  </>
                )}
              {selected.status === "accepted" && (
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() =>
                    act(
                      `/admin/quotes/${selected.id}/proforma`,
                      "Proforma generated.",
                    )
                  }
                >
                  Generate proforma
                </button>
              )}
              <div className="history">
                <h4>Revisions</h4>
                {selected.revisions.map((revision) => (
                  <p key={revision.id}>
                    v{revision.version} · {revision.state} · {revision.currency}{" "}
                    {revision.total}{" "}
                    <a
                      href={`/api/admin/quotes/${selected.id}/revisions/${revision.version}/pdf`}
                    >
                      Download PDF
                    </a>
                  </p>
                ))}
                {proforma && (
                  <p>
                    <a href={`/api/admin/proformas/${proforma.id}/pdf`}>
                      Download proforma {proforma.reference}
                    </a>
                  </p>
                )}
                <h4>Commercial activity</h4>
                {selected.events.map((event, index) => (
                  <p key={index}>
                    <b>{event.action.replaceAll("_", " ")}</b> ·{" "}
                    {event.actor_type}
                    <small>{new Date(event.created_at).toLocaleString()}</small>
                    {event.detail && <span>{event.detail}</span>}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function CompanyAccess({ session }) {
  const [companies, setCompanies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [invite, setInvite] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewReason, setReviewReason] = useState("");
  const [history, setHistory] = useState(null);
  const companyRequest = useRef(0);
  async function refresh() {
    setCompanies(await api("/admin/companies"));
  }
  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);
  async function openCompany(company) {
    const requestId = ++companyRequest.current;
    setSelected(company);
    setReview(null);
    setHistory(null);
    setInvite(null);
    setReason("");
    setReviewReason("");
    setMessage("");
    try {
      const [details, events] = await Promise.all([
        api(`/admin/companies/${company.id}/compliance`),
        api(`/admin/companies/${company.id}/history`),
      ]);
      if (requestId === companyRequest.current) {
        setReview(details);
        setHistory(events);
      }
    } catch (error) {
      if (requestId === companyRequest.current) {
        setReview(null);
        setMessage(error.message);
      }
    }
  }
  async function saveReview(event) {
    event.preventDefault();
    setMessage("");
    try {
      const result = await api(`/admin/companies/${selected.id}/compliance`, {
        method: "PUT",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({ ...review, reason: reviewReason }),
      });
      setReview({ ...review, status: result.status, hold: result.hold });
      setReviewReason("");
      await refresh();
      setMessage("Compliance review saved and audited.");
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function approve(status) {
    setMessage("");
    try {
      await api(`/admin/companies/${selected.id}/verification`, {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({ status, reason }),
      });
      await refresh();
      setSelected({ ...selected, verification_status: status });
      setMessage(`Company marked ${status}.`);
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function makeInvite() {
    setMessage("");
    try {
      const result = await api("/admin/portal-invites", {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({
          company_id: selected.id,
          contact_id: selected.contact_id,
          role: selected.role || "customer",
        }),
      });
      setInvite(result);
      setMessage(
        "One-time invite created. Deliver its token through an approved private channel.",
      );
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function makeReset() {
    setMessage("");
    try {
      const result = await api(
        `/admin/companies/${selected.id}/password-reset`,
        {
          method: "POST",
          headers: { "X-CSRF-Token": session.csrf_token },
          body: JSON.stringify({ contact_id: selected.contact_id, reason }),
        },
      );
      setInvite({ ...result, recovery: true });
      setMessage(
        "Recovery token created. Verify the contact's identity and deliver through an approved private channel.",
      );
      setReason("");
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <section className="admin-tools" id="verification">
      <SectionHead
        eyebrow="ACCOUNT ACCESS"
        title="Company verification"
        text="Only an administrator can approve a company and issue an invitation to a known contact."
      />
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <div className="workbench-grid">
        <div className="inbox-list">
          {companies.map((company) => (
            <button
              key={`${company.id}-${company.contact_id}`}
              className="inbox-item"
              onClick={() => openCompany(company)}
            >
              <span>{company.verification_status.toUpperCase()}</span>
              <b>{company.name}</b>
              <small>{company.contact_email}</small>
            </button>
          ))}
        </div>
        <div className="inquiry-detail">
          {selected ? (
            <>
              <h3>{selected.name}</h3>
              <p>
                {selected.contact_email} · {selected.verification_status}
              </p>
              <label>
                Review reason
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Record evidence and decision"
                />
              </label>
              <div className="action-row">
                <button
                  className="ghost-button"
                  disabled={reason.length < 5}
                  onClick={() => approve("approved")}
                >
                  Approve
                </button>
                <button
                  className="ghost-button"
                  disabled={reason.length < 5}
                  onClick={() => approve("rejected")}
                >
                  Reject
                </button>
              </div>
              <label>
                Portal role
                <select
                  value={selected.role || "customer"}
                  onChange={(event) =>
                    setSelected({ ...selected, role: event.target.value })
                  }
                >
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                </select>
              </label>
              <button
                className="button"
                disabled={selected.verification_status !== "approved"}
                onClick={makeInvite}
              >
                Create portal invite
              </button>
              <button
                className="ghost-button"
                disabled={
                  selected.verification_status !== "approved" ||
                  reason.length < 5
                }
                onClick={makeReset}
              >
                Issue password recovery token
              </button>
              {invite && (
                <div className="notice">
                  <b>One-time token for {invite.email}</b>
                  <code className="token">{invite.token}</code>
                  <small>
                    Expires {new Date(invite.expires_at).toLocaleString()}.
                    {invite.recovery
                      ? "Use the portal Reset password tab. Prior sessions are revoked after recovery."
                      : "Transfer securely; this token grants account activation."}
                  </small>
                </div>
              )}
              {review && (
                <form
                  className="quote-form compliance-form"
                  onSubmit={saveReview}
                >
                  <h3>Transaction review</h3>
                  <p>
                    Record review information and hold decisions. Approval here
                    does not certify legal compliance.
                  </p>
                  <div className="form-grid">
                    <label>
                      Buyer country
                      <input
                        value={review.buyer_country}
                        onChange={(event) =>
                          setReview({
                            ...review,
                            buyer_country: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Supplier country
                      <input
                        value={review.supplier_country}
                        onChange={(event) =>
                          setReview({
                            ...review,
                            supplier_country: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="form-grid">
                    <label>
                      Product origin
                      <input
                        value={review.product_origin}
                        onChange={(event) =>
                          setReview({
                            ...review,
                            product_origin: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Destination country
                      <input
                        value={review.destination_country}
                        onChange={(event) =>
                          setReview({
                            ...review,
                            destination_country: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Registration information
                    <input
                      value={review.registration_information}
                      onChange={(event) =>
                        setReview({
                          ...review,
                          registration_information: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Review status
                    <select
                      value={review.status}
                      onChange={(event) =>
                        setReview({ ...review, status: event.target.value })
                      }
                    >
                      {[
                        "not_reviewed",
                        "pending",
                        "approved",
                        "rejected",
                        "escalated",
                      ].map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={Boolean(review.hold)}
                      onChange={(event) =>
                        setReview({ ...review, hold: event.target.checked })
                      }
                    />
                    Place commercial actions on hold
                  </label>
                  <label>
                    Review notes
                    <textarea
                      rows="3"
                      value={review.review_notes}
                      onChange={(event) =>
                        setReview({
                          ...review,
                          review_notes: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Reason for this change
                    <input
                      required
                      minLength="5"
                      value={reviewReason}
                      onChange={(event) => setReviewReason(event.target.value)}
                    />
                  </label>
                  <button className="ghost-button">Save review</button>
                </form>
              )}
              <button
                className="inline-button"
                onClick={() =>
                  api(`/admin/companies/${selected.id}/history`)
                    .then(setHistory)
                    .catch((error) => setMessage(error.message))
                }
              >
                Refresh audit history
              </button>
              {history && (
                <div className="history">
                  <h4>Verification history</h4>
                  {history.verification.map((event, index) => (
                    <p key={index}>
                      {event.old_status} → {event.new_status} · {event.reason}
                      <small>
                        {event.actor} ·{" "}
                        {new Date(event.created_at).toLocaleString()}
                      </small>
                    </p>
                  ))}
                  <h4>Transaction review history</h4>
                  {history.compliance.map((event, index) => (
                    <p key={index}>
                      {event.old_status} → {event.new_status} · hold{" "}
                      {event.old_hold ? "on" : "off"} →{" "}
                      {event.new_hold ? "on" : "off"} · {event.reason}
                      <small>
                        {event.actor} ·{" "}
                        {new Date(event.created_at).toLocaleString()}
                      </small>
                    </p>
                  ))}
                  <h4>Account activity</h4>
                  {history.access.map((event, index) => (
                    <p key={index}>
                      {event.action.replaceAll("_", " ")} · {event.actor_type} ·{" "}
                      {event.detail}
                      <small>
                        {new Date(event.created_at).toLocaleString()}
                      </small>
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="notice">Select a company for review.</div>
          )}
        </div>
      </div>
    </section>
  );
}
