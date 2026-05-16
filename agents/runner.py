"""Runner agent.

Drives test execution against a student submission. For now we skip the
clone + docker steps and assume the server is already running at
`base_url` — this lets us validate the Newman path end-to-end against
the demo mock server.

TODO: full submission flow:
    1. tools.git_tools.clone_repo(repo_url, dest)
    2. tools.docker_tools.start_app(dest)
    3. tools.docker_tools.health_check(base_url + "/businesses")
    4. tools.newman_tools.run_newman(...)
    5. tools.docker_tools.stop_app(identifier)
    6. tools.git_tools.rmtree_safe(dest)
"""

from typing import Any, Dict

from tools import newman_tools


def run(repo_url: str, base_url: str, collection_path: str) -> Dict[str, Any]:
    """Run the Postman collection against an already-running server.

    Args:
        repo_url: Student repo URL (currently unused — see TODO above).
        base_url: Where the student's server is reachable (e.g. http://localhost:3000).
        collection_path: Path to the Postman collection JSON.

    Returns:
        Newman result dict from tools.newman_tools.run_newman, plus a
        "base_url" / "repo_url" echo for downstream agents.
    """
    result = newman_tools.run_newman(
        collection_path=collection_path,
        base_url=base_url,
    )
    result["base_url"] = base_url
    result["repo_url"] = repo_url
    return result


# Back-compat wrapper for the dict-in/dict-out contract.
def run_tests(context: Dict[str, Any]) -> Dict[str, Any]:
    return run(
        repo_url=context.get("repo_url", ""),
        base_url=context.get("base_url", "http://localhost:3000"),
        collection_path=context.get("collection_path", ""),
    )
