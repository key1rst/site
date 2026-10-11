import React, { useEffect, useState } from "react";
import { api, Link } from "./shared";
import { PortalDraft } from "./portalDraft";
import { PortalAccount, PortalDocuments } from "./portalTools";
import { PortalShipments } from "./phase3";
import { Icon, StatusTag } from "./design-system";
import { formatDate } from "./locale-format";

const portalIcons = {
  requests: "file",
  quotes: "quotation",
  tracking: "truck",
  account: "users",
};

export function Portal({ navigate }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("login");
  const [login, setLogin] = useState({ email: "", password: "" });
  const [activate, setActivate] = useState({ token: "", password: "" });
  const [inquiries, setInquiries] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [portalView, setPortalView] = useState("requests");
  const [visitedViews, setVisitedViews] = useState(["requests"]);
  function openPortalView(next) {
    setPortalView(next);
    setVisitedViews((current) =>
      current.includes(next) ? current : [...current, next],
    );
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    api("/portal/me")
      .then(setSession)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!session) return;
    Promise.all([
      api("/portal/inquiries"),
      session.role === "customer" ? api("/portal/quotes") : Promise.resolve([]),
    ])
      .then(([requests, issued]) => {
        setInquiries(requests);
        setQuotes(issued);
      })
      .catch((failure) => setError(failure.message));
  }, [session]);

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setSession(
        await api("/portal/login", {
          method: "POST",
          body: JSON.stringify(login),
        }),
      );
      setLogin({ email: "", password: "" });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function activateAccount(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        mode === "reset" ? "/portal/password-reset" : "/portal/activate",
        {
          method: "POST",
          body: JSON.stringify(activate),
        },
      );
      setActivate({ token: "", password: "" });
      setMode("login");
      setNotice(
        mode === "reset"
          ? "Password updated. Sign in with your new password."
          : "Account activated. Sign in with your email and password.",
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setError("");
    try {
      await api("/portal/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({}),
      });
      setSession(null);
      setSelected(null);
      setSelectedInquiry(null);
      setMessages([]);
      setMessageDraft("");
      setNotice("");
      setPortalView("requests");
      setVisitedViews(["requests"]);
      setQuotes([]);
      setInquiries([]);
    } catch (failure) {
      setError(failure.message);
    }
  }
  async function openQuote(id, version) {
    setError("");
    try {
      setSelected(
        await api(
          `/portal/quotes/${id}${version ? `?version=${version}` : ""}`,
        ),
      );
      setRejectionReason("");
    } catch (failure) {
      setError(failure.message);
    }
  }
  async function openInquiry(reference) {
    setError("");
    try {
      setMessages(await api(`/portal/inquiries/${reference}/messages`));
      setSelectedInquiry(reference);
      setMessageDraft("");
    } catch (failure) {
      setError(failure.message);
    }
  }
  async function sendMessage(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/portal/inquiries/${selectedInquiry}/messages`, {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({ body: messageDraft }),
      });
      setMessages(await api(`/portal/inquiries/${selectedInquiry}/messages`));
      setMessageDraft("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function acceptQuote() {
    setBusy(true);
    setError("");
    try {
      await api(`/portal/quotes/${selected.id}/accept`, {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({ version: selected.revision.version }),
      });
      setSelected(await api(`/portal/quotes/${selected.id}`));
      setQuotes(await api("/portal/quotes"));
      setNotice(
        "Your acceptance was recorded. The company will follow up on the next commercial step.",
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function rejectQuote() {
    setBusy(true);
    setError("");
    try {
      await api(`/portal/quotes/${selected.id}/reject`, {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({
          version: selected.revision.version,
          reason: rejectionReason,
        }),
      });
      setSelected(await api(`/portal/quotes/${selected.id}`));
      setQuotes(await api("/portal/quotes"));
      setRejectionReason("");
      setNotice("Your rejection and reason were recorded for the Sales team.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return <div className="container page notice">Checking portal access…</div>;
  if (!session)
    return (
      <div className="container page portal-page">
        <span className="eyebrow">PRIVATE COMPANY ACCESS</span>
        <h1>Client portal</h1>
        <p className="page-lead">
          Access requires a staff-approved company and a one-time invitation.
        </p>
        <div className="tabs" role="group" aria-label="Portal access mode">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            className={mode === "activate" ? "active" : ""}
            onClick={() => setMode("activate")}
          >
            Activate invite
          </button>
          <button
            className={mode === "reset" ? "active" : ""}
            onClick={() => setMode("reset")}
          >
            Reset password
          </button>
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {mode === "login" ? (
          <form className="login-card" onSubmit={signIn}>
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="username"
                value={login.email}
                onChange={(event) =>
                  setLogin({ ...login, email: event.target.value })
                }
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={login.password}
                onChange={(event) =>
                  setLogin({ ...login, password: event.target.value })
                }
              />
            </label>
            <button className="button" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form className="login-card" onSubmit={activateAccount}>
            <label>
              {mode === "reset"
                ? "One-time recovery token from the administrator"
                : "One-time invitation token"}
              <input
                required
                value={activate.token}
                onChange={(event) =>
                  setActivate({ ...activate, token: event.target.value })
                }
              />
            </label>
            <label>
              Create password (14+ characters)
              <input
                type="password"
                required
                minLength="14"
                autoComplete="new-password"
                value={activate.password}
                onChange={(event) =>
                  setActivate({ ...activate, password: event.target.value })
                }
              />
            </label>
            <button className="button" disabled={busy}>
              {busy
                ? "Saving…"
                : mode === "reset"
                  ? "Reset password"
                  : "Activate account"}
            </button>
          </form>
        )}
      </div>
    );
  return (
    <div className="container page portal-page">
      <div className="staff-heading">
        <div>
          <span className="eyebrow">{session.role.toUpperCase()} PORTAL</span>
          <h1>{session.company}</h1>
          <p>{session.email}</p>
        </div>
        <button className="ghost-button" onClick={signOut}>
          Sign out
        </button>
      </div>
      <div className="workspace-layout">
        <nav className="workspace-nav" aria-label="Portal sections">
          {[
            ["requests", session.role === "customer" ? "Requests" : "Offers"],
            ...(session.role === "customer"
              ? [
                  ["quotes", "Quotations"],
                  ["tracking", "Tracking"],
                ]
              : []),
            ["account", "Account & documents"],
          ].map(([id, label]) => (
            <button
              key={id}
              data-view={id}
              type="button"
              className={portalView === id ? "active" : ""}
              aria-current={portalView === id ? "page" : undefined}
              onClick={() => openPortalView(id)}
            >
              <Icon name={portalIcons[id]} size={21} />
              {label}
            </button>
          ))}
        </nav>
        <div className="workspace-content">
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="workspace-section" hidden={portalView !== "requests"}>
            <PortalDraft
              session={session}
              onSubmitted={() =>
                api("/portal/inquiries")
                  .then(setInquiries)
                  .catch((failure) => setError(failure.message))
              }
            />
            <section className="portal-section">
              <h2>
                {session.role === "customer"
                  ? "Your buy requests"
                  : "Your offers"}
              </h2>
              {inquiries.length ? (
                <div className="stock-list">
                  {inquiries.map((item) => (
                    <div className="stock-row" key={item.reference}>
                      <div>
                        <button
                          className="inline-button"
                          onClick={() => openInquiry(item.reference)}
                        >
                          {item.reference}
                        </button>
                        <small>
                          {formatDate(item.created_at)}
                        </small>
                      </div>
                      <span>{item.product_text || "Published product"}</span>
                      <StatusTag value={item.status} />
                      <span>
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="notice">
                  No submissions are linked to this verified company account.
                </div>
              )}
              {selectedInquiry && (
                <div className="inquiry-detail message-thread">
                  <h3>Messages for {selectedInquiry}</h3>
                  <PortalDocuments
                    session={session}
                    reference={selectedInquiry}
                  />
                  <div className="history">
                    {messages.length ? (
                      messages.map((item, index) => (
                        <p key={index}>
                          <b>{item.sender_type}</b>: {item.body}
                          <small>
                            {formatDate(item.created_at, true)}
                          </small>
                        </p>
                      ))
                    ) : (
                      <p>No messages yet.</p>
                    )}
                  </div>
                  <form onSubmit={sendMessage}>
                    <label>
                      New message
                      <textarea
                        required
                        maxLength="4000"
                        rows="3"
                        value={messageDraft}
                        onChange={(event) =>
                          setMessageDraft(event.target.value)
                        }
                      />
                    </label>
                    <button className="button" disabled={busy}>
                      Send message
                    </button>
                  </form>
                </div>
              )}
            </section>
          </div>
          {session.role === "customer" && (
            <section
              className="portal-section workspace-section"
              hidden={portalView !== "quotes"}
            >
              <h2>Quotations</h2>
              {quotes.length ? (
                <div className="workbench-grid">
                  <div className="inbox-list">
                    {quotes.map((quote) => (
                      <button
                        className={
                          selected?.id === quote.id
                            ? "inbox-item active"
                            : "inbox-item"
                        }
                        key={quote.id}
                        onClick={() => openQuote(quote.id)}
                      >
                        <StatusTag value={quote.status} />
                        <b>{quote.reference}</b>
                        <small>
                          {quote.currency} {quote.total} · valid until{" "}
                          {quote.validity_date}
                        </small>
                      </button>
                    ))}
                  </div>
                  <div className="inquiry-detail">
                    {selected ? (
                      <>
                        <span className="eyebrow">{selected.reference}</span>
                        <h3>Quotation v{selected.revision.version}</h3>
                        <label>
                          Issued revision
                          <select
                            value={selected.revision.version}
                            onChange={(event) =>
                              openQuote(selected.id, event.target.value)
                            }
                          >
                            {selected.versions.map((version) => (
                              <option key={version} value={version}>
                                Version {version}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p>
                          {selected.revision.currency} {selected.revision.total}{" "}
                          · valid until {selected.revision.validity_date}
                        </p>
                        <div className="history">
                          {selected.revision.items.map((item, index) => (
                            <p key={index}>
                              {item.description} · {item.quantity} {item.unit} ×{" "}
                              {item.unit_price} = {item.line_total}
                            </p>
                          ))}
                        </div>
                        <p>
                          Delivery: {selected.revision.incoterm}{" "}
                          {selected.revision.named_place}
                        </p>
                        <p>
                          Delivery terms: {selected.revision.delivery_terms}
                        </p>
                        <p>Payment terms: {selected.revision.payment_terms}</p>
                        <a
                          className="ghost-button download-link"
                          href={`/api/portal/quotes/${selected.id}/pdf?version=${selected.revision.version}`}
                        >
                          Download PDF
                        </a>
                        {selected.acceptance_available && (
                          <button
                            className="button"
                            disabled={busy}
                            onClick={acceptQuote}
                          >
                            Accept quotation
                          </button>
                        )}
                        {selected.acceptance_available && (
                          <div className="quote-form">
                            <label>
                              Reason to decline these terms
                              <input
                                maxLength="1000"
                                value={rejectionReason}
                                onChange={(event) =>
                                  setRejectionReason(event.target.value)
                                }
                              />
                            </label>
                            <button
                              className="ghost-button"
                              disabled={
                                busy || rejectionReason.trim().length < 5
                              }
                              onClick={rejectQuote}
                            >
                              Decline quotation
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="notice">
                        Select a quotation to review its issued terms.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="notice">
                  No issued quotations are available yet.
                </div>
              )}
            </section>
          )}
          <div className="workspace-section" hidden={portalView !== "account"}>
            {visitedViews.includes("account") && (
              <PortalAccount session={session} navigate={navigate} />
            )}
          </div>
          <div className="workspace-section" hidden={portalView !== "tracking"}>
            {visitedViews.includes("tracking") && (
              <PortalShipments session={session} />
            )}
          </div>
          <div className="context-cta">
            <p>Need to send a new request?</p>
            <Link
              to={session.role === "customer" ? "/buy" : "/sell"}
              navigate={navigate}
            >
              Start a new submission ↗
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
