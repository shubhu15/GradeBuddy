"""Docker / docker-compose helpers for spinning student submissions up and down."""

import os
import subprocess
import time
from typing import Optional

import requests

CONTAINER_NAME = "gradebuddy_test"
IMAGE_NAME = "gradebuddy_test_img"


def _run(cmd: list, cwd: Optional[str] = None, check: bool = False) -> subprocess.CompletedProcess:
    """Run a subprocess, capture output, optionally raise on non-zero."""
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        capture_output=True,
        text=True,
    )


def start_app(repo_path: str) -> str:
    """Start the student app from `repo_path`.

    Prefers docker-compose.yml; falls back to Dockerfile. Returns an
    identifier that can later be passed to `stop_app`:
      - "compose:<repo_path>"   when docker-compose was used
      - "container:<name>"      when a single Dockerfile was used
    """
    compose_yml = os.path.join(repo_path, "docker-compose.yml")
    compose_yaml = os.path.join(repo_path, "docker-compose.yaml")
    dockerfile = os.path.join(repo_path, "Dockerfile")

    if os.path.exists(compose_yml) or os.path.exists(compose_yaml):
        res = _run(["docker", "compose", "up", "-d", "--build"], cwd=repo_path)
        if res.returncode != 0:
            raise RuntimeError(
                f"docker compose up failed (exit {res.returncode}):\n"
                f"STDOUT: {res.stdout}\nSTDERR: {res.stderr}"
            )
        return f"compose:{repo_path}"

    if os.path.exists(dockerfile):
        build = _run(["docker", "build", "-t", IMAGE_NAME, "."], cwd=repo_path)
        if build.returncode != 0:
            raise RuntimeError(
                f"docker build failed (exit {build.returncode}):\n"
                f"STDOUT: {build.stdout}\nSTDERR: {build.stderr}"
            )
        # Pre-emptively clean up any stale container with the same name.
        _run(["docker", "rm", "-f", CONTAINER_NAME])
        run = _run(
            [
                "docker",
                "run",
                "-d",
                "--rm",
                "-p",
                "3000:3000",
                "--name",
                CONTAINER_NAME,
                IMAGE_NAME,
            ],
            cwd=repo_path,
        )
        if run.returncode != 0:
            raise RuntimeError(
                f"docker run failed (exit {run.returncode}):\n"
                f"STDOUT: {run.stdout}\nSTDERR: {run.stderr}"
            )
        return f"container:{CONTAINER_NAME}"

    raise RuntimeError(
        f"No docker-compose.yml or Dockerfile found in {repo_path}."
    )


def health_check(url: str, retries: int = 15, delay: float = 2.0) -> bool:
    """Poll `url` until the server responds. Any 2xx or 4xx counts as 'up'."""
    for attempt in range(1, retries + 1):
        try:
            res = requests.get(url, timeout=3)
            if 200 <= res.status_code < 500 and res.status_code != 502 and res.status_code != 504:
                return True
        except requests.RequestException:
            pass
        time.sleep(delay)
    return False


def stop_app(identifier: str) -> None:
    """Tear down whatever `start_app` started."""
    if not identifier:
        return

    if identifier.startswith("compose:"):
        repo_path = identifier.split(":", 1)[1]
        _run(["docker", "compose", "down", "-v"], cwd=repo_path)
        return

    if identifier.startswith("container:"):
        name = identifier.split(":", 1)[1]
        _run(["docker", "stop", name])
        _run(["docker", "rm", "-f", name])
        return

    # Fallback: treat as a raw container name.
    _run(["docker", "stop", identifier])
    _run(["docker", "rm", "-f", identifier])
