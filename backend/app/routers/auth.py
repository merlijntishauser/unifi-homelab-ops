import logging
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import (
    clear_runtime_credentials,
    get_credential_source,
    get_unifi_config,
    set_runtime_credentials,
)

logger = logging.getLogger(__name__)

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
    username: str


@router.post("/login")
async def login(request: LoginRequest) -> LoginResponse:
    logger.debug("Login attempt: url=%s, user=%s, site=%s", request.url, request.username, request.site)
    set_runtime_credentials(
        url=request.url,
        username=request.username,
        password=request.password,
        site=request.site,
        verify_ssl=request.verify_ssl,
    )
    logger.debug("Login credentials stored")
    return LoginResponse(status="ok", message="Credentials stored")


@router.post("/logout")
async def logout() -> LogoutResponse:
    logger.debug("Logout requested")
    clear_runtime_credentials()
    return LogoutResponse(status="ok", message="Credentials cleared")


@router.get("/status")
async def status() -> AuthStatusResponse:
    config = get_unifi_config()
    source = get_credential_source()
    logger.debug("Auth status check: source=%s, configured=%s", source, config is not None)

    if config is None:
        return AuthStatusResponse(configured=False, source="none", url="", username="")

    return AuthStatusResponse(configured=True, source=source, url=config.url, username=config.username)
