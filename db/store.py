"""SQLite store for GradeBuddy scorecards."""

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, Optional

DB_PATH = os.environ.get("GRADEBUDDY_DB", "output/gradebuddy.db")


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the scorecards table if it doesn't exist."""
    conn = _connect()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scorecards (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id      TEXT NOT NULL,
                repo_url        TEXT NOT NULL,
                assignment      TEXT NOT NULL,
                scorecard_json  TEXT NOT NULL,
                created_at      TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def save_scorecard(
    student_id: str,
    repo_url: str,
    assignment: str,
    scorecard: Dict[str, Any],
) -> int:
    """Persist a scorecard and return its row id."""
    conn = _connect()
    try:
        cur = conn.execute(
            """
            INSERT INTO scorecards (student_id, repo_url, assignment, scorecard_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                student_id,
                repo_url,
                assignment,
                json.dumps(scorecard),
                datetime.utcnow().isoformat(timespec="seconds") + "Z",
            ),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_scorecard(
    student_id: str,
    assignment: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Fetch the most recent scorecard for a student (optionally filtered by assignment)."""
    conn = _connect()
    try:
        if assignment:
            row = conn.execute(
                """
                SELECT * FROM scorecards
                WHERE student_id = ? AND assignment = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (student_id, assignment),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT * FROM scorecards
                WHERE student_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (student_id,),
            ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "student_id": row["student_id"],
            "repo_url": row["repo_url"],
            "assignment": row["assignment"],
            "scorecard": json.loads(row["scorecard_json"]),
            "created_at": row["created_at"],
        }
    finally:
        conn.close()
