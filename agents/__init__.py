"""GradeBuddy agents package.

Each agent is a small, focused module that takes a dict-shaped context
and returns a dict-shaped result. The orchestrator in main.py chains
them together: spec_reader -> runner -> grader.
"""

from agents.spec_reader import read_spec
from agents.runner import run_tests
from agents.grader import grade

__all__ = ["read_spec", "run_tests", "grade"]
