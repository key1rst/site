import React, { useEffect, useState } from "react";
import { api, SectionHead } from "./shared";
import { StatusTag } from "./design-system";

export function InquiryOperations({ session, inquiry, onChanged, onOpen }) {
  const [details, setDetails] = useState(null);
  const [owners, setOwners] = useState([]);
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setDetails(null);
    setCompany(null);
    setError("");
    Promise.all([
      api(`/admin/inquiries/${inquiry.id}/operations`),
      api("/admin/owners"),
    ])
      .then(([record, users]) => {
        if (active) {
          setDetails(record);
          setOwners(users);
        }
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [inquiry]);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setDetails(
        await api(`/admin/inquiries/${inquiry.id}/operations`, {
          method: "PUT",
          headers: { "X-CSRF-Token": session.csrf_token },
          body: JSON.stringify({
            assigned_to: details.assigned_to || null,
            priority: details.priority,
            next_action: details.next_action,
          }),
        }),
      );
      onChanged();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function openCompany() {
    setError("");
    try {
      setCompany(await api(`/admin/company-overview/${inquiry.company_id}`));
    } catch (failure) {
      setError(failure.message);
    }
  }
  const team = inquiry.kind === "sell" ? "procurement" : "sales";
  return (
    <section className="portal-section">
      <h3>Ownership and next action</h3>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {details && (
        <form className="quote-form" onSubmit={save}>
          <p>
            Current stage: {Math.floor(details.days_in_stage)} days. Entered{" "}
            {new Date(details.stage_entered_at).toLocaleString()}.
          </p>
          <div className="form-grid">
            <label>
              Owner
              <select
                value={details.assigned_to || ""}
                onChange={(event) =>
                  setDetails({
                    ...details,
                    assigned_to: event.target.value || null,
                  })
                }
              >
                <option value="">Unassigned</option>
                {owners
                  .filter((user) => user.role === "admin" || user.role === team)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Priority
              <select
                value={details.priority}
                onChange={(event) =>
                  setDetails({ ...details, priority: event.target.value })
                }
              >
                {["low", "normal", "high"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Next action
            <input
              maxLength="500"
              value={details.next_action}
              onChange={(event) =>
                setDetails({ ...details, next_action: event.target.value })
              }
            />
          </label>
          <button className="button button-blue" disabled={busy}>
            {busy ? "Saving…" : "Save ownership and action"}
          </button>
        </form>
      )}
      <button className="inline-button" onClick={openCompany}>
        View related company records
      </button>
      {company && (
        <div className="history">
          <h4>{company.name}</h4>
          <p>Verification: {company.verification_status}</p>
          <h4>Contacts in your team records</h4>
          {company.contacts.map((contact) => (
            <p key={contact.id}>
              {contact.name} · {contact.email}
            </p>
          ))}
          <h4>Related inquiries</h4>
          {company.inquiries.map((record) => (
            <p key={record.id}>
              <button
                className="inline-button"
                onClick={() => onOpen(record.id)}
              >
                {record.reference}
              </button>{" "}
              · {record.status}
            </p>
          ))}
          <h4>Tasks</h4>
          {company.tasks.length ? (
            company.tasks.map((task) => (
              <p key={task.id}>
                {task.title} · {task.due_date} · {task.status}
              </p>
            ))
          ) : (
            <p>No tasks recorded.</p>
          )}
        </div>
      )}
    </section>
  );
}

export function OperationsReports({ session, refreshKey, onOpen }) {
  const today = new Date().toISOString().slice(0, 10);
  const [dates, setDates] = useState({
    start: today.slice(0, 8) + "01",
    end: today,
  });
  const [report, setReport] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams(dates).toString();
  async function refresh(event) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const [data, due] = await Promise.all([
        api(`/admin/reports?${query}`),
        api("/admin/reminders"),
      ]);
      setReport(data);
      setReminders(due);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    refresh();
  }, [refreshKey]);
  return (
    <section className="admin-tools">
      <SectionHead
        eyebrow="OPERATIONS"
        title="Follow-ups and reports"
        text="Due tasks use the current UTC date. Reports use the selected creation dates and each record's current status."
      />
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <h3>Due and overdue tasks</h3>
      {reminders.length ? (
        <div className="reminder-grid">
          {reminders.map((task) => (
            <button
              className="inbox-item"
              key={task.id}
              onClick={() => onOpen(task.inquiry_id)}
            >
              <span>
                {task.due_date < today ? "OVERDUE" : "DUE TODAY"} ·{" "}
                {task.priority}
              </span>
              <b>{task.title}</b>
              <small>
                {task.reference} · {task.company_name} · {task.due_date}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <p>No pending tasks are due today.</p>
      )}
      <form className="quote-actions" onSubmit={refresh}>
        <label>
          From (UTC)
          <input
            type="date"
            required
            value={dates.start}
            onChange={(event) =>
              setDates({ ...dates, start: event.target.value })
            }
          />
        </label>
        <label>
          To (UTC)
          <input
            type="date"
            required
            value={dates.end}
            onChange={(event) =>
              setDates({ ...dates, end: event.target.value })
            }
          />
        </label>
        <button className="ghost-button" disabled={busy}>
          {busy ? "Loading…" : "Refresh report"}
        </button>
      </form>
      {report && (
        <>
          <p>
            {report.inquiries} inquiries created {report.period_start} through{" "}
            {report.period_end}.
          </p>
          <p className="muted">{report.basis}</p>
          <div className="report-grid">
            <div>
              <h3>Pipeline counts</h3>
              {report.stage_counts.length ? (
                report.stage_counts.map((row) => (
                  <p key={`${row.kind}-${row.stage}`}>
                    {row.kind} / {row.stage.replaceAll("_", " ")}{" "}
                    <b>{row.count}</b>
                  </p>
                ))
              ) : (
                <p>No records in this period.</p>
              )}
            </div>
            <div>
              <h3>Assigned inquiries</h3>
              {report.owners.map((row) => (
                <p key={row.email}>
                  {row.email} <b>{row.inquiries}</b>
                </p>
              ))}
            </div>
          </div>
          {session.role !== "procurement" && (
            <>
              <h3>Quotation values by currency</h3>
              {report.quote_values.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Currency</th>
                        <th>Current status</th>
                        <th>Quotes</th>
                        <th>Quoted value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.quote_values.map((row) => (
                        <tr key={`${row.currency}-${row.status}`}>
                          <td>{row.currency}</td>
                          <td><StatusTag value={row.status} /></td>
                          <td>{row.count}</td>
                          <td>{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No quotations in this period.</p>
              )}
              <p className="muted">
                Forecast, contract, payment and revenue metrics require their
                own approved records and calculation policy.
              </p>
            </>
          )}
          <a
            className="ghost-button download-link"
            href={`/api/admin/reports/inquiries.csv?${new URLSearchParams({ start: report.period_start, end: report.period_end })}`}
          >
            Export this inquiry period as CSV
          </a>
        </>
      )}
    </section>
  );
}
