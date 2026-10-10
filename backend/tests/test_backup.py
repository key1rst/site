"""Backup and isolated restore preserve database records and private uploads."""

import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend import backup
from backend.app import main


@pytest.fixture
def source(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "source.sqlite3")
    monkeypatch.setattr(main, "FILE_PATH", tmp_path / "private-uploads")
    main.initialize()
    with TestClient(main.app) as client:
        response = client.post("/api/inquiries", headers={"Idempotency-Key": "backup-offer"}, json={
            "kind": "sell", "company_name": "Backup Supplier", "contact_name": "Supplier Contact",
            "email": "backup@example.test", "product_text": "Test oil", "quantity": "3", "unit": "MT",
            "origin": "Test origin", "privacy_accepted": True,
        })
        assert response.status_code == 201, response.text
        intake = response.json()
        uploaded = client.post(f"/api/inquiries/{intake['reference']}/documents", headers={
            "X-Upload-Token": intake["upload_token"], "X-Filename": "test.png",
        }, content=b"\x89PNG\r\n\x1a\nbackup-test-document")
        assert uploaded.status_code == 201, uploaded.text
    return main.DB_PATH, main.FILE_PATH, intake["reference"]


def test_backup_restore_preserves_record_and_private_document(source, tmp_path):
    db_path, uploads, reference = source
    backup_path = tmp_path / "snapshot"
    result = backup.create_backup(db_path, uploads, backup_path)
    assert result["verified"] and result["documents"] == 1
    assert backup.verify_backup(backup_path)["documents"] == 1

    restored_path = tmp_path / "restored"
    assert backup.restore_backup(backup_path, restored_path)["verified"]
    with sqlite3.connect(restored_path / "database.sqlite3") as db:
        assert db.execute("SELECT count(*) FROM inquiries WHERE reference = ?", (reference,)).fetchone()[0] == 1
        document = db.execute("SELECT storage_name, scan_status FROM documents").fetchone()
        assert document[1] == "unscanned"
        assert (restored_path / "uploads" / document[0]).read_bytes().startswith(b"\x89PNG")
    assert backup.verify_backup(restored_path)["documents"] == 1
    with pytest.raises(backup.BackupError, match="already exists"):
        backup.restore_backup(backup_path, restored_path)


def test_backup_detects_missing_or_changed_private_document(source, tmp_path):
    db_path, uploads, _reference = source
    snapshot = tmp_path / "snapshot"
    backup.create_backup(db_path, uploads, snapshot)
    copied = next((snapshot / "uploads").iterdir())
    copied.write_bytes(b"tampered document")
    with pytest.raises(backup.BackupError, match="integrity check failed"):
        backup.verify_backup(snapshot)
    with pytest.raises(backup.BackupError):
        backup.restore_backup(snapshot, tmp_path / "restored")
    assert not (tmp_path / "restored").exists()

    original = next(uploads.iterdir())
    original.unlink()
    with pytest.raises(backup.BackupError, match="Referenced upload is missing"):
        backup.create_backup(db_path, uploads, tmp_path / "incomplete")
    assert not (tmp_path / "incomplete" / "manifest.json").exists()


def test_backup_rejects_unexpected_files_and_invalid_database(source, tmp_path):
    db_path, uploads, _reference = source
    snapshot = tmp_path / "snapshot"
    backup.create_backup(db_path, uploads, snapshot)
    (snapshot / "uploads" / "extra.txt").write_text("unexpected")
    with pytest.raises(backup.BackupError, match="Upload directory"):
        backup.verify_backup(snapshot)
    (snapshot / "uploads" / "extra.txt").unlink()
    (snapshot / "database.sqlite3").write_bytes(b"invalid database")
    with pytest.raises(backup.BackupError, match="Database snapshot"):
        backup.verify_backup(snapshot)
