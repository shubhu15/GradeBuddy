"""Git helpers — clone and cleanup using GitPython."""

import os
import shutil
import stat
from typing import Optional

try:
    from git import Repo  # type: ignore
    from git.exc import GitCommandError  # type: ignore
except Exception:  # pragma: no cover - import guard
    Repo = None  # type: ignore
    GitCommandError = Exception  # type: ignore


def clone_repo(url: str, dest: str) -> str:
    """Clone `url` into `dest`. If `dest` already exists, it is wiped first.

    Returns:
        The destination path on success.

    Raises:
        RuntimeError if GitPython is unavailable or the clone fails.
    """
    if Repo is None:
        raise RuntimeError("GitPython is not installed. `pip install gitpython`.")

    if os.path.exists(dest):
        rmtree_safe(dest)

    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)

    try:
        Repo.clone_from(url, dest)
    except GitCommandError as e:
        raise RuntimeError(f"git clone failed for {url}: {e}") from e

    return dest


def _on_rm_error(func, path, exc_info):
    """Handle read-only files on Windows / locked .git objects."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def rmtree_safe(path: Optional[str]) -> None:
    """Recursively delete `path` if it exists. Never raises."""
    if not path:
        return
    if not os.path.exists(path):
        return
    try:
        shutil.rmtree(path, onerror=_on_rm_error)
    except Exception as e:
        print(f"[git_tools] WARNING: rmtree_safe({path}) failed: {e}")
