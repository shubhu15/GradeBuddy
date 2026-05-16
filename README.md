# GradeBuddy

> AI grading co-pilot for code assignments. Powered by Claude.

---

## The Problem

Grading REST API assignments is **slow, repetitive, and inconsistent**.

For every student in a CS class of 50+ people, a TA has to:

1. Clone the student's GitHub repo.
2. Build & run their server locally.
3. Run a Postman collection against it and read through pages of test output.
4. Map "test #14 failed" back to a rubric line like *"3 points: paginates `GET /businesses`"*.
5. Decide how much partial credit each line deserves.
6. Write personalized feedback ("your error handling could use…").
7. Repeat **50 times.**

It takes hours, the feedback gets shallower as fatigue sets in, and two TAs grading the same submission rarely agree on the exact score.

---

## What We Built

**GradeBuddy** automates the whole loop end-to-end:

```
Student repo ─▶ Docker spin-up ─▶ Newman tests ─▶ Claude grader ─▶ Scorecard
```

Drop in a repo URL, get back:

- A **point-by-point rubric breakdown** with deduction reasons grounded in actual failing tests.
- A **summary** of how the submission went.
- Four categories of **code quality feedback** (error handling, REST conventions, code structure, naming) — actionable, 1–2 sentences each.
- A web UI where the TA can review, **override scores live**, and publish.

What used to take 20 minutes per student now takes about 90 seconds — and the TA spends their time *reviewing* Claude's reasoning instead of running curl commands.

---

## How It Works

The pipeline is three agents wired together:

| Step | Agent | Job |
|------|-------|-----|
| 1 | `spec_reader` | Parses the assignment markdown into a structured rubric + reads the Postman collection. |
| 2 | `runner` | Clones the student's repo, spins it up in Docker, runs Newman against it, captures every assertion + latency. |
| 3 | `grader` | Sends the rubric + test results to **Claude (claude-sonnet-4-5)**, which returns a structured scorecard JSON. |

The Flask API wraps this in a multi-student workflow with background grading threads, and the React UI lets a TA drive everything from the browser.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     React UI  (port 5173)                    │
│        SetupPage  •  DashboardPage  •  Tailwind              │
└────────────────────────┬─────────────────────────────────────┘
                         │ /api (proxied)
┌────────────────────────▼─────────────────────────────────────┐
│                  Flask API  (port 5050)                      │
│   POST /assignments  •  POST /students  •  POST /grade       │
└────────┬─────────────────────────────────┬───────────────────┘
         │                                 │
         ▼                                 ▼
   ┌──────────┐                  ┌────────────────────┐
   │ SQLite   │                  │ Background thread  │
   │ scorecard│                  │  ├─ docker compose │
   │   store  │                  │  ├─ newman tests   │
   └──────────┘                  │  └─ Claude grader  │
                                 └────────────────────┘
                                          │
                                          ▼
                                ┌────────────────────┐
                                │ Mock REST server   │
                                │ (port 3000, Docker)│
                                └────────────────────┘
```

---

## Tech Stack

- **Backend**: Python 3, Flask, Anthropic SDK (Claude), SQLite, Newman (Postman CLI), Docker.
- **Frontend**: React 19 + Vite, Tailwind (via CDN), React Router.
- **AI**: Claude `claude-sonnet-4-5` for rubric mapping & code quality feedback.

---

## Quick Start

### 1. Prerequisites

- Python 3.10+
- Node 20+
- Docker Desktop running
- `newman` CLI (`npm install -g newman`)
- An Anthropic API key

### 2. Configure

```bash
cp .env.example .env
# then edit .env and paste your key:
# ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Install

```bash
# Python deps
pip install -r requirements.txt

# Frontend deps
cd web && npm install && cd ..
```

### 4. Run (three terminals)

```bash
# Terminal 1 — Flask API
python api.py
# → http://localhost:5050

# Terminal 2 — React UI
cd web && npm run dev
# → http://localhost:5173

# Terminal 3 — Docker is just running in the background;
# the API spins up the mock server itself when you click Grade.
```

Open **http://localhost:5173** and you're in.

### 5. Demo flow

1. On the setup page, create an assignment by uploading:
   - `demo/assignment.md` (the rubric)
   - `demo/collection.json` (the Postman tests)
2. Land on `/grade/<id>`.
3. Add three students with mock variants:
   - `alice` → perfect implementation
   - `bob` → status code bugs
   - `charlie` → 404 + pagination bugs
4. Hit **Run All Pending** and watch the scorecards fill in.

---

## Project Structure

```
gradeflow/
├── api.py                      # Flask API (port 5050)
├── main.py                     # CLI entrypoint for a single student
├── agents/
│   ├── spec_reader.py          # parses assignment + Postman collection
│   ├── runner.py               # clones repo + runs Newman
│   └── grader.py               # asks Claude to score the submission
├── tools/
│   ├── docker_tools.py         # docker compose helpers
│   ├── newman_tools.py         # Newman invocation + result parsing
│   └── git_tools.py            # repo cloning
├── db/store.py                 # SQLite scorecard persistence
├── demo/
│   ├── assignment.md           # sample rubric
│   ├── collection.json         # sample Postman collection
│   └── mock-server/            # 3 student-implementation variants
│       ├── app_alice.py        # ✅ perfect
│       ├── app_bob.py          # ⚠️  status code bugs
│       └── app_charlie.py      # ⚠️  404 + pagination bugs
├── web/                        # React + Vite frontend
│   └── src/pages/
│       ├── SetupPage.jsx       # create / browse assignments
│       └── DashboardPage.jsx   # student roster + live scorecard
├── output/                     # scorecards.db + per-student JSON
└── uploads/                    # assignments uploaded via the API
```

---

## Scorecard Shape

Every graded submission gets a JSON blob like this:

```json
{
  "rubric_items": [
    {
      "name": "GET /businesses paginates by 3",
      "points_possible": 5,
      "points_awarded": 3,
      "deduction_reason": "Returned all 7 items instead of 3 — `?page=1` ignored.",
      "evidence": "Newman assertion 'paginates by 3' failed"
    }
  ],
  "total_awarded": 78,
  "total_possible": 100,
  "summary": "Solid CRUD endpoints, but pagination and error handling need work.",
  "code_quality_feedback": {
    "error_handling": "...",
    "rest_conventions": "...",
    "code_structure": "...",
    "naming": "..."
  }
}
```

---

## Why This Matters

This isn't just a faster grader — it's a way to give **every student** the same depth of code-quality feedback that previously only the first 5 submissions ever got, before TA fatigue set in.

Built with [Claude](https://claude.com) for the Anthropic hackathon.
