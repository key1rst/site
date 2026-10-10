import React, { useEffect, useState } from "react";
import { api, SectionHead } from "./shared";

const statuses = [
  "planned",
  "booked",
  "dispatched",
  "in_transit",
  "exception",
  "delivered",
  "cancelled",
];
const blank = {
  slug: "",
  name: "",
  purpose: "logistics",
  owner_id: "",
  contract_notes: "",
};
const csrf = (session) => ({ "X-CSRF-Token": session.csrf_token });

export function IntegrationWorkbench({ session }) {
  const [profiles, setProfiles] = useState([]);
  const [owners, setOwners] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [create, setCreate] = useState(blank);
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [shipmentId, setShipmentId] = useState("");
  const [queueReason, setQueueReason] = useState("");
  const [controlReason, setControlReason] = useState("");
  const [approved, setApproved] = useState(false);
  const [jobReason, setJobReason] = useState("");
  const [reconcile, setReconcile] = useState({
    remote_version: "",
    remote_status: "",
    external_id: "",
    evidence_reference: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [p, o, s] = await Promise.all([
      api("/admin/integrations"),
      api("/admin/owners"),
      api("/admin/shipments"),
    ]);
    setProfiles(p);
    setOwners(o);
    setShipments(s);
    if (profile) setProfile(p.find((row) => row.id === profile.id) || null);
  }
  useEffect(() => {
    refresh().catch((failure) => setError(failure.message));
  }, []);
  async function openProfile(row) {
    setError("");
    setProfile(row);
    setSelectedJob(null);
    setShipmentId("");
    setHistory([]);
    setJobs([]);
    try {
      const [jobRows, audit] = await Promise.all([
        api(`/admin/integrations/jobs?profile_id=${row.id}`),
        api(`/admin/integrations/${row.id}/history`),
      ]);
      setJobs(jobRows);
      setHistory(audit);
    } catch (failure) {
      setError(failure.message);
    }
  }
  async function createProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api("/admin/integrations", {
        method: "POST",
        headers: csrf(session),
        body: JSON.stringify(create),
      });
      setCreate(blank);
      await refresh();
      await openProfile(row);
      setNotice("Profile created paused. Delivery remains disabled.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function control() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api(`/admin/integrations/${profile.id}/control`, {
        method: "POST",
        headers: csrf(session),
        body: JSON.stringify({
          expected_version: profile.version,
          enabled: !profile.enabled,
          contract_approved: approved,
          reason: controlReason,
        }),
      });
      setApproved(false);
      setControlReason("");
      await refresh();
      await openProfile(row);
      setNotice(
        row.enabled
          ? "Profile enabled. The separate worker still requires an explicit --send invocation."
          : "Profile paused. Queued jobs remain available for review.",
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function openJob(id) {
    setError("");
    try {
      const job = await api(`/admin/integrations/jobs/${id}`);
      setSelectedJob(job);
      setReconcile({
        remote_version: job.payload.shipment.version,
        remote_status: job.payload.shipment.status,
        external_id: job.external_id || "",
        evidence_reference: "",
      });
      setJobReason("");
    } catch (failure) {
      setError(failure.message);
    }
  }
  async function refreshProfile() {
    try {
      await refresh();
      if (profile) {
        const [rows, audit] = await Promise.all([
          api(`/admin/integrations/jobs?profile_id=${profile.id}`),
          api(`/admin/integrations/${profile.id}/history`),
        ]);
        setJobs(rows);
        setHistory(audit);
        if (selectedJob) await openJob(selectedJob.id);
      }
    } catch (failure) {
      setError(failure.message);
    }
  }
  async function queue(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const shipment = shipments.find((row) => row.id === shipmentId);
    try {
      if (!shipment) throw new Error("Select a shipment.");
      const job = await api(`/admin/integrations/${profile.id}/queue`, {
        method: "POST",
        headers: csrf(session),
        body: JSON.stringify({
          shipment_id: shipment.id,
          expected_version: shipment.version,
          reason: queueReason,
        }),
      });
      setQueueReason("");
      await refreshProfile();
      await openJob(job.id);
      setNotice(
        "The exact shipment snapshot is queued. Review its fields before any external delivery.",
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function jobAction(action) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/admin/integrations/jobs/${selectedJob.id}/${action}`, {
        method: "POST",
        headers: csrf(session),
        body: JSON.stringify({ reason: jobReason }),
      });
      await refreshProfile();
      setNotice(`Job ${action} recorded with an audit reason.`);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function recordReconciliation(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api(
        `/admin/integrations/jobs/${selectedJob.id}/reconcile`,
        {
          method: "POST",
          headers: csrf(session),
          body: JSON.stringify({
            ...reconcile,
            remote_version: Number(reconcile.remote_version),
          }),
        },
      );
      await refreshProfile();
      setNotice(
        `Reconciliation ${result.result}. Mismatches remain visible for staff review.`,
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-tools" id="integrations">
      <SectionHead
        eyebrow="PHASE 3 INTEGRATIONS"
        title="Reviewed outbound exchange"
        text="Admin-controlled shipment.changed.v1 snapshots. No ERP, logistics, BI, or payment connection is active by default."
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
              setProfile(null);
              setSelectedJob(null);
            }}
          >
            + New destination
          </button>
          {profiles.map((row) => (
            <button
              className={`inbox-item ${profile?.id === row.id ? "active" : ""}`}
              key={row.id}
              onClick={() => openProfile(row)}
            >
              <span>
                {row.enabled ? "ENABLED" : "PAUSED"} ·{" "}
                {row.configured ? "CONFIGURED" : "NO HTTPS CONFIG"}
              </span>
              <b>{row.name}</b>
              <small>
                {row.slug} · {row.purpose}
              </small>
            </button>
          ))}
        </div>
        <div className="inquiry-detail">
          {!profile ? (
            <form className="quote-form" onSubmit={createProfile}>
              <h3>Register a destination</h3>
              <label>
                Stable slug
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength="50"
                  value={create.slug}
                  onChange={(e) =>
                    setCreate({ ...create, slug: e.target.value })
                  }
                />
              </label>
              <label>
                Display name
                <input
                  required
                  maxLength="160"
                  value={create.name}
                  onChange={(e) =>
                    setCreate({ ...create, name: e.target.value })
                  }
                />
              </label>
              <label>
                Purpose
                <select
                  value={create.purpose}
                  onChange={(e) =>
                    setCreate({ ...create, purpose: e.target.value })
                  }
                >
                  <option value="logistics">Logistics</option>
                  <option value="erp">ERP</option>
                  <option value="bi">Business intelligence</option>
                </select>
              </label>
              <label>
                Business owner
                <select
                  required
                  value={create.owner_id}
                  onChange={(e) =>
                    setCreate({ ...create, owner_id: e.target.value })
                  }
                >
                  <option value="">Select owner</option>
                  {owners.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Contract and reconciliation notes
                <textarea
                  required
                  minLength="10"
                  maxLength="2000"
                  rows="3"
                  value={create.contract_notes}
                  onChange={(e) =>
                    setCreate({ ...create, contract_notes: e.target.value })
                  }
                />
              </label>
              <button className="button" disabled={busy}>
                Create paused profile
              </button>
            </form>
          ) : (
            <>
              <h3>{profile.name}</h3>
              <p>
                {profile.purpose} · owner {profile.owner_email} ·{" "}
                {profile.enabled ? "enabled" : "paused"}
              </p>
              <p>
                Schema: {profile.contract}. Environment prefix:{" "}
                <code>{profile.environment_prefix}</code>. HTTPS credentials:{" "}
                {profile.configured ? "configured" : "missing or invalid"}.
              </p>
              <p className="muted">{profile.contract_notes}</p>
              <div className="quote-form">
                <h4>Delivery control</h4>
                {!profile.enabled && (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={approved}
                      onChange={(e) => setApproved(e.target.checked)}
                    />
                    I reviewed this exact outbound field contract and receiver
                    deduplication behavior.
                  </label>
                )}
                <label>
                  Reason
                  <input
                    required
                    minLength="5"
                    maxLength="1000"
                    value={controlReason}
                    onChange={(e) => setControlReason(e.target.value)}
                  />
                </label>
                <button
                  className="ghost-button"
                  disabled={
                    busy ||
                    controlReason.trim().length < 5 ||
                    (!profile.enabled && (!approved || !profile.configured))
                  }
                  onClick={control}
                >
                  {profile.enabled
                    ? "Pause destination"
                    : "Enable reviewed destination"}
                </button>
                <p className="muted">
                  A separate operator runs the HTTPS worker explicitly. Pausing
                  prevents new claims; an already started HTTP call may finish.
                </p>
              </div>
              <form className="quote-form" onSubmit={queue}>
                <h4>Queue a reviewed shipment snapshot</h4>
                <label>
                  Shipment
                  <select
                    required
                    value={shipmentId}
                    onChange={(e) => setShipmentId(e.target.value)}
                  >
                    <option value="">Select booked or later shipment</option>
                    {shipments
                      .filter((row) => row.status !== "planned")
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.reference} · v{row.version} · {row.status}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Queue reason
                  <input
                    required
                    minLength="5"
                    maxLength="1000"
                    value={queueReason}
                    onChange={(e) => setQueueReason(e.target.value)}
                  />
                </label>
                <button className="ghost-button" disabled={busy}>
                  Queue immutable snapshot
                </button>
              </form>
              <div className="quote-actions">
                <h4>Jobs</h4>
                <button className="inline-button" onClick={refreshProfile}>
                  Refresh jobs and history
                </button>
              </div>
              {jobs.length ? (
                <div className="inbox-list">
                  {jobs.map((job) => (
                    <button
                      className={`inbox-item ${selectedJob?.id === job.id ? "active" : ""}`}
                      key={job.id}
                      onClick={() => openJob(job.id)}
                    >
                      <span>
                        {job.status.replaceAll("_", " ").toUpperCase()} ·
                        reconciliation {job.reconciliation_status}
                      </span>
                      <b>
                        {job.shipment_reference} · v{job.shipment_version}
                      </b>
                      <small>
                        Attempts {job.attempts} ·{" "}
                        {job.last_error || "No delivery error"}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <p>No jobs queued for this destination.</p>
              )}
              {selectedJob && (
                <div className="quote-form">
                  <h4>Reviewed payload</h4>
                  <pre className="payload-preview">
                    {JSON.stringify(selectedJob.payload, null, 2)}
                  </pre>
                  <p>
                    Status: {selectedJob.status} · external ID:{" "}
                    {selectedJob.external_id || "None"} · reconciliation:{" "}
                    {selectedJob.reconciliation_status}
                  </p>
                  <div className="history">
                    {selectedJob.attempt_history.map((attempt) => (
                      <p key={attempt.attempt}>
                        Attempt {attempt.attempt}: {attempt.outcome} ·{" "}
                        {attempt.error_code || "No error"}
                      </p>
                    ))}
                  </div>
                  {[
                    "retry_wait",
                    "dead_letter",
                    "queued",
                    "reconciliation_required",
                  ].includes(selectedJob.status) && (
                    <>
                      <label>
                        Reason for retry or cancellation
                        <input
                          minLength="5"
                          maxLength="1000"
                          value={jobReason}
                          onChange={(e) => setJobReason(e.target.value)}
                        />
                      </label>
                      <div className="quote-actions">
                        {["retry_wait", "dead_letter"].includes(
                          selectedJob.status,
                        ) && (
                          <button
                            className="ghost-button"
                            disabled={busy || jobReason.trim().length < 5}
                            onClick={() => jobAction("retry")}
                          >
                            Retry
                          </button>
                        )}
                        {[
                          "queued",
                          "retry_wait",
                          "dead_letter",
                          "reconciliation_required",
                        ].includes(selectedJob.status) && (
                          <button
                            className="ghost-button"
                            disabled={busy || jobReason.trim().length < 5}
                            onClick={() => jobAction("cancel")}
                          >
                            Cancel locally
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {["sent", "reconciliation_required"].includes(
                    selectedJob.status,
                  ) && (
                    <form onSubmit={recordReconciliation}>
                      <h4>Record observed receiver state</h4>
                      <div className="form-grid">
                        <label>
                          Remote version
                          <input
                            required
                            type="number"
                            min="1"
                            value={reconcile.remote_version}
                            onChange={(e) =>
                              setReconcile({
                                ...reconcile,
                                remote_version: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Remote status
                          <select
                            value={reconcile.remote_status}
                            onChange={(e) =>
                              setReconcile({
                                ...reconcile,
                                remote_status: e.target.value,
                              })
                            }
                          >
                            {statuses.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label>
                        Remote record ID
                        <input
                          required
                          maxLength="160"
                          value={reconcile.external_id}
                          onChange={(e) =>
                            setReconcile({
                              ...reconcile,
                              external_id: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Evidence reference
                        <input
                          required
                          minLength="3"
                          maxLength="500"
                          value={reconcile.evidence_reference}
                          onChange={(e) =>
                            setReconcile({
                              ...reconcile,
                              evidence_reference: e.target.value,
                            })
                          }
                        />
                      </label>
                      <button className="ghost-button" disabled={busy}>
                        Compare and record reconciliation
                      </button>
                    </form>
                  )}
                  {selectedJob.reconciliations.map((row, index) => (
                    <p key={index}>
                      {row.result} · v{row.remote_version} · {row.remote_status}{" "}
                      · {row.evidence_reference}
                    </p>
                  ))}
                </div>
              )}
              <h4>Destination audit</h4>
              <div className="history">
                {history.map((row, index) => (
                  <p key={index}>
                    {row.action.replaceAll("_", " ")} · {row.actor}
                    <small>{new Date(row.created_at).toLocaleString()}</small>
                    {row.detail}
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
