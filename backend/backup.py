"""Create and verify a portable, integrity-checked SQLite and upload snapshot.

Restoration always targets a new directory. Never restore over a running app.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


STORAGE_NAME = re.compile(r"^[0-9a-f-]{36}\.(?:pdf|png|jpg)$")
FORMAT_VERSION = 1
CHUNK_SIZE = 1024 * 1024


class BackupError(Exception):
    pass


def digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(CHUNK_SIZE), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def file_info(path: Path) -> dict:
    return {"bytes": path.stat().st_size, "sha256": digest(path)}


def safe_storage_name(name: str) -> bool:
    return bool(STORAGE_NAME.fullmatch(name)) and Path(name).name == name


def check_database(path: Path) -> list[dict]:
    if not path.is_file() or path.is_symlink():
        raise BackupError("Database snapshot is missing or is a symbolic link")
    try:
        connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        try:
            if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise BackupError("Database integrity check failed")
            if connection.execute("PRAGMA foreign_key_check").fetchone():
                raise BackupError("Database foreign key check failed")
            rows = connection.execute("SELECT storage_name, bytes FROM documents ORDER BY storage_name").fetchall()
        finally:
            connection.close()
    except sqlite3.DatabaseError as exc:
        raise BackupError("Database snapshot cannot be read") from exc
    names = [row["storage_name"] for row in rows]
    if len(names) != len(set(names)) or any(not safe_storage_name(name) for name in names):
        raise BackupError("Database contains duplicate or unsafe upload storage names")
    return [dict(row) for row in rows]


def empty_destination(path: Path) -> None:
    if path.exists() or path.is_symlink():
        raise BackupError("Destination already exists; choose a new directory")
    if not path.parent.is_dir():
        raise BackupError("Destination parent directory does not exist")


def create_backup(db_path: Path, upload_path: Path, destination: Path) -> dict:
    if not db_path.is_file() or db_path.is_symlink():
        raise BackupError("Source database does not exist or is a symbolic link")
    empty_destination(destination)
    destination.mkdir(mode=0o700)
    uploads = destination / "uploads"
    uploads.mkdir(mode=0o700)
    snapshot = destination / "database.sqlite3"
    try:
        with sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True) as source:
            with sqlite3.connect(snapshot) as target:
                source.backup(target)
        documents = check_database(snapshot)
        files = {}
        for row in documents:
            name = row["storage_name"]
            source_file = upload_path / name
            if not source_file.is_file() or source_file.is_symlink():
                raise BackupError(f"Referenced upload is missing or unsafe: {name}")
            target_file = uploads / name
            shutil.copyfile(source_file, target_file)
            details = file_info(target_file)
            if details["bytes"] != row["bytes"] or file_info(source_file) != details:
                raise BackupError(f"Referenced upload changed during backup: {name}")
            files[name] = details
        manifest = {"format": FORMAT_VERSION, "created_at": datetime.now(timezone.utc).isoformat(),
                    "database": file_info(snapshot), "uploads": files}
        (destination / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        verify_backup(destination)
        return {"destination": str(destination), "documents": len(files), "verified": True}
    except Exception:
        # Keep the incomplete directory visible for investigation; it has no valid manifest.
        (destination / "manifest.json").unlink(missing_ok=True)
        raise


def verify_backup(backup: Path) -> dict:
    manifest_path = backup / "manifest.json"
    if not backup.is_dir() or backup.is_symlink() or not manifest_path.is_file() or manifest_path.is_symlink():
        raise BackupError("Backup directory or manifest is missing or unsafe")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise BackupError("Backup manifest cannot be read") from exc
    if not isinstance(manifest, dict) or manifest.get("format") != FORMAT_VERSION:
        raise BackupError("Unsupported backup format")
    if set(manifest) != {"format", "created_at", "database", "uploads"} or not isinstance(manifest["uploads"], dict):
        raise BackupError("Backup manifest has an invalid shape")
    snapshot = backup / "database.sqlite3"
    if snapshot.is_symlink() or not snapshot.is_file() or file_info(snapshot) != manifest["database"]:
        raise BackupError("Database snapshot does not match its manifest")
    documents = check_database(snapshot)
    expected = {row["storage_name"]: row["bytes"] for row in documents}
    if set(manifest["uploads"]) != set(expected):
        raise BackupError("Upload list does not match database references")
    uploads = backup / "uploads"
    if not uploads.is_dir() or uploads.is_symlink() or {path.name for path in uploads.iterdir()} != set(expected):
        raise BackupError("Upload directory does not match the manifest")
    for name, expected_size in expected.items():
        path = uploads / name
        if not safe_storage_name(name) or path.is_symlink() or not path.is_file():
            raise BackupError(f"Unsafe or missing upload: {name}")
        details = file_info(path)
        if details["bytes"] != expected_size or details != manifest["uploads"][name]:
            raise BackupError(f"Upload integrity check failed: {name}")
    return {"backup": str(backup), "documents": len(expected), "verified": True}


def restore_backup(backup: Path, destination: Path) -> dict:
    checked = verify_backup(backup)
    empty_destination(destination)
    destination.mkdir(mode=0o700)
    (destination / "uploads").mkdir(mode=0o700)
    shutil.copyfile(backup / "database.sqlite3", destination / "database.sqlite3")
    for name in json.loads((backup / "manifest.json").read_text(encoding="utf-8"))["uploads"]:
        shutil.copyfile(backup / "uploads" / name, destination / "uploads" / name)
    shutil.copyfile(backup / "manifest.json", destination / "manifest.json")
    verify_backup(destination)
    return {"destination": str(destination), "documents": checked["documents"], "verified": True}


def main() -> int:
    parser = argparse.ArgumentParser(description="Create, verify, or restore an isolated platform backup")
    sub = parser.add_subparsers(dest="action", required=True)
    create = sub.add_parser("create")
    create.add_argument("--db", type=Path, required=True)
    create.add_argument("--uploads", type=Path, required=True)
    create.add_argument("--dest", type=Path, required=True)
    verify = sub.add_parser("verify")
    verify.add_argument("--backup", type=Path, required=True)
    restore = sub.add_parser("restore")
    restore.add_argument("--backup", type=Path, required=True)
    restore.add_argument("--dest", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.action == "create":
            result = create_backup(args.db, args.uploads, args.dest)
        elif args.action == "verify":
            result = verify_backup(args.backup)
        else:
            result = restore_backup(args.backup, args.dest)
    except (BackupError, OSError) as exc:
        print(f"Backup error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
