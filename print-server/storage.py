import json
import os
import sqlite3
import threading


class SQLiteStorage:
    """Incremental, indexed persistence for Brady Print Bridge data."""

    def __init__(self, path):
        self.path = path
        self._lock = threading.RLock()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.connection = sqlite3.connect(
            path,
            timeout=30,
            check_same_thread=False,
        )
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA synchronous=NORMAL")
        self.connection.execute("PRAGMA busy_timeout=30000")
        self._create_schema()

    def _create_schema(self):
        with self.connection:
            self.connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    uploaded_at TEXT,
                    file_hash TEXT,
                    payload TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at
                    ON documents(uploaded_at DESC);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_hash
                    ON documents(file_hash) WHERE file_hash IS NOT NULL;

                CREATE TABLE IF NOT EXISTS mappings (
                    barcode TEXT PRIMARY KEY,
                    file_id TEXT,
                    page_num INTEGER,
                    payload TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_mappings_file_page
                    ON mappings(file_id, page_num);

                CREATE TABLE IF NOT EXISTS print_jobs (
                    id TEXT PRIMARY KEY,
                    file_id TEXT,
                    page_num INTEGER,
                    status TEXT,
                    timestamp TEXT,
                    payload TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_print_jobs_timestamp
                    ON print_jobs(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_print_jobs_file_page_status
                    ON print_jobs(file_id, page_num, status);

                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    payload TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS upload_events (
                    id TEXT PRIMARY KEY,
                    file_id TEXT,
                    timestamp TEXT,
                    is_duplicate INTEGER NOT NULL DEFAULT 0,
                    payload TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_upload_events_timestamp
                    ON upload_events(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_upload_events_file_timestamp
                    ON upload_events(file_id, timestamp DESC);

                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
                """
            )

    @staticmethod
    def _json(value):
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False)

    @staticmethod
    def _decode_rows(rows):
        return [json.loads(row["payload"]) for row in rows]

    def is_empty(self):
        row = self.connection.execute(
            "SELECT NOT EXISTS(SELECT 1 FROM documents) "
            "AND NOT EXISTS(SELECT 1 FROM mappings) "
            "AND NOT EXISTS(SELECT 1 FROM print_jobs) "
            "AND NOT EXISTS(SELECT 1 FROM users) AS empty"
        ).fetchone()
        return bool(row["empty"])

    def load_all(self):
        with self._lock:
            document_rows = self.connection.execute(
                "SELECT id, payload FROM documents"
            ).fetchall()
            mapping_rows = self.connection.execute(
                "SELECT barcode, payload FROM mappings"
            ).fetchall()
            print_rows = self.connection.execute(
                "SELECT payload FROM print_jobs ORDER BY timestamp, rowid"
            ).fetchall()
            user_rows = self.connection.execute(
                "SELECT payload FROM users ORDER BY username"
            ).fetchall()
            event_rows = self.connection.execute(
                "SELECT payload FROM upload_events ORDER BY timestamp, rowid"
            ).fetchall()

        return {
            "documents": {
                row["id"]: json.loads(row["payload"])
                for row in document_rows
            },
            "mappings": {
                row["barcode"]: json.loads(row["payload"])
                for row in mapping_rows
            },
            "print_jobs": self._decode_rows(print_rows),
            "users": self._decode_rows(user_rows),
            "upload_events": self._decode_rows(event_rows),
        }

    def replace_all(self, data, source="snapshot"):
        documents = data.get("documents", {})
        mappings = data.get("mappings", {})
        print_jobs = data.get("print_jobs", [])
        users = data.get("users", [])
        upload_events = data.get("upload_events", [])

        with self._lock, self.connection:
            self.connection.execute("DELETE FROM mappings")
            self.connection.execute("DELETE FROM print_jobs")
            self.connection.execute("DELETE FROM upload_events")
            self.connection.execute("DELETE FROM documents")
            self.connection.execute("DELETE FROM users")

            self.connection.executemany(
                "INSERT INTO documents(id, name, uploaded_at, file_hash, payload) "
                "VALUES (?, ?, ?, ?, ?)",
                [
                    (
                        doc_id,
                        doc.get("name", ""),
                        doc.get("uploaded_at"),
                        doc.get("hash"),
                        self._json(doc),
                    )
                    for doc_id, doc in documents.items()
                ],
            )
            self.connection.executemany(
                "INSERT INTO mappings(barcode, file_id, page_num, payload) "
                "VALUES (?, ?, ?, ?)",
                [
                    (
                        barcode,
                        mapping.get("file_id"),
                        mapping.get("page_num"),
                        self._json(mapping),
                    )
                    for barcode, mapping in mappings.items()
                ],
            )
            self.connection.executemany(
                "INSERT OR REPLACE INTO print_jobs(id, file_id, page_num, status, timestamp, payload) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                [self._print_job_row(job, index) for index, job in enumerate(print_jobs)],
            )
            self.connection.executemany(
                "INSERT OR REPLACE INTO users(username, payload) VALUES (?, ?)",
                [
                    (user.get("username", ""), self._json(user))
                    for user in users if user.get("username")
                ],
            )
            self.connection.executemany(
                "INSERT OR REPLACE INTO upload_events(id, file_id, timestamp, is_duplicate, payload) "
                "VALUES (?, ?, ?, ?, ?)",
                [self._upload_event_row(event, index) for index, event in enumerate(upload_events)],
            )
            self.connection.execute(
                "INSERT OR REPLACE INTO metadata(key, value) VALUES ('source', ?)",
                (source,),
            )
        self.connection.execute("PRAGMA wal_checkpoint(PASSIVE)")

    def import_legacy_json(self, db_path, print_journal_path=None, upload_journal_path=None):
        if not os.path.exists(db_path):
            return False
        with open(db_path, "r", encoding="utf-8") as source:
            data = json.load(source)

        self._merge_journal(data.setdefault("print_jobs", []), print_journal_path, "id")
        self._merge_journal(data.setdefault("upload_events", []), upload_journal_path, "id")
        self.replace_all(data, source="legacy-json")
        return True

    @staticmethod
    def _merge_journal(target, path, id_key):
        if not path or not os.path.exists(path):
            return
        known = {item.get(id_key) for item in target if item.get(id_key)}
        with open(path, "r", encoding="utf-8") as journal:
            for line in journal:
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                item_id = item.get(id_key)
                if item_id and item_id in known:
                    continue
                target.append(item)
                if item_id:
                    known.add(item_id)

    def _print_job_row(self, job, fallback_index=0):
        job_id = job.get("id") or f"legacy-print-{fallback_index}"
        if "id" not in job:
            job = {**job, "id": job_id}
        return (
            job_id,
            job.get("file_id"),
            job.get("page_num"),
            job.get("status"),
            job.get("timestamp"),
            self._json(job),
        )

    def _upload_event_row(self, event, fallback_index=0):
        event_id = event.get("id") or f"legacy-upload-{fallback_index}"
        if "id" not in event:
            event = {**event, "id": event_id}
        return (
            event_id,
            event.get("file_id"),
            event.get("timestamp"),
            1 if event.get("is_duplicate") else 0,
            self._json(event),
        )

    def upsert_user(self, user):
        with self._lock, self.connection:
            self.connection.execute(
                "INSERT OR REPLACE INTO users(username, payload) VALUES (?, ?)",
                (user.get("username"), self._json(user)),
            )

    def delete_user(self, username):
        with self._lock, self.connection:
            self.connection.execute("DELETE FROM users WHERE username = ?", (username,))

    def insert_print_job(self, job):
        with self._lock, self.connection:
            self.connection.execute(
                "INSERT OR REPLACE INTO print_jobs(id, file_id, page_num, status, timestamp, payload) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                self._print_job_row(job),
            )

    def insert_upload_event(self, event):
        with self._lock, self.connection:
            self.connection.execute(
                "INSERT OR REPLACE INTO upload_events(id, file_id, timestamp, is_duplicate, payload) "
                "VALUES (?, ?, ?, ?, ?)",
                self._upload_event_row(event),
            )

    def insert_document_bundle(self, document, mappings, upload_event):
        with self._lock, self.connection:
            self.connection.execute(
                "INSERT INTO documents(id, name, uploaded_at, file_hash, payload) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    document.get("id"),
                    document.get("name", ""),
                    document.get("uploaded_at"),
                    document.get("hash"),
                    self._json(document),
                ),
            )
            self.connection.executemany(
                "INSERT OR REPLACE INTO mappings(barcode, file_id, page_num, payload) "
                "VALUES (?, ?, ?, ?)",
                [
                    (
                        item.get("barcode"),
                        item.get("file_id"),
                        item.get("page_num"),
                        self._json({key: value for key, value in item.items() if key != "barcode"}),
                    )
                    for item in mappings
                ],
            )
            self.connection.execute(
                "INSERT INTO upload_events(id, file_id, timestamp, is_duplicate, payload) "
                "VALUES (?, ?, ?, ?, ?)",
                self._upload_event_row(upload_event),
            )

    def delete_document(self, file_id):
        with self._lock, self.connection:
            self.connection.execute("DELETE FROM mappings WHERE file_id = ?", (file_id,))
            self.connection.execute("DELETE FROM upload_events WHERE file_id = ?", (file_id,))
            self.connection.execute("DELETE FROM documents WHERE id = ?", (file_id,))

    def counts(self):
        with self._lock:
            return {
                table: self.connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                for table in ("documents", "mappings", "print_jobs", "users", "upload_events")
            }

    def close(self):
        with self._lock:
            self.connection.execute("PRAGMA wal_checkpoint(PASSIVE)")
            self.connection.close()
