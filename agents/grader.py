"""Grader agent.

Maps Newman test results onto the rubric using Claude and produces a
structured scorecard. Fails loudly if ANTHROPIC_API_KEY is missing or
if Claude returns unparseable output — no silent fallback.

Returned shape:
    {
        "rubric_items": [
            {"name": str, "points_possible": int, "points_awarded": int,
             "deduction_reason": str, "evidence": str},
            ...
        ],
        "total_awarded": int,
        "total_possible": int,
        "summary": str,
        "code_quality_feedback": {
            "error_handling": str,
            "rest_conventions": str,
            "code_structure": str,
            "naming": str
        }
    }
"""

import json
import os
import re
from typing import Any, Dict

from anthropic import Anthropic


MODEL = "claude-sonnet-4-5"


SYSTEM_PROMPT = """You are a CS assignment grading assistant. You map Newman API test results to a rubric and produce a scored report for a teaching assistant.

OUTPUT FORMAT — your entire response must be a single JSON object with this exact schema:
{
  "rubric_items": [
    {"name": string, "points_possible": int, "points_awarded": int, "deduction_reason": string, "evidence": string}
  ],
  "total_awarded": int,
  "total_possible": int,
  "summary": string,
  "code_quality_feedback": {"error_handling": string, "rest_conventions": string, "code_structure": string, "naming": string}
}

CRITICAL: Start with { and end with }. No markdown code fences. No text before or after the JSON."""


def run(spec_output: Dict[str, Any], runner_output: Dict[str, Any]) -> Dict[str, Any]:
    """Grade a student submission with Claude. Raises if anything goes wrong."""
    print("=== GRADER DEBUG ===")
    print(f"Rubric items received: {len(spec_output.get('rubric', []))}")
    print(f"Newman assertions received: {len(runner_output.get('assertions', []))}")
    print(
        f"Newman passed: {runner_output.get('total_passed')}, "
        f"failed: {runner_output.get('total_failed')}"
    )

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    base_url = os.environ.get("ANTHROPIC_BASE_URL")  # may be None for direct Anthropic

    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    client_kwargs = {"api_key": api_key}
    if base_url:
        client_kwargs["base_url"] = base_url
        print(f"=== Using proxy: {base_url} ===")

    rubric = spec_output.get("rubric", []) or []
    assignment_text = spec_output.get("assignment_text", "") or ""

    user_message = f"""Grade this student submission.

RUBRIC ({len(rubric)} items):
{json.dumps(rubric, indent=2)}

ASSIGNMENT:
{assignment_text}

NEWMAN TEST RESULTS:
Total passed: {runner_output['total_passed']}
Total failed: {runner_output['total_failed']}

Per-assertion details:
{json.dumps(runner_output['assertions'], indent=2)}

Per-request latencies (ms):
{json.dumps(runner_output.get('latencies_ms', {}), indent=2)}

For each rubric item: decide points_awarded based on which Newman assertions cover that item. Give a one-sentence deduction_reason that names the specific failing assertion (if any). If all related assertions passed, deduction_reason is "All checks passed."

Then provide constructive code quality feedback in 4 categories — error handling, REST conventions, code structure, and naming. Each should be 1-2 sentences of specific, actionable advice the student can use to improve. Base this on what the test results tell you about their implementation choices.

Output ONLY the JSON object. No prose, no markdown fences."""

    print("=== USER MESSAGE TO CLAUDE ===")
    print(user_message[:2000])

    client = Anthropic(**client_kwargs)
    response = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text
    print("=== RAW CLAUDE RESPONSE ===")
    print(raw)
    print("=== END RAW ===")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw)
        if not match:
            print("RAW RESPONSE:", raw)
            raise RuntimeError("Claude did not return parseable JSON")
        parsed = json.loads(match.group(0))

    print(f"Graded by Claude ({MODEL})")
    print(
        f"=== RETURNING: {len(parsed.get('rubric_items', []))} rubric items, "
        f"total {parsed.get('total_awarded')}/{parsed.get('total_possible')} ==="
    )
    return parsed


# Back-compat wrapper for the original dict-in/dict-out contract.
def grade(context: Dict[str, Any]) -> Dict[str, Any]:
    return run(
        spec_output=context.get("spec", {}) or {},
        runner_output=context.get("results", {}) or {},
    )
