"""Database setup using SQLAlchemy and Alembic."""

import gc
import os
import stat
from pathlib import Path

import structlog
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models_db import Base

log = structlog.get_logger()

# HOMELAB_OPS_DB_PATH is preferred; keep legacy spellings as fallbacks.
DEFAULT_DB_PATH = Path(
    os.environ.get(
        "HOMELAB_OPS_DB_PATH",
        os.environ.get("ANALYSER_DB_PATH", os.environ.get("ANALYZER_DB_PATH", "data/homelab-ops.db")),
    )
)

_engine: Engine | None = None
_SessionFactory: sessionmaker[Session] | None = None


def _make_url(db_path: Path) -> str:
    return f"sqlite:///{db_path}"


class DatabaseLocationError(RuntimeError):
    """The configured database directory is missing or not writable."""


def _describe_dir(directory: Path) -> str:
    """Describe a directory's ownership and mode, for the error message."""
    try:
        info = directory.stat()
    except OSError:
        return "unavailable"
    return f"uid={info.st_uid} gid={info.st_gid} mode={stat.filemode(info.st_mode)}"


def _process_identity() -> str:
    """Describe the running process identity, for the error message."""
    return f"uid={os.getuid()} gid={os.getgid()}"


_PERMISSION_HINT = (
    "Set HOMELAB_OPS_DB_PATH to a writable location, or make the mount writable "
    "by the container user -- a named volume (`-v homelab-ops-data:/data`) inherits "
    "the right ownership, while a bind-mounted host directory keeps the host's and "
    "must be chown'ed to the container's uid."
)


def _ensure_writable(db_path: Path) -> None:
    """Fail early and legibly when the database directory cannot be written.

    SQLite reports an unwritable directory as a bare "unable to open database
    file" wrapped in a long SQLAlchemy traceback, which says nothing about the
    path or why it failed. Check first so the operator gets an actionable line.
    """
    directory = db_path.parent
    try:
        directory.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        msg = (
            f"Cannot create the database directory {directory} ({exc.strerror}). "
            f"Process {_process_identity()}. {_PERMISSION_HINT}"
        )
        log.error("database_directory_uncreatable", path=str(directory), error=str(exc))
        raise DatabaseLocationError(msg) from exc

    if not os.access(directory, os.W_OK | os.X_OK):
        msg = (
            f"The database directory {directory} is not writable. "
            f"Process {_process_identity()}, directory {_describe_dir(directory)}. "
            f"{_PERMISSION_HINT}"
        )
        log.error(
            "database_directory_not_writable",
            path=str(directory),
            process=_process_identity(),
            directory=_describe_dir(directory),
        )
        raise DatabaseLocationError(msg)


def init_db(db_path: Path = DEFAULT_DB_PATH) -> Engine:
    """Initialize the database engine, run migrations, and return the engine."""
    global _engine, _SessionFactory  # noqa: PLW0603
    _ensure_writable(db_path)

    if _engine is not None:
        _engine.dispose()
    _engine = create_engine(_make_url(db_path), echo=False)
    _SessionFactory = sessionmaker(bind=_engine)

    _run_migrations(db_path)
    return _engine


def _run_migrations(db_path: Path) -> None:
    """Run Alembic migrations programmatically using the existing engine."""
    from alembic.config import Config

    from alembic import command

    assert _engine is not None
    alembic_cfg = Config()
    alembic_cfg.set_main_option("script_location", str(Path(__file__).parent.parent / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", _make_url(db_path))
    with _engine.begin() as connection:
        alembic_cfg.attributes["connection"] = connection
        command.upgrade(alembic_cfg, "head")


def get_engine() -> Engine:
    """Get the current engine. Raises if init_db has not been called."""
    if _engine is None:
        msg = "Database not initialized. Call init_db() first."
        raise RuntimeError(msg)
    return _engine


def get_session() -> Session:
    """Create a new session. Caller is responsible for closing it."""
    if _SessionFactory is None:
        msg = "Database not initialized. Call init_db() first."
        raise RuntimeError(msg)
    return _SessionFactory()


def init_db_for_tests(db_path: Path) -> Engine:
    """Initialize a test database with tables created directly (no Alembic)."""
    global _engine, _SessionFactory  # noqa: PLW0603
    db_path.parent.mkdir(parents=True, exist_ok=True)

    if _engine is not None:
        _engine.dispose()
    _engine = create_engine(_make_url(db_path), echo=False)
    _SessionFactory = sessionmaker(bind=_engine)

    Base.metadata.create_all(_engine)
    return _engine


def reset_engine() -> None:
    """Reset the global engine and session factory. Used in tests."""
    global _engine, _SessionFactory  # noqa: PLW0603
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionFactory = None
    gc.collect()
