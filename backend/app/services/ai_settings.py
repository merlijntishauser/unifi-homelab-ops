"""AI configuration storage and retrieval."""

import os
from pathlib import Path

import structlog

from app.database import get_session
from app.models_db import AiAnalysisSettingsRow, AiConfigRow

log = structlog.get_logger()


def _read_key_from_file() -> str:
    """Read AI API key from file path specified in AI_API_KEY_FILE env var."""
    key_file = os.environ.get("AI_API_KEY_FILE")
    if not key_file:
        return ""
    try:
        return Path(key_file).read_text().strip()
    except OSError:
        log.warning("ai_key_file_unreadable", path=key_file)
        return ""


def _get_env_api_key() -> str:
    """Get AI API key from env var or file, with env var taking priority."""
    return os.environ.get("AI_API_KEY") or _read_key_from_file()


def get_ai_config() -> dict[str, object]:
    """Get AI config. Returns dict with has_key (bool) instead of actual key, plus source field."""
    base_url = os.environ.get("AI_BASE_URL")
    api_key = _get_env_api_key()
    model = os.environ.get("AI_MODEL")
    provider_type = os.environ.get("AI_PROVIDER_TYPE", "openai")

    if base_url and api_key and model:
        log.debug("ai_config_source", source="env", provider=provider_type, model=model)
        return {
            "base_url": base_url,
            "model": model,
            "provider_type": provider_type,
            "has_key": True,
            "key_source": "env",
            "source": "env",
        }

    session = get_session()
    try:
        row = session.get(AiConfigRow, 1)
    finally:
        session.close()

    if row is None:
        has_env_key = bool(api_key)
        log.debug("ai_config_source", source="none", has_env_key=has_env_key)
        return {
            "base_url": "",
            "model": "",
            "provider_type": "",
            "has_key": has_env_key,
            "key_source": "env" if has_env_key else "none",
            "source": "none",
        }

    env_key = _get_env_api_key()
    db_has_key = bool(row.api_key)
    has_env_key = bool(env_key)
    key_source = "db" if db_has_key else ("env" if has_env_key else "none")
    log.debug("ai_config_source", source="db", provider=row.provider_type, model=row.model, key_source=key_source)
    return {
        "base_url": row.base_url,
        "model": row.model,
        "provider_type": row.provider_type,
        "has_key": db_has_key or has_env_key,
        "key_source": key_source,
        "source": "db",
    }


def get_full_ai_config() -> dict[str, str] | None:
    """Get full AI config including API key (for internal use only)."""
    base_url = os.environ.get("AI_BASE_URL")
    api_key = _get_env_api_key()
    model = os.environ.get("AI_MODEL")
    provider_type = os.environ.get("AI_PROVIDER_TYPE", "openai")

    if base_url and api_key and model:
        log.debug("ai_full_config_source", source="env", provider=provider_type, model=model)
        return {
            "base_url": base_url,
            "api_key": api_key,
            "model": model,
            "provider_type": provider_type,
        }

    session = get_session()
    try:
        row = session.get(AiConfigRow, 1)
    finally:
        session.close()

    if row is None:
        log.debug("ai_full_config_source", source="none")
        return None

    # Use env API key as fallback when DB key is empty
    effective_key = row.api_key or api_key
    log.debug("ai_full_config_source", source="db", provider=row.provider_type, model=row.model)
    return {
        "base_url": row.base_url,
        "api_key": effective_key,
        "model": row.model,
        "provider_type": row.provider_type,
    }


def save_ai_config(base_url: str, api_key: str, model: str, provider_type: str) -> None:
    """Save AI config (upsert). If api_key is empty, preserves the existing key."""
    log.info("ai_config_save", provider=provider_type, model=model)
    session = get_session()
    try:
        row = session.get(AiConfigRow, 1)
        if row is None:
            row = AiConfigRow(base_url=base_url, api_key=api_key, model=model, provider_type=provider_type)
            session.add(row)
        else:
            row.base_url = base_url
            row.model = model
            row.provider_type = provider_type
            if api_key:
                row.api_key = api_key
        session.commit()
    finally:
        session.close()


def delete_ai_config() -> None:
    """Delete AI config."""
    log.info("ai_config_delete")
    session = get_session()
    try:
        row = session.get(AiConfigRow, 1)
        if row is not None:
            session.delete(row)
            session.commit()
    finally:
        session.close()


_VALID_SITE_PROFILES = {"homelab", "smb", "enterprise"}


def get_ai_analysis_settings() -> dict[str, str]:
    """Get AI analysis settings. Returns defaults if no row exists."""
    session = get_session()
    try:
        row = session.get(AiAnalysisSettingsRow, 1)
    finally:
        session.close()

    if row is None:
        log.debug("ai_analysis_settings_defaults")
        return {"site_profile": "homelab"}

    log.debug("ai_analysis_settings_loaded", site_profile=row.site_profile)
    return {"site_profile": row.site_profile}


def save_ai_analysis_settings(site_profile: str) -> None:
    """Save AI analysis settings (upsert). Validates site_profile."""
    if site_profile not in _VALID_SITE_PROFILES:
        msg = f"Invalid site_profile '{site_profile}'. Must be one of: {', '.join(sorted(_VALID_SITE_PROFILES))}"
        raise ValueError(msg)

    log.info("ai_analysis_settings_save", site_profile=site_profile)
    session = get_session()
    try:
        row = session.get(AiAnalysisSettingsRow, 1)
        if row is None:
            row = AiAnalysisSettingsRow(site_profile=site_profile)
            session.add(row)
        else:
            row.site_profile = site_profile
        session.commit()
    finally:
        session.close()
