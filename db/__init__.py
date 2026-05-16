"""GradeBuddy db package — SQLite-backed scorecard storage."""

from db.store import init_db, save_scorecard, get_scorecard

__all__ = ["init_db", "save_scorecard", "get_scorecard"]
