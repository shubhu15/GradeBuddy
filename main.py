"""GradeBuddy CLI entrypoint.

Orchestrates the spec_reader -> runner -> grader pipeline for a single
student submission, persists the resulting scorecard to SQLite, and
pretty-prints it to the terminal with `rich`.
"""

import argparse
import json
import os
import sys
from typing import Any, Dict

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from agents import spec_reader, runner, grader
from db import init_db, save_scorecard

console = Console()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="gradebuddy",
        description="Automated grading pipeline for student REST API assignments.",
    )
    parser.add_argument("--student", required=True, help="Student identifier (e.g. ONID or email).")
    parser.add_argument("--repo", required=True, help="Git URL of the student's submission repo.")
    parser.add_argument("--assignment", required=True, help="Path to the assignment markdown spec.")
    parser.add_argument("--collection", required=True, help="Path to the Postman collection JSON.")
    parser.add_argument(
        "--base-url",
        default="http://localhost:3000",
        help="Base URL where the student's server will be reachable (default: http://localhost:3000).",
    )
    return parser.parse_args()


def render_rubric(spec: Dict[str, Any]) -> None:
    """Pretty-print the parsed rubric and collection requests from the spec."""
    rubric = spec.get("rubric", []) or []
    total_points = spec.get("total_points", 0)
    requests = spec.get("collection_requests", []) or []

    if not rubric:
        console.print("[yellow]No rubric items parsed from assignment.[/yellow]")
    else:
        table = Table(
            title="Parsed Rubric",
            show_lines=False,
            header_style="bold magenta",
        )
        table.add_column("#", justify="right", style="dim", width=3)
        table.add_column("Criterion", style="white")
        table.add_column("Points", justify="right", style="cyan")
        for idx, item in enumerate(rubric, start=1):
            table.add_row(
                str(idx),
                str(item.get("name", "")),
                str(item.get("points", 0)),
            )
        console.print(table)
        console.print(
            Panel.fit(
                Text(f"Rubric total: {total_points} points", style="bold magenta"),
                border_style="magenta",
            )
        )

    if requests:
        req_table = Table(
            title="Collection Requests",
            show_lines=False,
            header_style="bold blue",
        )
        req_table.add_column("#", justify="right", style="dim", width=3)
        req_table.add_column("Method", style="cyan", width=8)
        req_table.add_column("Name", style="white")
        req_table.add_column("URL", style="dim")
        for idx, req in enumerate(requests, start=1):
            req_table.add_row(
                str(idx),
                str(req.get("method", "")),
                str(req.get("name", "")),
                str(req.get("url", "")),
            )
        console.print(req_table)


def render_newman_summary(results: Dict[str, Any]) -> None:
    """Pretty-print the Newman run summary: pass/fail counts + per-request latency."""
    total_passed = results.get("total_passed", 0)
    total_failed = results.get("total_failed", 0)
    latencies = results.get("latencies_ms", {}) or {}
    failures = results.get("failures", []) or []

    summary_style = "bold green" if total_failed == 0 else "bold yellow"
    console.print(
        Panel.fit(
            Text(
                f"Newman: {total_passed} passed / {total_failed} failed",
                style=summary_style,
            ),
            border_style="green" if total_failed == 0 else "yellow",
        )
    )

    if latencies:
        lat_table = Table(
            title="Request Latencies",
            show_lines=False,
            header_style="bold blue",
        )
        lat_table.add_column("#", justify="right", style="dim", width=3)
        lat_table.add_column("Request", style="white")
        lat_table.add_column("Latency (ms)", justify="right", style="cyan")
        for idx, (name, ms) in enumerate(latencies.items(), start=1):
            lat_table.add_row(str(idx), str(name), f"{ms:.0f}")
        console.print(lat_table)

    if failures:
        fail_table = Table(
            title="Failures",
            show_lines=False,
            header_style="bold red",
        )
        fail_table.add_column("#", justify="right", style="dim", width=3)
        fail_table.add_column("Request", style="white")
        fail_table.add_column("Test", style="yellow")
        fail_table.add_column("Error", style="red")
        for idx, f in enumerate(failures, start=1):
            fail_table.add_row(
                str(idx),
                str(f.get("request", "")),
                str(f.get("test", "")),
                str(f.get("error", "")),
            )
        console.print(fail_table)


def render_scorecard(student: str, assignment: str, scorecard: Dict[str, Any]) -> None:
    """Pretty-print the final scorecard using rich."""
    # DEBUG: confirm the dict the table will render from.
    print("=== SCORECARD DICT BEING RENDERED ===")
    print(json.dumps(scorecard, indent=2))
    print("=== END SCORECARD DICT ===")

    items = scorecard.get("rubric_items") or []
    total = scorecard.get("total_awarded", 0)
    maximum = scorecard.get("total_possible", 100)
    summary = scorecard.get("summary", "")
    code_quality_feedback = scorecard.get("code_quality_feedback", {}) or {}

    console.print(
        Panel.fit(Text(f"Assignment: {assignment}", style="bold"), border_style="cyan")
    )

    # Code quality feedback panel renders ABOVE the scorecard table.
    if code_quality_feedback:
        feedback_text = Text()
        feedback_text.append("Error Handling: ", style="bold")
        feedback_text.append(f"{code_quality_feedback.get('error_handling', '')}\n")
        feedback_text.append("REST Conventions: ", style="bold")
        feedback_text.append(f"{code_quality_feedback.get('rest_conventions', '')}\n")
        feedback_text.append("Code Structure: ", style="bold")
        feedback_text.append(f"{code_quality_feedback.get('code_structure', '')}\n")
        feedback_text.append("Naming: ", style="bold")
        feedback_text.append(f"{code_quality_feedback.get('naming', '')}")
        console.print(
            Panel(
                feedback_text,
                title="Code Quality Feedback",
                title_align="left",
                border_style="magenta",
            )
        )

    table = Table(
        title=f"GradeBuddy Scorecard — {student}",
        show_lines=True,
        header_style="bold cyan",
    )
    table.add_column("#", justify="right", style="dim", width=3)
    table.add_column("Rubric Item", style="white")
    table.add_column("Earned", justify="right", style="green")
    table.add_column("Max", justify="right", style="white")
    table.add_column("Deduction Reason", style="yellow")
    table.add_column("Evidence", style="dim")

    for idx, item in enumerate(items, start=1):
        earned = item.get("points_awarded", 0)
        points = item.get("points_possible", 0)
        table.add_row(
            str(idx),
            str(item.get("name", "")),
            str(earned),
            str(points),
            str(item.get("deduction_reason", "")),
            str(item.get("evidence", "")),
        )

    console.print(table)
    bar_style = "bold green" if total == maximum else "bold yellow"
    console.print(
        Panel.fit(
            Text(f"TOTAL: {total} / {maximum}", style=bar_style),
            border_style="green" if total == maximum else "yellow",
        )
    )
    if summary:
        console.print(Panel.fit(Text(summary, style="italic"), border_style="cyan"))


def main() -> int:
    args = parse_args()

    init_db()

    console.rule("[bold cyan]GradeBuddy")
    console.print(f"[bold]Student:[/bold] {args.student}")
    console.print(f"[bold]Repo:[/bold] {args.repo}")
    console.print(f"[bold]Assignment:[/bold] {args.assignment}")
    console.print(f"[bold]Collection:[/bold] {args.collection}")
    console.print(f"[bold]Base URL:[/bold] {args.base_url}")
    console.rule()

    # Step 1 — Read the spec.
    with console.status("[cyan]Reading assignment spec..."):
        spec = spec_reader.run(
            assignment_md_path=args.assignment,
            collection_json_path=args.collection,
        )
    render_rubric(spec)
    console.rule()

    # Step 2 — Run the student's code against the Postman collection.
    with console.status("[cyan]Running Newman against student server..."):
        results = runner.run(
            repo_url=args.repo,
            base_url=args.base_url,
            collection_path=args.collection,
        )
    render_newman_summary(results)
    console.rule()

    # Step 3 — Grade the results.
    # No console.status() here — the grader emits debug prints that need to
    # land in the terminal cleanly, and rich's status spinner swallows them.
    scorecard = grader.run(spec_output=spec, runner_output=results)
    console.rule()

    # Step 4 — Persist and render.
    save_scorecard(
        student_id=args.student,
        repo_url=args.repo,
        assignment=args.assignment,
        scorecard=scorecard,
    )

    # Also drop a JSON copy on disk so the Flask API layer can read it back
    # without re-querying SQLite.
    os.makedirs("output", exist_ok=True)
    scorecard_json_path = os.path.join("output", f"{args.student}_scorecard.json")
    with open(scorecard_json_path, "w") as f:
        json.dump(scorecard, f, indent=2)

    render_scorecard(args.student, args.assignment, scorecard)
    return 0


if __name__ == "__main__":
    sys.exit(main())
