import React, { useEffect, useState } from "react";
import { api, SectionHead } from "./shared";
import { QuoteWorkbench, CompanyAccess } from "./commercial";
import { InquiryOperations, OperationsReports } from "./operations";
import { ShipmentWorkbench } from "./phase3";
import { IntegrationWorkbench } from "./integrations";
import { Icon, StatusTag } from "./design-system";
import { formatDate } from "./locale-format";

const workspaceIcons = {
  inbox: "file",
  quotes: "quotation",
  shipments: "truck",
  reports: "chart",
  companies: "users",
  integrations: "settings",
  catalog: "database",
};

const stages = {
  buy: [
    "new",
    "reviewing",
    "qualified",
    "quotation_preparing",
    "quotation_sent",
    "negotiating",
    "won",
    "lost",
    "rejected",
  ],
  sell: [
    "new",
    "reviewing",
    "technical_review",
    "price_review",
    "negotiating",
    "approved",
    "purchase_decision",
    "completed",
    "rejected",
  ],
  contact: ["new", "reviewing", "closed"],
};

export function Staff({ navigate }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [task, setTask] = useState({
    title: "",
    due_date: "",
    priority: "normal",
  });
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("all");
  const [filters, setFilters] = useState({ q: "", owner: "all", priority: "" });
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState("inbox");
  const [visited, setVisited] = useState(["inbox"]);
  function openView(next) {
    setView(next);
    setVisited((current) =>
      current.includes(next) ? current : [...current, next],
    );
    window.scrollTo(0, 0);
  }
  const inboxQuery = new URLSearchParams({
    ...filters,
    offset: String(offset),
    kind: tab === "all" ? "" : tab,
  }).toString();
  async function refreshInbox() {
    setItems(await api(`/admin/inquiries?${inboxQuery}`));
    setRefreshKey((value) => value + 1);
  }
  useEffect(() => {
    api("/auth/me")
      .then(setSession)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (session) {
      api("/admin/dashboard")
        .then(setDashboard)
        .catch((e) => setError(e.message));
    }
  }, [session]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    const timer = setTimeout(
      () =>
        api(`/admin/inquiries?${inboxQuery}`)
          .then((rows) => {
            if (active) setItems(rows);
          })
          .catch((failure) => {
            if (active) setError(failure.message);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [session, inboxQuery]);
  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setSession(
        await api("/auth/login", {
          method: "POST",
          body: JSON.stringify(login),
        }),
      );
      setLogin({ email: "", password: "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function openItem(id) {
    setError("");
    try {
      const item = await api(`/admin/inquiries/${id}`);
      setMessages(await api(`/admin/inquiries/${id}/messages`));
      setSelected(item);
      setMessageDraft("");
      setStatus(item.status);
      setNote("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/admin/inquiries/${selected.id}/follow-up`, {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({ status, note }),
      });
      await openItem(selected.id);
      await refreshInbox();
      setDashboard(await api("/admin/dashboard"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function createTask(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/admin/inquiries/${selected.id}/tasks`, {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify(task),
      });
      await openItem(selected.id);
      setTask({ title: "", due_date: "", priority: "normal" });
      setRefreshKey((value) => value + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function completeTask(taskId) {
    setError("");
    try {
      await api(`/admin/inquiries/${selected.id}/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({}),
      });
      await openItem(selected.id);
      setRefreshKey((value) => value + 1);
    } catch (e) {
      setError(e.message);
    }
  }
  async function sendPortalMessage(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/admin/inquiries/${selected.id}/messages`, {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({ body: messageDraft }),
      });
      setMessages(await api(`/admin/inquiries/${selected.id}/messages`));
      setMessageDraft("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    await api("/auth/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": session.csrf_token },
      body: JSON.stringify({}),
    });
    setSession(null);
    setSelected(null);
    setItems([]);
    setDashboard(null);
    setMessages([]);
    setMessageDraft("");
    setTab("all");
    setFilters({ q: "", owner: "all", priority: "" });
    setOffset(0);
    setView("inbox");
    setVisited(["inbox"]);
  }
  if (loading)
    return <div className="container page notice">Checking session…</div>;
  if (!session)
    return (
      <div className="container page staff-page">
        <span className="eyebrow">STAFF ACCESS</span>
        <h1>Sign in to the CRM</h1>
        <form className="login-card" onSubmit={signIn}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={login.email}
              onChange={(e) => setLogin({ ...login, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={login.password}
              onChange={(e) => setLogin({ ...login, password: e.target.value })}
              required
            />
          </label>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  const visible = items.filter((item) => tab === "all" || item.kind === tab);
  const workspaceViews = [
    ["inbox", "Inquiries"],
    ["quotes", "Quotations"],
    ["shipments", "Shipments"],
    ["reports", "Reports"],
    ["companies", "Companies"],
    ["integrations", "Integrations"],
    ["catalog", "Catalog & stock"],
  ].filter(
    ([id]) =>
      id === "inbox" ||
      id === "reports" ||
      (session.role !== "procurement" &&
        ["quotes", "shipments"].includes(id)) ||
      (session.role === "admin" &&
        ["companies", "integrations", "catalog"].includes(id)),
  );
  return (
    <div className="container page staff-page">
      <div className="staff-heading">
        <div>
          <span className="eyebrow">STAFF WORKSPACE</span>
          <h1>
            {view === "inbox"
              ? "Inquiry inbox"
              : workspaceViews.find(([id]) => id === view)?.[1]}
          </h1>
          <p>
            {session.email} · {session.role}
          </p>
        </div>
        <button className="ghost-button" onClick={signOut}>
          Sign out
        </button>
      </div>
      <div className="workspace-layout">
        <nav className="workspace-nav" aria-label="Staff tools">
          {workspaceViews.map(([id, label]) => (
            <button
              key={id}
              data-view={id}
              type="button"
              aria-current={view === id ? "page" : undefined}
              className={view === id ? "active" : ""}
              onClick={() => openView(id)}
            >
              <Icon name={workspaceIcons[id]} size={21} />
              {label}
            </button>
          ))}
        </nav>
        <div className="workspace-content">
          <div className="workspace-section" hidden={view !== "inbox"}>
            {dashboard && (
              <section className="metric-grid" aria-label="CRM overview">
                <div>
                  <span>Leads this month</span>
                  <b>{dashboard.counts.leads_this_month || 0}</b>
                </div>
                <div>
                  <span>RFQs</span>
                  <b>{dashboard.counts.rfqs || 0}</b>
                </div>
                <div>
                  <span>Supplier offers</span>
                  <b>{dashboard.counts.offers || 0}</b>
                </div>
                <div>
                  <span>Open inquiries</span>
                  <b>{dashboard.counts.open || 0}</b>
                </div>
                <div>
                  <span>Overdue tasks</span>
                  <b>{dashboard.overdue_tasks || 0}</b>
                </div>
              </section>
            )}
            <div className="tabs" role="group" aria-label="Filter inquiries">
              {["all", "buy", "sell", "contact"]
                .filter(
                  (value) =>
                    session.role === "admin" ||
                    (session.role === "sales"
                      ? value !== "sell"
                      : ["all", "sell"].includes(value)),
                )
                .map((value) => (
                  <button
                    key={value}
                    className={tab === value ? "active" : ""}
                    onClick={() => {
                      setTab(value);
                      setOffset(0);
                    }}
                  >
                    {value === "all"
                      ? "All"
                      : value === "buy"
                        ? "Buy requests"
                        : value === "sell"
                          ? "Supplier offers"
                          : "Contact"}
                  </button>
                ))}
            </div>
            <div className="form-grid inbox-filters">
              <label>
                Search company, email, product or reference
                <input
                  type="search"
                  maxLength="160"
                  value={filters.q}
                  onChange={(event) => {
                    setFilters({ ...filters, q: event.target.value });
                    setOffset(0);
                  }}
                />
              </label>
              <label>
                Owner
                <select
                  value={filters.owner}
                  onChange={(event) => {
                    setFilters({ ...filters, owner: event.target.value });
                    setOffset(0);
                  }}
                >
                  <option value="all">All owners</option>
                  <option value="mine">Assigned to me</option>
                  <option value="unassigned">Unassigned queue</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  value={filters.priority}
                  onChange={(event) => {
                    setFilters({ ...filters, priority: event.target.value });
                    setOffset(0);
                  }}
                >
                  <option value="">All priorities</option>
                  {["low", "normal", "high"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="inbox-pagination" aria-label="Inquiry pages">
              <button
                className="inline-button"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 100))}
              >
                Previous 100
              </button>
              <span>
                {items.length
                  ? `Records ${offset + 1}–${offset + items.length}`
                  : "No records on this page"}
              </span>
              <button
                className="inline-button"
                disabled={items.length < 100}
                onClick={() => setOffset(offset + 100)}
              >
                Next 100
              </button>
            </div>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <div className="crm-grid">
              <div className="inbox-list">
                {visible.length ? (
                  visible.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openItem(item.id)}
                      className={
                        selected?.id === item.id
                          ? "inbox-item active"
                          : "inbox-item"
                      }
                    >
                      <span className="inbox-meta">
                        {item.kind.toUpperCase()} <StatusTag value={item.status} />
                      </span>
                      <b>{item.company_name}</b>
                      <small>
                        {item.reference} ·{" "}
                        {formatDate(item.created_at)}
                      </small>
                    </button>
                  ))
                ) : (
                  <div className="notice">No inquiries in this queue.</div>
                )}
              </div>
              <div className="inquiry-detail">
                {selected ? (
                  <>
                    <span className="eyebrow">{selected.reference}</span>
                    <h2>{selected.company_name}</h2>
                    <p>
                      {selected.contact_name} · {selected.email}
                    </p>
                    <dl>
                      <div>
                        <dt>Type</dt>
                        <dd>{selected.kind}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd><StatusTag value={selected.status} /></dd>
                      </div>
                      <div>
                        <dt>Product</dt>
                        <dd>
                          {selected.product_text ||
                            selected.product_id ||
                            "Not specified"}
                        </dd>
                      </div>
                      <div>
                        <dt>Quantity</dt>
                        <dd>
                          {selected.quantity
                            ? `${selected.quantity} ${selected.unit}`
                            : "Not specified"}
                        </dd>
                      </div>
                      <div>
                        <dt>Destination</dt>
                        <dd>
                          {selected.destination_country || "Not specified"}
                        </dd>
                      </div>
                      <div>
                        <dt>Origin</dt>
                        <dd>{selected.origin || "Not specified"}</dd>
                      </div>
                    </dl>
                    {selected.message && (
                      <p className="message-box">{selected.message}</p>
                    )}
                    <InquiryOperations
                      session={session}
                      inquiry={selected}
                      onChanged={() =>
                        refreshInbox().catch((failure) =>
                          setError(failure.message),
                        )
                      }
                      onOpen={openItem}
                    />
                    <h3>Follow up</h3>
                    <form onSubmit={save}>
                      <label>
                        Status
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          {stages[selected.kind].map((stage) => (
                            <option value={stage} key={stage}>
                              {stage.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Internal note
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows="3"
                          placeholder="Add context or a reason for lost/rejected"
                        />
                      </label>
                      <button className="button button-blue" disabled={busy}>
                        {busy ? "Saving…" : "Save follow-up"}
                      </button>
                    </form>
                    <h3>Tasks</h3>
                    <div className="history">
                      {selected.tasks?.length ? (
                        selected.tasks.map((item) => (
                          <p key={item.id}>
                            <b>{item.title}</b> · {item.priority} · due{" "}
                            {item.due_date} · {item.status}
                            {item.status !== "completed" && (
                              <button
                                type="button"
                                className="inline-button"
                                onClick={() => completeTask(item.id)}
                              >
                                Complete
                              </button>
                            )}
                          </p>
                        ))
                      ) : (
                        <p>No tasks yet.</p>
                      )}
                    </div>
                    <form onSubmit={createTask}>
                      <label>
                        Task title
                        <input
                          required
                          minLength="3"
                          value={task.title}
                          onChange={(e) =>
                            setTask({ ...task, title: e.target.value })
                          }
                        />
                      </label>
                      <div className="form-grid">
                        <label>
                          Due date
                          <input
                            type="date"
                            required
                            value={task.due_date}
                            onChange={(e) =>
                              setTask({ ...task, due_date: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Priority
                          <select
                            value={task.priority}
                            onChange={(e) =>
                              setTask({ ...task, priority: e.target.value })
                            }
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                          </select>
                        </label>
                      </div>
                      <button className="ghost-button" disabled={busy}>
                        Add task
                      </button>
                    </form>
                    {selected.documents?.length > 0 && (
                      <>
                        <h3>Private documents</h3>
                        <div className="history">
                          {selected.documents.map((document) => (
                            <p key={document.id}>
                              <a href={`/api/admin/documents/${document.id}`}>
                                {document.filename} (download)
                              </a>
                              <small>
                                {document.scan_status} ·{" "}
                                {Math.round(document.bytes / 1024)} KB
                              </small>
                            </p>
                          ))}
                        </div>
                      </>
                    )}
                    <h3>Portal messages</h3>
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
                        <p>No shared messages yet.</p>
                      )}
                    </div>
                    <form onSubmit={sendPortalMessage}>
                      <label>
                        Reply to verified portal contact
                        <textarea
                          required
                          maxLength="4000"
                          rows="3"
                          value={messageDraft}
                          onChange={(e) => setMessageDraft(e.target.value)}
                        />
                      </label>
                      <button className="ghost-button" disabled={busy}>
                        Send message
                      </button>
                    </form>
                    <h3>History</h3>
                    <div className="history">
                      {selected.activity.map((item, index) => (
                        <p key={index}>
                          <b>{item.action.replace("_", " ")}</b> {item.detail}
                          <small>
                            {formatDate(item.created_at, true)}
                          </small>
                        </p>
                      ))}
                      {selected.notes.map((item, index) => (
                        <p key={`n${index}`}>
                          <b>{item.author}</b>: {item.body}
                          <small>
                            {formatDate(item.created_at, true)}
                          </small>
                        </p>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="notice">
                    Select an inquiry to review and follow up.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="workspace-section" hidden={view !== "reports"}>
            {visited.includes("reports") && (
              <OperationsReports
                session={session}
                refreshKey={refreshKey}
                onOpen={(id) => {
                  openView("inbox");
                  openItem(id);
                }}
              />
            )}
          </div>
          {session.role !== "procurement" && (
            <>
              <div className="workspace-section" hidden={view !== "quotes"}>
                {visited.includes("quotes") && (
                  <QuoteWorkbench session={session} />
                )}
              </div>
              <div className="workspace-section" hidden={view !== "shipments"}>
                {visited.includes("shipments") && (
                  <ShipmentWorkbench session={session} />
                )}
              </div>
            </>
          )}
          {session.role === "admin" && (
            <>
              <div className="workspace-section" hidden={view !== "companies"}>
                {visited.includes("companies") && (
                  <CompanyAccess session={session} />
                )}
              </div>
              <div
                className="workspace-section"
                hidden={view !== "integrations"}
              >
                {visited.includes("integrations") && (
                  <IntegrationWorkbench session={session} />
                )}
              </div>
              <div className="workspace-section" hidden={view !== "catalog"}>
                {visited.includes("catalog") && (
                  <AdminTools session={session} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminTools({ session }) {
  const [product, setProduct] = useState({
    slug: "",
    name: "",
    category: "Base Oils",
    grade: "",
    description: "",
    applications: "",
    packaging: "",
    published: false,
  });
  const [lot, setLot] = useState({
    product_id: "",
    origin: "",
    packing: "",
    quantity: "",
    unit: "MT",
    public_visible: false,
    show_quantity: false,
  });
  const [message, setMessage] = useState("");
  const [products, setProducts] = useState([]);
  useEffect(() => {
    api("/products")
      .then(setProducts)
      .catch(() => {});
  }, [message]);
  async function submitProduct(event) {
    event.preventDefault();
    try {
      await api("/admin/products", {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify(product),
      });
      setMessage(
        "Product created. Refresh the public catalog to see published content.",
      );
      setProduct({
        slug: "",
        name: "",
        category: "Base Oils",
        grade: "",
        description: "",
        applications: "",
        packaging: "",
        published: false,
      });
    } catch (e) {
      setMessage(e.message);
    }
  }
  async function submitLot(event) {
    event.preventDefault();
    try {
      await api("/admin/lots", {
        method: "POST",
        headers: { "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({ ...lot, quantity: Number(lot.quantity) }),
      });
      setMessage("Stock lot created.");
      setLot({
        product_id: "",
        origin: "",
        packing: "",
        quantity: "",
        unit: "MT",
        public_visible: false,
        show_quantity: false,
      });
    } catch (e) {
      setMessage(e.message);
    }
  }
  return (
    <section className="admin-tools">
      <SectionHead
        eyebrow="CONTENT OPERATIONS"
        title="Add approved data"
        text="Only publish information approved for public display."
      />
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <div className="admin-grid">
        <form onSubmit={submitProduct}>
          <h3>New product</h3>
          <label>
            Name
            <input
              required
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
            />
          </label>
          <label>
            Slug
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={product.slug}
              onChange={(e) => setProduct({ ...product, slug: e.target.value })}
            />
          </label>
          <label>
            Category
            <select
              value={product.category}
              onChange={(e) =>
                setProduct({ ...product, category: e.target.value })
              }
            >
              <option>Base Oils</option>
              <option>Industrial Lubricants</option>
              <option>Greases</option>
              <option>Process Oils</option>
              <option>White Oil</option>
              <option>Antifreeze</option>
            </select>
          </label>
          <label>
            Grade
            <input
              value={product.grade}
              onChange={(e) =>
                setProduct({ ...product, grade: e.target.value })
              }
            />
          </label>
          <label>
            Description
            <textarea
              value={product.description}
              onChange={(e) =>
                setProduct({ ...product, description: e.target.value })
              }
            />
          </label>
          <label>
            Applications
            <input
              value={product.applications}
              onChange={(e) =>
                setProduct({ ...product, applications: e.target.value })
              }
            />
          </label>
          <label>
            Packaging
            <input
              value={product.packaging}
              onChange={(e) =>
                setProduct({ ...product, packaging: e.target.value })
              }
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={product.published}
              onChange={(e) =>
                setProduct({ ...product, published: e.target.checked })
              }
            />{" "}
            Publish now
          </label>
          <button className="button">Create product</button>
        </form>
        <form onSubmit={submitLot}>
          <h3>New stock lot</h3>
          <label>
            Published product
            <select
              required
              value={lot.product_id}
              onChange={(e) => setLot({ ...lot, product_id: e.target.value })}
            >
              <option value="">Choose product</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Origin
            <input
              value={lot.origin}
              onChange={(e) => setLot({ ...lot, origin: e.target.value })}
            />
          </label>
          <label>
            Packing
            <input
              value={lot.packing}
              onChange={(e) => setLot({ ...lot, packing: e.target.value })}
            />
          </label>
          <label>
            Quantity
            <input
              type="number"
              min="0"
              step="any"
              required
              value={lot.quantity}
              onChange={(e) => setLot({ ...lot, quantity: e.target.value })}
            />
          </label>
          <label>
            Unit
            <select
              value={lot.unit}
              onChange={(e) => setLot({ ...lot, unit: e.target.value })}
            >
              <option>MT</option>
              <option>KG</option>
              <option>Litre</option>
              <option>Barrel</option>
              <option>Drum</option>
              <option>IBC</option>
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={lot.public_visible}
              onChange={(e) =>
                setLot({ ...lot, public_visible: e.target.checked })
              }
            />{" "}
            Show publicly
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={lot.show_quantity}
              onChange={(e) =>
                setLot({ ...lot, show_quantity: e.target.checked })
              }
            />{" "}
            Show exact quantity publicly
          </label>
          <button className="button">Create lot</button>
        </form>
      </div>
    </section>
  );
}
