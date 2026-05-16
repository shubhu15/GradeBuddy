"""Spec Reader agent.

Pure parsing — no LLM call. Reads an assignment markdown file and the
Postman collection JSON and produces a structured spec that downstream
agents (runner, grader) can use.
"""

import json
import os
import re
from typing import Any, Dict, List

# Bullet form: "- POST /businesses creates and returns 201 (15)"
_BULLET_RE = re.compile(r"^\s*[-*+]\s+(?P<name>.+?)\s*\((?P<points>\d+)\)\s*$")

# Markdown table row form: "| 1 | POST /businesses ... | 15 |"
# Skip the header row, the separator row, and the "Total" row.
_TABLE_RE = re.compile(
    r"^\s*\|\s*\d+\s*\|\s*(?P<name>.+?)\s*\|\s*(?P<points>\d+)\s*\|\s*$"
)


def _extract_rubric_block(md_text: str) -> str:
    """Return the text between '## Rubric' and the next '## ' heading (or EOF)."""
    match = re.search(
        r"^##\s+Rubric\s*$(?P<body>.*?)(?=^##\s+|\Z)",
        md_text,
        flags=re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    return match.group("body") if match else ""


def _parse_rubric(md_text: str) -> List[Dict[str, Any]]:
    """Parse the rubric section. Supports both bullet and markdown-table styles."""
    block = _extract_rubric_block(md_text)
    if not block.strip():
        print("[spec_reader] WARNING: no '## Rubric' section found in assignment.")
        return []

    items: List[Dict[str, Any]] = []

    # Try bullet style first.
    for line in block.splitlines():
        m = _BULLET_RE.match(line)
        if m:
            items.append(
                {"name": m.group("name").strip(), "points": int(m.group("points"))}
            )

    # Fallback: markdown table rows.
    if not items:
        for line in block.splitlines():
            m = _TABLE_RE.match(line)
            if m:
                name = m.group("name").strip()
                # Strip surrounding markdown emphasis like **Total**.
                cleaned = re.sub(r"\*+", "", name).strip()
                if cleaned.lower() == "total":
                    continue
                items.append(
                    {"name": name, "points": int(m.group("points"))}
                )

    if not items:
        print("[spec_reader] WARNING: '## Rubric' section found but no items parsed.")

    return items


def _extract_url(request_obj: Dict[str, Any]) -> str:
    """Pull a usable URL string out of a Postman request object."""
    url = request_obj.get("url")
    if isinstance(url, str):
        return url
    if isinstance(url, dict):
        raw = url.get("raw")
        if isinstance(raw, str) and raw:
            return raw
        host = url.get("host") or []
        path = url.get("path") or []
        if isinstance(host, list):
            host = "".join(host)
        if isinstance(path, list):
            path = "/".join(str(p) for p in path)
        joined = host
        if path:
            joined = f"{host}/{path}" if host else f"/{path}"
        return joined
    return ""


def _flatten_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Postman collections can nest folders. Flatten to leaf requests only."""
    out: List[Dict[str, Any]] = []
    for entry in items or []:
        if "request" in entry:
            out.append(entry)
        elif "item" in entry:
            out.extend(_flatten_items(entry.get("item", [])))
    return out


def _parse_collection(collection_path: str) -> List[Dict[str, str]]:
    if not os.path.exists(collection_path):
        print(f"[spec_reader] WARNING: collection not found at {collection_path}.")
        return []

    with open(collection_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    requests: List[Dict[str, str]] = []
    for entry in _flatten_items(data.get("item", [])):
        req = entry.get("request") or {}
        method = req.get("method", "") if isinstance(req, dict) else ""
        url = _extract_url(req) if isinstance(req, dict) else ""
        requests.append(
            {
                "name": entry.get("name", ""),
                "method": method,
                "url": url,
            }
        )
    return requests


def run(assignment_md_path: str, collection_json_path: str) -> Dict[str, Any]:
    """Parse an assignment spec + Postman collection into a structured dict.

    Returns:
        {
            "rubric": [{"name": str, "points": int}, ...],
            "assignment_text": str,
            "collection_requests": [{"name": str, "method": str, "url": str}, ...],
            "total_points": int
        }
    """
    if not os.path.exists(assignment_md_path):
        print(f"[spec_reader] WARNING: assignment not found at {assignment_md_path}.")
        assignment_text = ""
    else:
        with open(assignment_md_path, "r", encoding="utf-8") as f:
            assignment_text = f.read()

    rubric = _parse_rubric(assignment_text)
    collection_requests = _parse_collection(collection_json_path)
    total_points = sum(item.get("points", 0) for item in rubric)

    return {
        "rubric": rubric,
        "assignment_text": assignment_text,
        "collection_requests": collection_requests,
        "total_points": total_points,
    }


# Back-compat wrapper for the original dict-in/dict-out contract.
def read_spec(context: Dict[str, Any]) -> Dict[str, Any]:
    return run(
        assignment_md_path=context.get("assignment_path", ""),
        collection_json_path=context.get("collection_path", ""),
    )
