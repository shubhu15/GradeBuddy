"""Newman (Postman CLI) helpers — run a collection and parse the JSON report."""

import json
import os
import subprocess
import tempfile
from typing import Any, Dict, List


def _build_env_file(base_url: str) -> str:
    """Write a Postman environment JSON to a temp file and return its path."""
    env = {
        "id": "gradebuddy-env",
        "name": "gradebuddy",
        "values": [
            {"key": "base_url", "value": base_url, "type": "default", "enabled": True}
        ],
        "_postman_variable_scope": "environment",
    }
    fd, path = tempfile.mkstemp(prefix="gradebuddy_env_", suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(env, f)
    return path


def _parse_report(report: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a Newman JSON report into GradeBuddy's normalized shape."""
    assertions: List[Dict[str, Any]] = []
    failures: List[Dict[str, Any]] = []
    latencies_ms: Dict[str, float] = {}

    executions = report.get("run", {}).get("executions", []) or []
    for ex in executions:
        item = ex.get("item", {}) or {}
        request_name = item.get("name", "") or ex.get("name", "")

        response = ex.get("response") or {}
        rt = response.get("responseTime")
        if isinstance(rt, (int, float)):
            latencies_ms[request_name] = float(rt)

        for a in ex.get("assertions", []) or []:
            test_name = a.get("assertion", "")
            err = a.get("error")
            passed = err is None
            err_msg = None
            if err:
                err_msg = err.get("message") or err.get("name") or str(err)
            assertions.append(
                {
                    "request": request_name,
                    "test": test_name,
                    "passed": passed,
                    "error": err_msg,
                }
            )

    # Newman top-level failures array — typically aligns with failed assertions,
    # but we also derive ours from the assertions list to keep things consistent.
    for f in report.get("run", {}).get("failures", []) or []:
        src = f.get("source") or {}
        err = f.get("error") or {}
        failures.append(
            {
                "request": src.get("name", ""),
                "test": err.get("test", "") or err.get("name", ""),
                "error": err.get("message", "") or err.get("name", ""),
            }
        )

    total_passed = sum(1 for a in assertions if a["passed"])
    total_failed = sum(1 for a in assertions if not a["passed"])

    return {
        "assertions": assertions,
        "failures": failures,
        "latencies_ms": latencies_ms,
        "total_passed": total_passed,
        "total_failed": total_failed,
    }


def run_newman(
    collection_path: str,
    base_url: str,
    output_path: str = "output/newman_results.json",
) -> Dict[str, Any]:
    """Run a Postman collection via the `newman` CLI and parse the JSON report.

    Test-assertion failures (exit code 1) are NOT treated as errors here —
    they are normal output that the grader needs to see.
    """
    if not os.path.exists(collection_path):
        raise FileNotFoundError(f"Collection not found: {collection_path}")

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    env_path = _build_env_file(base_url)
    try:
        cmd = [
            "newman",
            "run",
            collection_path,
            "-e",
            env_path,
            "--reporters",
            "json",
            "--reporter-json-export",
            output_path,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)

        if not os.path.exists(output_path):
            raise RuntimeError(
                f"newman did not produce a report at {output_path}.\n"
                f"exit={proc.returncode}\nSTDOUT: {proc.stdout}\nSTDERR: {proc.stderr}"
            )

        with open(output_path, "r", encoding="utf-8") as f:
            report = json.load(f)

        parsed = _parse_report(report)
        parsed["exit_code"] = proc.returncode
        parsed["report_path"] = output_path
        return parsed
    finally:
        try:
            os.remove(env_path)
        except OSError:
            pass
