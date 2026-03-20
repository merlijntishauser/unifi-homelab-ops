from dataclasses import dataclass
from threading import Lock
from typing import Annotated, Literal

from fastapi import Depends, HTTPException
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    unifi_url: str = ""
    unifi_site: str = "default"
    unifi_user: str = ""
    unifi_pass: str = ""
    unifi_verify_ssl: bool = False
    app_password: str = ""
    app_session_ttl: int = 86400  # 24 hours in seconds

    model_config = {"env_file": ".env"}


settings = Settings()


@dataclass(frozen=True)
class UnifiCredentials:
    url: str
    username: str
    password: str
    site: str = "default"
    verify_ssl: bool = False


_runtime_credentials: UnifiCredentials | None = None
_credentials_lock = Lock()


def set_runtime_credentials(
    url: str,
    username: str,
    password: str,
    site: str = "default",
    verify_ssl: bool = False,
) -> None:
    global _runtime_credentials
    with _credentials_lock:
        _runtime_credentials = UnifiCredentials(
            url=url,
            username=username,
            password=password,
            site=site,
            verify_ssl=verify_ssl,
        )


def clear_runtime_credentials() -> None:
    global _runtime_credentials
    with _credentials_lock:
        _runtime_credentials = None


def get_unifi_config() -> UnifiCredentials | None:
    """Return credentials with runtime overrides taking priority over env vars."""
    with _credentials_lock:
        if _runtime_credentials is not None:
            return _runtime_credentials

    if settings.unifi_url and settings.unifi_user and settings.unifi_pass:
        return UnifiCredentials(
            url=settings.unifi_url,
            username=settings.unifi_user,
            password=settings.unifi_pass,
            site=settings.unifi_site,
            verify_ssl=settings.unifi_verify_ssl,
        )

    return None


def has_credentials() -> bool:
    """Check if any credentials are configured (runtime or env)."""
    return get_unifi_config() is not None


def get_credential_source() -> Literal["runtime", "env", "none"]:
    """Return 'runtime', 'env', or 'none' depending on where credentials come from."""
    with _credentials_lock:
        if _runtime_credentials is not None:
            return "runtime"
    if settings.unifi_url and settings.unifi_user and settings.unifi_pass:
        return "env"
    return "none"


def _require_credentials() -> UnifiCredentials:
    """FastAPI dependency that returns validated credentials or raises 401."""
    credentials = get_unifi_config()
    if credentials is None:
        raise HTTPException(status_code=401, detail="No credentials configured")
    return credentials


RequireCredentials = Annotated[UnifiCredentials, Depends(_require_credentials)]
