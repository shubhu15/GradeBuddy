"""GradeBuddy Flask API.

Backs the GradeBuddy web UI. Exposes assignment + student management and
kicks off grading runs in background threads. Runs on port 5050 with CORS
open to all origins.

Endpoints:
    GET  /api/health
    POST /api/assignments
    GET  /api/assignments
    GET  /api/assignments/<assignment_id>
    POST /api/assignments/<assignment_id>/students
    POST /api/assignments/<assignment_id>/students/<student_id>/grade
    GET  /api/assignments/<assignment_id>/students/<student_id>
"""

import sqlite3  # noqa: F401  (listed in spec; kept for future direct DB access)
import json
import os
import subprocess
import threading
import time
import uuid
import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename

from db import init_db, get_scorecard


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


# ---------------------------------------------------------------------------
# Storage layout
# ---------------------------------------------------------------------------

UPLOADS_DIR = "uploads"
OUTPUT_DIR = "output"
COMPOSE_FILE = "demo/mock-server/docker-compose.yml"
MOCK_APP_DST = "demo/mock-server/app.py"
ALLOWED_VARIANTS = {"alice", "bob", "charlie"}

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

init_db()

# In-memory assignment registry. Keyed by assignment_id (8-char uuid slice).
# Schema:
#   ASSIGNMENTS[aid] = {
#       "name": str,
#       "course": str,
#       "description": str,
#       "assignment_md_path": str,
#       "collection_json_path": str,
#       "created_at": str (ISO-8601, UTC),
#       "students": [
#           {"student_id": str, "repo_url": str, "mock_variant": str,
#            "status": "pending"|"running"|"complete"|"error",
#            "scorecard": dict|None, "error": str|None}
#       ],
#   }
ASSIGNMENTS: dict = {}
ASSIGNMENTS_LOCK = threading.Lock()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _find_student(assignment_id: str, student_id: str):
    """Return (assignment_dict, student_dict) — either may be None."""
    assignment = ASSIGNMENTS.get(assignment_id)
    if not assignment:
        return None, None
    for s in assignment["students"]:
        if s["student_id"] == student_id:
            return assignment, s
    return assignment, None


def _set_student_field(assignment_id: str, student_id: str, **fields) -> None:
    """Thread-safe in-place update of a student record."""
    with ASSIGNMENTS_LOCK:
        assignment = ASSIGNMENTS.get(assignment_id)
        if not assignment:
            return
        for s in assignment["students"]:
            if s["student_id"] == student_id:
                s.update(fields)
                return


# ---------------------------------------------------------------------------
# Background grader
# ---------------------------------------------------------------------------

def _grade_in_background(assignment_id: str, student_id: str) -> None:
    """Bring up the mock server, run main.py, slurp the scorecard JSON back in."""
    assignment, student = _find_student(assignment_id, student_id)
    if not assignment or not student:
        print(f"[grade] missing assignment/student: {assignment_id}/{student_id}")
        return

    mock_variant = student.get("mock_variant", "alice")
    repo_url = student["repo_url"]

    try:
        # a) Stop anything currently bound on port 3000 from a previous run.
        try:
            subprocess.run(
                ["docker", "compose", "-f", COMPOSE_FILE, "down"],
                check=False,
                capture_output=True,
                timeout=120,
            )
        except Exception as e:
            print(f"[grade] compose down warning: {e}")

        # b) Swap in the requested variant of app.py for the mock server.
        src = f"demo/mock-server/app_{mock_variant}.py"
        if not os.path.exists(src):
            raise FileNotFoundError(f"Mock variant source not found: {src}")
        with open(src, "rb") as fsrc, open(MOCK_APP_DST, "wb") as fdst:
            fdst.write(fsrc.read())
        print(f"[grade] copied {src} -> {MOCK_APP_DST}")

        # c) Build + start the stack detached.
        up = subprocess.run(
            ["docker", "compose", "-f", COMPOSE_FILE, "up", "-d", "--build"],
            check=True,
            capture_output=True,
            text=True,
            timeout=600,
        )
        print(up.stdout)
        if up.stderr:
            print(up.stderr)

        # d) Give the container a moment to actually start serving traffic.
        time.sleep(5)

        # e) Hand off to the CLI pipeline. main.py persists to SQLite AND
        #    writes output/<student_id>_scorecard.json for us to read below.
        cmd = [
            "python",
            "main.py",
            "--student",
            student_id,
            "--repo",
            repo_url,
            "--assignment",
            assignment["assignment_md_path"],
            "--collection",
            assignment["collection_json_path"],
            "--base-url",
            "http://localhost:3000",
        ]
        print(f"[grade] running: {' '.join(cmd)}")
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=900,
        )
        print(proc.stdout)
        if proc.stderr:
            print(proc.stderr)
        if proc.returncode != 0:
            raise RuntimeError(
                f"main.py exited with code {proc.returncode}: {proc.stderr[-500:]}"
            )

        # f) Read the JSON the CLI just wrote. Fall back to SQLite if needed.
        scorecard_path = os.path.join(OUTPUT_DIR, f"{student_id}_scorecard.json")
        scorecard = None
        if os.path.exists(scorecard_path):
            with open(scorecard_path, "r") as f:
                scorecard = json.load(f)
        else:
            row = get_scorecard(student_id, assignment["assignment_md_path"])
            if row:
                scorecard = row["scorecard"]
        if scorecard is None:
            raise FileNotFoundError(
                f"No scorecard produced at {scorecard_path} or in SQLite"
            )

        # g) + h) Cache it on the in-memory record and flip status.
        _set_student_field(
            assignment_id,
            student_id,
            scorecard=scorecard,
            status="complete",
            error=None,
        )
        print(f"[grade] {student_id} -> complete")

    except subprocess.CalledProcessError as e:
        err = (e.stderr or b"").decode() if isinstance(e.stderr, bytes) else str(e.stderr or e)
        print(f"[grade] subprocess failed: {err}")
        _set_student_field(
            assignment_id,
            student_id,
            status="error",
            error=err[-1000:] if err else "subprocess failed",
        )
    except Exception as e:
        print(f"[grade] error: {e}")
        _set_student_field(
            assignment_id,
            student_id,
            status="error",
            error=str(e),
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True}), 200


@app.route("/api/assignments", methods=["POST"])
def create_assignment():
    name = (request.form.get("name") or "").strip()
    course = (request.form.get("course") or "").strip()
    description = (request.form.get("description") or "").strip()

    if not name or not course:
        return jsonify({"error": "name and course are required"}), 400

    assignment_md = request.files.get("assignment_md")
    collection_json = request.files.get("collection_json")
    if assignment_md is None or collection_json is None:
        return jsonify(
            {"error": "assignment_md and collection_json files are required"}
        ), 400

    assignment_id = str(uuid.uuid4())[:8]
    folder = os.path.join(UPLOADS_DIR, assignment_id)
    os.makedirs(folder, exist_ok=True)

    md_name = secure_filename(assignment_md.filename) or "assignment.md"
    coll_name = secure_filename(collection_json.filename) or "collection.json"
    md_path = os.path.join(folder, md_name)
    coll_path = os.path.join(folder, coll_name)

    assignment_md.save(md_path)
    collection_json.save(coll_path)

    record = {
        "name": name,
        "course": course,
        "description": description,
        "assignment_md_path": md_path,
        "collection_json_path": coll_path,
        "created_at": _now_iso(),
        "students": [],
    }
    with ASSIGNMENTS_LOCK:
        ASSIGNMENTS[assignment_id] = record

    return jsonify(
        {"assignment_id": assignment_id, "name": name, "course": course}
    ), 201


@app.route("/api/assignments", methods=["GET"])
def list_assignments():
    out = []
    with ASSIGNMENTS_LOCK:
        for aid, a in ASSIGNMENTS.items():
            out.append({
                "assignment_id": aid,
                "name": a["name"],
                "course": a["course"],
                "description": a["description"],
                "created_at": a["created_at"],
                "student_count": len(a["students"]),
            })
    return jsonify(out), 200


@app.route("/api/assignments/<assignment_id>", methods=["GET"])
def get_assignment(assignment_id):
    a = ASSIGNMENTS.get(assignment_id)
    if not a:
        return jsonify({"error": "assignment not found"}), 404
    return jsonify({
        "assignment_id": assignment_id,
        "name": a["name"],
        "course": a["course"],
        "description": a["description"],
        "assignment_md_path": a["assignment_md_path"],
        "collection_json_path": a["collection_json_path"],
        "created_at": a["created_at"],
        "students": a["students"],
    }), 200


@app.route("/api/assignments/<assignment_id>/students", methods=["POST"])
def add_student(assignment_id):
    a = ASSIGNMENTS.get(assignment_id)
    if not a:
        return jsonify({"error": "assignment not found"}), 404

    body = request.get_json(silent=True) or {}
    student_id = (body.get("student_id") or "").strip()
    repo_url = (body.get("repo_url") or "").strip()
    mock_variant = (body.get("mock_variant") or "alice").strip().lower()

    if not student_id or not repo_url:
        return jsonify({"error": "student_id and repo_url are required"}), 400
    if mock_variant not in ALLOWED_VARIANTS:
        return jsonify(
            {"error": f"mock_variant must be one of {sorted(ALLOWED_VARIANTS)}"}
        ), 400

    # Idempotent: if the student is already on the roster, reset them to pending
    # rather than appending a duplicate.
    with ASSIGNMENTS_LOCK:
        existing = next(
            (s for s in a["students"] if s["student_id"] == student_id), None
        )
        if existing:
            existing["repo_url"] = repo_url
            existing["mock_variant"] = mock_variant
            existing["status"] = "pending"
            existing["scorecard"] = None
            existing["error"] = None
        else:
            a["students"].append({
                "student_id": student_id,
                "repo_url": repo_url,
                "mock_variant": mock_variant,
                "status": "pending",
                "scorecard": None,
                "error": None,
            })

    return jsonify({"student_id": student_id, "status": "pending"}), 201


@app.route(
    "/api/assignments/<assignment_id>/students/<student_id>/grade",
    methods=["POST"],
)
def grade_student(assignment_id, student_id):
    assignment, student = _find_student(assignment_id, student_id)
    if not assignment:
        return jsonify({"error": "assignment not found"}), 404
    if not student:
        return jsonify({"error": "student not found"}), 404

    # Idempotent re-run: blow away prior scorecard, flip to running, kick off.
    _set_student_field(
        assignment_id,
        student_id,
        status="running",
        scorecard=None,
        error=None,
    )

    t = threading.Thread(
        target=_grade_in_background,
        args=(assignment_id, student_id),
        daemon=True,
    )
    t.start()

    return jsonify({"status": "running"}), 202


@app.route(
    "/api/assignments/<assignment_id>/students/<student_id>",
    methods=["GET"],
)
def get_student(assignment_id, student_id):
    assignment, student = _find_student(assignment_id, student_id)
    if not assignment:
        return jsonify({"error": "assignment not found"}), 404
    if not student:
        return jsonify({"error": "student not found"}), 404
    return jsonify(student), 200


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=False)
