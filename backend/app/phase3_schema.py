"""Additive, version-recorded schema for the selected Phase 3 package."""


def migrate(db):
    db.executescript("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY, applied_at TEXT NOT NULL
        );
        BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS shipments (
            id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE,
            quote_id TEXT NOT NULL REFERENCES quotes(id), quote_revision_id TEXT NOT NULL REFERENCES quote_revisions(id),
            company_id TEXT NOT NULL REFERENCES companies(id), status TEXT NOT NULL DEFAULT 'planned',
            version INTEGER NOT NULL DEFAULT 1, carrier TEXT NOT NULL DEFAULT '', tracking_reference TEXT NOT NULL DEFAULT '',
            origin TEXT NOT NULL, destination TEXT NOT NULL, expected_delivery_date TEXT,
            portal_visible INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL REFERENCES staff(id),
            create_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_shipments_company ON shipments(company_id, portal_visible);
        CREATE TABLE IF NOT EXISTS shipment_events (
            id TEXT PRIMARY KEY, shipment_id TEXT NOT NULL REFERENCES shipments(id), version INTEGER NOT NULL,
            action TEXT NOT NULL, old_status TEXT NOT NULL, new_status TEXT NOT NULL,
            reason TEXT NOT NULL, evidence_reference TEXT NOT NULL DEFAULT '', customer_note TEXT NOT NULL DEFAULT '',
            occurred_at TEXT NOT NULL, staff_id TEXT NOT NULL REFERENCES staff(id), recorded_at TEXT NOT NULL,
            command_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL, UNIQUE(shipment_id, version)
        );
        CREATE TABLE IF NOT EXISTS integration_profiles (
            id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
            purpose TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES staff(id), contract_notes TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
            created_by TEXT NOT NULL REFERENCES staff(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS integration_jobs (
            id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES integration_profiles(id),
            shipment_id TEXT NOT NULL REFERENCES shipments(id), shipment_version INTEGER NOT NULL,
            payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
            attempts INTEGER NOT NULL DEFAULT 0, cycle_attempts INTEGER NOT NULL DEFAULT 0,
            next_attempt_at TEXT NOT NULL, lease_token TEXT, lease_expires_at TEXT,
            last_error TEXT NOT NULL DEFAULT '', external_id TEXT, acknowledged_at TEXT,
            reconciliation_status TEXT NOT NULL DEFAULT 'not_checked', queued_by TEXT NOT NULL REFERENCES staff(id),
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(profile_id, shipment_id, shipment_version)
        );
        CREATE INDEX IF NOT EXISTS ix_integration_jobs_due ON integration_jobs(status, next_attempt_at);
        CREATE TABLE IF NOT EXISTS integration_attempts (
            id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES integration_jobs(id), attempt INTEGER NOT NULL,
            outcome TEXT NOT NULL DEFAULT 'processing', error_code TEXT NOT NULL DEFAULT '',
            started_at TEXT NOT NULL, completed_at TEXT, UNIQUE(job_id, attempt)
        );
        CREATE TABLE IF NOT EXISTS integration_events (
            id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES integration_profiles(id),
            job_id TEXT REFERENCES integration_jobs(id), staff_id TEXT NOT NULL REFERENCES staff(id),
            action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS integration_reconciliations (
            id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES integration_jobs(id),
            remote_version INTEGER NOT NULL, remote_status TEXT NOT NULL, external_id TEXT NOT NULL,
            evidence_reference TEXT NOT NULL, result TEXT NOT NULL, staff_id TEXT NOT NULL REFERENCES staff(id), created_at TEXT NOT NULL
        );
        INSERT OR IGNORE INTO schema_migrations VALUES ('0003_shipments_integrations', strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
        COMMIT;
    """)
