"""Tests for database setup and migrations."""

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.database import get_engine, get_session, init_db_for_tests, reset_engine


@pytest.fixture
def db_path(tmp_path: Path) -> Iterator[Path]:
    path = tmp_path / "test.db"
    yield path
    reset_engine()


class TestInitDbForTests:
    def test_creates_tables(self, db_path: Path) -> None:
        init_db_for_tests(db_path)
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        conn.close()
        assert "ai_config" in tables
        assert "ai_analysis_cache" in tables
        assert "hidden_zones" in tables
        assert "ai_analysis_settings" in tables
        assert "device_metrics" in tables
        assert "notifications" in tables

    def test_idempotent(self, db_path: Path) -> None:
        init_db_for_tests(db_path)
        init_db_for_tests(db_path)  # Should not raise

    def test_creates_parent_directory(self, tmp_path: Path) -> None:
        db_path = tmp_path / "subdir" / "test.db"
        init_db_for_tests(db_path)
        assert db_path.exists()
        reset_engine()


class TestInitDbWithAlembic:
    def test_creates_tables_via_migrations(self, db_path: Path) -> None:
        from app.database import init_db
        init_db(db_path)
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        conn.close()
        assert "ai_config" in tables
        assert "ai_analysis_cache" in tables
        assert "hidden_zones" in tables
        assert "ai_analysis_settings" in tables
        assert "device_metrics" in tables
        assert "notifications" in tables
        assert "alembic_version" in tables

    def test_idempotent(self, db_path: Path) -> None:
        from app.database import init_db
        init_db(db_path)
        reset_engine()
        init_db(db_path)  # Should not raise


class TestGetEngine:
    def test_returns_engine_after_init(self, db_path: Path) -> None:
        init_db_for_tests(db_path)
        engine = get_engine()
        assert engine is not None

    def test_raises_before_init(self) -> None:
        with pytest.raises(RuntimeError, match="not initialized"):
            get_engine()


class TestGetSession:
    def test_returns_session_after_init(self, db_path: Path) -> None:
        init_db_for_tests(db_path)
        session = get_session()
        assert session is not None
        session.close()

    def test_raises_before_init(self) -> None:
        with pytest.raises(RuntimeError, match="not initialized"):
            get_session()


class TestResetEngine:
    def test_reset_when_no_engine(self) -> None:
        """reset_engine should work fine even when engine is already None."""
        reset_engine()  # Should not raise

    def test_reset_disposes_engine(self, db_path: Path) -> None:
        """reset_engine should dispose an existing engine."""
        init_db_for_tests(db_path)
        engine = get_engine()
        assert engine is not None
        reset_engine()
        with pytest.raises(RuntimeError, match="not initialized"):
            get_engine()


class TestInitDbDisposesExistingEngine:
    def test_reinitialize_disposes_previous(self, db_path: Path) -> None:
        """Calling init_db when engine already exists should dispose the old one."""
        from app.database import init_db

        init_db(db_path)
        engine1 = get_engine()
        assert engine1 is not None
        # Call init_db again -- should dispose the first engine
        init_db(db_path)
        engine2 = get_engine()
        assert engine2 is not None


class TestDatabaseLocationErrors:
    """A DB directory the process cannot write must fail with an actionable error.

    SQLite otherwise surfaces this as a bare "unable to open database file" at
    the bottom of a long SQLAlchemy traceback -- the failure a user reported
    when bind-mounting a host directory the container's uid does not own.
    """

    def test_unwritable_directory_raises_actionable_error(self, tmp_path: Path) -> None:
        from app.database import DatabaseLocationError, init_db

        data_dir = tmp_path / "data"
        data_dir.mkdir()
        data_dir.chmod(0o500)  # r-x: exists, but not writable
        try:
            with pytest.raises(DatabaseLocationError) as excinfo:
                init_db(data_dir / "homelab-ops.db")
        finally:
            data_dir.chmod(0o700)

        message = str(excinfo.value)
        assert str(data_dir) in message
        assert "not writable" in message
        assert "HOMELAB_OPS_DB_PATH" in message

    def test_uncreatable_directory_raises_actionable_error(self, tmp_path: Path) -> None:
        from app.database import DatabaseLocationError, init_db

        parent = tmp_path / "locked"
        parent.mkdir()
        parent.chmod(0o500)  # cannot create children here
        try:
            with pytest.raises(DatabaseLocationError) as excinfo:
                init_db(parent / "nested" / "homelab-ops.db")
        finally:
            parent.chmod(0o700)

        message = str(excinfo.value)
        assert "Cannot create the database directory" in message
        assert "HOMELAB_OPS_DB_PATH" in message

    def test_writable_directory_still_initializes(self, db_path: Path) -> None:
        from app.database import init_db

        engine = init_db(db_path)
        assert engine is not None
        assert db_path.exists()

    def test_describe_dir_handles_a_missing_directory(self) -> None:
        from app.database import _describe_dir

        assert _describe_dir(Path("/nonexistent-path-for-tests")) == "unavailable"
