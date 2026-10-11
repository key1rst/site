import React, { useEffect, useState } from "react";
import { api, SectionHead } from "./shared";
import { StatusTag } from "./design-system";
import { formatDate } from "./locale-format";

const freshShipment = {
  quote_id: "",
  carrier: "",
  tracking_reference: "",
  origin: "",
  destination: "",
  expected_delivery_date: "",
  reason: "",
};
const freshEvent = {
  status: "",
  reason: "",
  evidence_reference: "",
  customer_note: "",
  occurred_at: "",
};
const csrf = (session) => ({ "X-CSRF-Token": session.csrf_token });
const localDateTime = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export function ShipmentWorkbench({ session }) {
  const [quotes, setQuotes] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(freshShipment);
  const [details, setDetails] = useState(null);
  const [event, setEvent] = useState({
    ...freshEvent,
    occurred_at: localDateTime(),
  });
  const [createKey, setCreateKey] = useState(() => crypto.randomUUID());
  const [eventKey, setEventKey] = useState(() => crypto.randomUUID());
  const [visibilityReason, setVisibilityReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const [quoteRows, shipmentRows] = await Promise.all([
      api("/admin/quotes"),
      api("/admin/shipments"),
    ]);
    setQuotes(quoteRows.filter((row) => row.status === "accepted"));
    setShipments(shipmentRows);
  }
  useEffect(() => {
    refresh().catch((failure) => setError(failure.message));
  }, []);
  async function open(id) {
    setError("");
    try {
      const row = await api(`/admin/shipments/${id}`);
      setSelected(row);
      setDetails({
        carrier: row.carrier,
        tracking_reference: row.tracking_reference,
        origin: row.origin,
        destination: row.destination,
        expected_delivery_date: row.expected_delivery_date || "",
        reason: "",
      });
      setEvent({ ...freshEvent, occurred_at: localDateTime() });
      setEventKey(crypto.randomUUID());
    } catch (failure) {
      setError(failure.message);
    }
  }
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api("/admin/shipments", {
        method: "POST",
        headers: { ...csrf(session), "Idempotency-Key": createKey },
        body: JSON.stringify({
          ...draft,
          expected_delivery_date: draft.expected_delivery_date || null,
        }),
      });
      setCreateKey(crypto.randomUUID());
      setDraft(freshShipment);
      await refresh();
      await open(row.id);
      setNotice(
        "Shipment plan recorded. No stock, payment, or carrier system was changed.",
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDetails(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/admin/shipments/${selected.id}`, {
        method: "PUT",
        headers: csrf(session),
        body: JSON.stringify({
          ...details,
          expected_delivery_date: details.expected_delivery_date || null,
          expected_version: selected.version,
        }),
      });
      await refresh();
      await open(selected.id);
      setNotice("Shipment details changed with an audit record.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function record(eventSubmit) {
    eventSubmit.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/admin/shipments/${selected.id}/events`, {
        method: "POST",
        headers: { ...csrf(session), "Idempotency-Key": eventKey },
        body: JSON.stringify({
          ...event,
          expected_version: selected.version,
          occurred_at: new Date(event.occurred_at).toISOString(),
        }),
      });
      setEventKey(crypto.randomUUID());
      await refresh();
      await open(selected.id);
      setNotice(
        "Status and evidence recorded. External integrations require a separate reviewed queue action.",
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function visibility() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/admin/shipments/${selected.id}/visibility`, {
        method: "POST",
        headers: csrf(session),
        body: JSON.stringify({
          expected_version: selected.version,
          visible: !selected.portal_visible,
          reason: visibilityReason,
        }),
      });
      await refresh();
      await open(selected.id);
      setVisibilityReason("");
      setNotice("Customer tracking visibility updated.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-tools" id="shipments">
      <SectionHead
        eyebrow="PHASE 3 LOGISTICS"
        title="Outbound shipments"
        text="Track staff-confirmed events from accepted quotations. A plan does not reserve stock or record payment."
      />
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
      <div className="workbench-grid">
        <div className="inbox-list">
          <button
            className="inbox-item"
            onClick={() => {
              setSelected(null);
              setError("");
            }}
          >
            + Plan a shipment
          </button>
          {shipments.map((row) => (
            <button
              key={row.id}
              className={`inbox-item ${selected?.id === row.id ? "active" : ""}`}
              onClick={() => open(row.id)}
            >
              <span className="inbox-meta">
                <StatusTag value={row.status} /> v{row.version}
              </span>
              <b>{row.reference}</b>
              <small>
                {row.company_name} · {row.quote_reference}
              </small>
            </button>
          ))}
          {!shipments.length && (
            <p className="notice">No shipment records yet.</p>
          )}
        </div>
        <div className="inquiry-detail">
          {!selected ? (
            <form className="quote-form" onSubmit={create}>
              <h3>Plan from an accepted quotation</h3>
              <label>
                Accepted quotation
                <select
                  required
                  value={draft.quote_id}
                  onChange={(e) =>
                    setDraft({ ...draft, quote_id: e.target.value })
                  }
                >
                  <option value="">Select a quotation</option>
                  {quotes.map((row) => (
                    <option value={row.id} key={row.id}>
                      {row.reference} · {row.company_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                {[
                  ["origin", "Origin"],
                  ["destination", "Destination"],
                  ["carrier", "Carrier, if known"],
                  ["tracking_reference", "Tracking reference, if known"],
                ].map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <input
                      maxLength="160"
                      required={["origin", "destination"].includes(field)}
                      value={draft[field]}
                      onChange={(e) =>
                        setDraft({ ...draft, [field]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <label>
                Expected delivery date, if known
                <input
                  type="date"
                  value={draft.expected_delivery_date}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      expected_delivery_date: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Planning reason
                <input
                  required
                  minLength="5"
                  maxLength="1000"
                  value={draft.reason}
                  onChange={(e) =>
                    setDraft({ ...draft, reason: e.target.value })
                  }
                />
              </label>
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Create shipment plan"}
              </button>
            </form>
          ) : (
            <>
              <span className="eyebrow">{selected.reference}</span>
              <h3>{selected.company_name}</h3>
              <p>
                Quote {selected.quote_reference} ·{" "}
                {selected.status.replaceAll("_", " ")} · version{" "}
                {selected.version}
              </p>
              <p>
                {selected.portal_visible
                  ? "Visible to the verified customer"
                  : "Private to staff"}
              </p>
              <form className="quote-form" onSubmit={saveDetails}>
                <h4>Tracking details</h4>
                <div className="form-grid">
                  {[
                    ["origin", "Origin"],
                    ["destination", "Destination"],
                    ["carrier", "Carrier"],
                    ["tracking_reference", "Tracking reference"],
                  ].map(([field, label]) => (
                    <label key={field}>
                      {label}
                      <input
                        maxLength="160"
                        required={["origin", "destination"].includes(field)}
                        value={details?.[field] ?? ""}
                        onChange={(e) =>
                          setDetails({ ...details, [field]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Expected delivery date
                  <input
                    type="date"
                    value={details?.expected_delivery_date ?? ""}
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        expected_delivery_date: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Reason for detail change
                  <input
                    required
                    minLength="5"
                    maxLength="1000"
                    value={details?.reason ?? ""}
                    onChange={(e) =>
                      setDetails({ ...details, reason: e.target.value })
                    }
                  />
                </label>
                <button
                  className="ghost-button"
                  disabled={
                    busy || ["delivered", "cancelled"].includes(selected.status)
                  }
                >
                  Save details
                </button>
              </form>
              {!!selected.allowed_transitions.length && (
                <form className="quote-form" onSubmit={record}>
                  <h4>Record actual status</h4>
                  <label>
                    New status
                    <select
                      required
                      value={event.status}
                      onChange={(e) =>
                        setEvent({ ...event, status: e.target.value })
                      }
                    >
                      <option value="">Select status</option>
                      {selected.allowed_transitions.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    When it happened (your local time)
                    <input
                      required
                      type="datetime-local"
                      value={event.occurred_at}
                      onChange={(e) =>
                        setEvent({ ...event, occurred_at: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Evidence reference
                    <input
                      required
                      minLength="3"
                      maxLength="500"
                      value={event.evidence_reference}
                      onChange={(e) =>
                        setEvent({
                          ...event,
                          evidence_reference: e.target.value,
                        })
                      }
                      placeholder="Carrier booking or tracking evidence"
                    />
                  </label>
                  <label>
                    Internal reason
                    <input
                      required
                      minLength="5"
                      maxLength="1000"
                      value={event.reason}
                      onChange={(e) =>
                        setEvent({ ...event, reason: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Customer-facing note, if approved
                    <textarea
                      rows="2"
                      maxLength="1000"
                      value={event.customer_note}
                      onChange={(e) =>
                        setEvent({ ...event, customer_note: e.target.value })
                      }
                    />
                  </label>
                  <button className="button" disabled={busy}>
                    {busy ? "Recording…" : "Record status and evidence"}
                  </button>
                </form>
              )}
              {session.role === "admin" && (
                <div className="quote-form">
                  <h4>Customer portal visibility</h4>
                  <label>
                    Approval reason
                    <input
                      minLength="5"
                      maxLength="1000"
                      value={visibilityReason}
                      onChange={(e) => setVisibilityReason(e.target.value)}
                    />
                  </label>
                  <button
                    className="ghost-button"
                    disabled={
                      busy ||
                      visibilityReason.trim().length < 5 ||
                      (selected.status === "planned" &&
                        !selected.portal_visible)
                    }
                    onClick={visibility}
                  >
                    {selected.portal_visible
                      ? "Hide tracking"
                      : "Publish tracking"}
                  </button>
                </div>
              )}
              <h4>Staff audit history</h4>
              <div className="history">
                {selected.events.map((item) => (
                  <p key={item.version}>
                    <b>
                      v{item.version} · {item.action.replaceAll("_", " ")} ·{" "}
                      {item.new_status}
                    </b>
                    <small>
                      {formatDate(item.occurred_at, true)} · recorded
                      by {item.actor}
                    </small>
                    {item.evidence_reference && (
                      <span>Evidence: {item.evidence_reference}</span>
                    )}
                    <span>{item.reason}</span>
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function PortalShipments({ session }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  async function refresh() {
    try {
      setRows(await api("/portal/shipments"));
      setError("");
    } catch (failure) {
      setError(failure.message);
    }
  }
  useEffect(() => {
    if (session.role === "customer") refresh();
  }, [session]);
  if (session.role !== "customer") return null;
  return (
    <section className="portal-section">
      <div className="quote-actions">
        <h2>Shipment tracking</h2>
        <button className="inline-button" onClick={refresh}>
          Refresh
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {rows.length ? (
        rows.map((row) => (
          <div className="inquiry-detail" key={row.id}>
            <h3>
              {row.reference} · <StatusTag value={row.status} />
            </h3>
            <p>
              {row.carrier} · {row.tracking_reference}
            </p>
            <p>
              {row.origin} → {row.destination}
            </p>
            {row.expected_delivery_date && (
              <p>Expected date: {row.expected_delivery_date}</p>
            )}
            <div className="history">
              {row.events.map((item, index) => (
                <p key={index}>
                  <StatusTag value={item.status} /> ·{" "}
                  {formatDate(item.occurred_at, true)}
                  {item.customer_note && <span>{item.customer_note}</span>}
                </p>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p>No shipment tracking has been published for this account.</p>
      )}
    </section>
  );
}
