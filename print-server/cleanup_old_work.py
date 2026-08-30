#!/usr/bin/env python3
"""Remove uploaded work older than the retention window.

This cleans the local SQLite database and upload directory together:
- documents older than the cutoff
- barcode mappings that reference removed/missing documents
- print jobs older than the cutoff or tied to removed documents
- orphan PDF files in uploads/ older than the cutoff

Users are intentionally preserved.
"""

import argparse
import datetime as dt
import json
import os

from storage import SQLiteStorage


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_UPLOAD_FOLDER = os.path.join(SCRIPT_DIR, "uploads")
DB_FILENAME = "brady.sqlite3"
LEGACY_DB_FILENAME = "db.json"


def parse_timestamp(value):
    if not value:
        return None

    text = str(value).strip()
    if not text:
        return None

    try:
        return dt.datetime.fromisoformat(text)
    except ValueError:
        try:
            return dt.datetime.strptime(text, "%Y-%m-%d")
        except ValueError:
            return None


def resolve_upload_path(upload_folder, value):
    if not value:
        return None
    if os.path.isabs(value) and os.path.exists(value):
        return value
    filename = os.path.basename(str(value).replace("\\", "/"))
    return os.path.abspath(os.path.join(upload_folder, filename))


def remove_file(path, dry_run):
    if not path or not os.path.exists(path) or not os.path.isfile(path):
        return False
    if not dry_run:
        os.remove(path)
    return True


def cleanup(upload_folder, days, dry_run):
    upload_folder = os.path.abspath(upload_folder)
    db_path = os.path.join(upload_folder, DB_FILENAME)
    legacy_db_path = os.path.join(upload_folder, LEGACY_DB_FILENAME)
    cutoff = dt.datetime.now() - dt.timedelta(days=days)

    storage = SQLiteStorage(db_path)
    if storage.is_empty() and os.path.exists(legacy_db_path):
        storage.import_legacy_json(legacy_db_path)
    data = storage.load_all()
    if not data.get("documents") and not data.get("print_jobs"):
        raise FileNotFoundError(f"Database is empty: {db_path}")

    documents = data.get("documents", {})
    mappings = data.get("mappings", {})
    print_jobs = data.get("print_jobs", [])

    removed_doc_ids = set()
    removed_doc_paths = set()
    kept_documents = {}

    for doc_id, doc in documents.items():
        uploaded_at = parse_timestamp(doc.get("uploaded_at"))
        should_remove = uploaded_at is not None and uploaded_at < cutoff

        if should_remove:
            removed_doc_ids.add(doc_id)
            path = resolve_upload_path(upload_folder, doc.get("path"))
            if path:
                removed_doc_paths.add(path)
        else:
            kept_documents[doc_id] = doc

    kept_doc_ids = set(kept_documents.keys())
    retained_paths = {
        resolve_upload_path(upload_folder, doc.get("path"))
        for doc in kept_documents.values()
        if doc.get("path")
    }

    deleted_files = []
    for path in sorted(removed_doc_paths - retained_paths):
        if remove_file(path, dry_run):
            deleted_files.append(path)

    kept_mappings = {
        barcode: mapping
        for barcode, mapping in mappings.items()
        if mapping.get("file_id") in kept_doc_ids
    }

    kept_print_jobs = []
    removed_print_jobs = 0
    for job in print_jobs:
        timestamp = parse_timestamp(job.get("timestamp"))
        is_old = timestamp is not None and timestamp < cutoff
        references_removed_doc = job.get("file_id") in removed_doc_ids
        references_missing_doc = job.get("file_id") and job.get("file_id") not in kept_doc_ids

        if is_old or references_removed_doc or references_missing_doc:
            removed_print_jobs += 1
            continue
        kept_print_jobs.append(job)

    upload_events = data.get("upload_events", [])
    kept_upload_events = [
        event for event in upload_events
        if event.get("file_id") in kept_doc_ids
    ]

    orphan_files = []
    for filename in os.listdir(upload_folder):
        path = os.path.join(upload_folder, filename)
        if (
            filename == LEGACY_DB_FILENAME
            or filename.startswith(DB_FILENAME)
            or not os.path.isfile(path)
        ):
            continue
        if os.path.abspath(path) in retained_paths:
            continue

        modified_at = dt.datetime.fromtimestamp(os.path.getmtime(path))
        if modified_at < cutoff and remove_file(path, dry_run):
            orphan_files.append(path)

    updated = {
        **data,
        "documents": kept_documents,
        "mappings": kept_mappings,
        "print_jobs": kept_print_jobs,
        "upload_events": kept_upload_events,
    }

    if not dry_run:
        storage.replace_all(updated, source="retention-cleanup")

    return {
        "cutoff": cutoff.isoformat(timespec="seconds"),
        "removed_documents": len(removed_doc_ids),
        "removed_mappings": len(mappings) - len(kept_mappings),
        "removed_print_jobs": removed_print_jobs,
        "removed_upload_events": len(upload_events) - len(kept_upload_events),
        "deleted_document_files": len(deleted_files),
        "deleted_orphan_files": len(orphan_files),
        "dry_run": dry_run,
    }


def main():
    parser = argparse.ArgumentParser(description="Clean uploaded work older than the retention window.")
    parser.add_argument("--upload-folder", default=DEFAULT_UPLOAD_FOLDER, help="Folder containing db.json and uploaded PDFs.")
    parser.add_argument("--days", type=int, default=30, help="Retention window in days. Default: 30.")
    parser.add_argument("--dry-run", action="store_true", help="Report what would be removed without changing files.")
    args = parser.parse_args()

    if args.days <= 0:
        raise SystemExit("--days must be greater than 0")

    summary = cleanup(args.upload_folder, args.days, args.dry_run)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
