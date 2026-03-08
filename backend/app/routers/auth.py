from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import (
    clear_runtime_credentials,
    get_unifi_config,
    set_runtime_credentials,
    settings,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    url: str
    username: str
    password: str
    site: str = "default"
    verify_ssl: bool = False


class LoginResponse(BaseModel):
    status: str
    message: str


class LogoutResponse(BaseModel):
    status: str
    message: str


class AuthStatusResponse(BaseModel):
    configured: bool
    source: Literal["env", "runtime", "none"]
    url: str


@router.post("/login")
async def login(request: LoginRequest) -> LoginResponse:
    set_runtime_credentials(
        url=request.url,
        username=request.username,
        password=request.password,
        site=request.site,
        verify_ssl=request.verify_ssl,
    )
    return LoginResponse(status="ok", message="Credentials stored")


@router.post("/logout")
async def logout() -> LogoutResponse:
    clear_runtime_credentials()
    return LogoutResponse(status="ok", message="Credentials cleared")


@router.get("/status")
async def status() -> AuthStatusResponse:
    config = get_unifi_config()
    if config is None:
        return AuthStatusResponse(configured=False, source="none", url="")

    # Determine if the active credentials come from runtime or env
    env_has_creds = bool(settings.unifi_url and settings.unifi_user and settings.unifi_pass)
    if env_has_creds and config.url == settings.unifi_url:
        # Could be env if no runtime override, but runtime takes priority.
        # We need to check if runtime credentials exist.
        from app.config import _credentials_lock, _runtime_credentials

        with _credentials_lock:
            source: Literal["env", "runtime", "none"] = "runtime" if _runtime_credentials is not None else "env"
    else:
        source = "runtime"

    return AuthStatusResponse(configured=True, source=source, url=config.url)
