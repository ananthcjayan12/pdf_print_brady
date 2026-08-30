#!/usr/bin/env python3
"""Import a packaged production JSON database as sanitized local SQLite mock data."""

import argparse
import io
import json
import os
import zipfile

from storage import SQLiteStorage


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TARGET = os.path.join(SCRIPT_DIR, "uploads", "brady.sqlite3")


def find_database_member(archive):
    candidates = [
        name for name in archive.namelist()
        if name.replace("\\", "/").endswith("/uploads/db.json")
    ]
    if not candidates:
        raise FileNotFoundError("The archive does not contain uploads/db.json")
    return min(candidates, key=len)


def sanitize(data, upload_folder):
    documents = data.get("documents", {})
    for document in documents.values():
        stored_path = str(document.get("path") or "").replace("\\", "/")
        filename = os.path.basename(stored_path) or document.get("name", "")
        document["path"] = os.path.join(upload_folder, filename)

    usernames = sorted({
        job.get("username")
        for job in data.get("print_jobs", [])
        if job.get("username") and job.get("username") != "Unknown"
    })
    aliases = {username: f"Operator-{index + 1}" for index, username in enumerate(usernames)}
    for job in data.get("print_jobs", []):
        username = job.get("username")
        if username in aliases:
            job["username"] = aliases[username]

    data["users"] = [{
        "username": "admin",
        "password": "admin",
        "role": "admin",
    }]
    return data


def import_mock(archive_path, target_path, replace=False):
    if os.path.exists(target_path) and not replace:
        raise FileExistsError(
            f"Target already exists: {target_path}. Pass --replace to overwrite it."
        )

    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with zipfile.ZipFile(archive_path) as archive:
        member = find_database_member(archive)
        with archive.open(member) as raw:
            with io.TextIOWrapper(raw, encoding="utf-8") as text:
                data = json.load(text)

    data = sanitize(data, os.path.dirname(target_path))
    storage = SQLiteStorage(target_path)
    storage.replace_all(data, source="sanitized-production-mock")
    counts = storage.counts()
    storage.close()
    return counts


def main():
    parser = argparse.ArgumentParser(
        description="Import sanitized production metadata/history into local SQLite."
    )
    parser.add_argument("archive", help="Path to the packaged production ZIP archive")
    parser.add_argument("--target", default=DEFAULT_TARGET, help="SQLite output path")
    parser.add_argument("--replace", action="store_true", help="Replace an existing target")
    args = parser.parse_args()

    counts = import_mock(
        os.path.abspath(args.archive),
        os.path.abspath(args.target),
        replace=args.replace,
    )
    print(json.dumps({"target": os.path.abspath(args.target), **counts}, indent=2))


if __name__ == "__main__":
    main()
