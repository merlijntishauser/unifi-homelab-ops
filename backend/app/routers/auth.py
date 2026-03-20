import asyncio
import hmac
from typing import Literal

import structlog
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from unifi_topology import fetch_firewall_zones
from unifi_topology.adapters.unifi_api import UnifiAuthError

from app.config import (
    clear_runtime_credentials,
    get_credential_source,
    get_unifi_config,
    set_runtime_credentials,
    settings,
)
from app.middleware import COOKIE_NAME, create_session_cookie, verify_session_cookie
from app.models import AppAuthStatus, AppLoginInput
from app.services.firewall import to_topology_config

log = structlog.get_logger()

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


@router.post("/app-login")
async def app_login(body: AppLoginInput, request: Request) -> JSONResponse:
    secret = settings.app_password
    if not secret:
        return JSONResponse(status_code=400, content={"detail": "App auth is not enabled"})

    if not hmac.compare_digest(body.password.encode(), secret.encode()):
        log.info("app_login_failed", reason="wrong_password")
        return JSONResponse(status_code=401, content={"detail": "Invalid password"})

    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    cookie_value, max_age = create_session_cookie(secret, settings.app_session_ttl)
    log.info("app_login_success")
    response = JSONResponse(content={"status": "ok"})
    response.set_cookie(
        COOKIE_NAME,
        cookie_value,
        httponly=True,
        secure=is_https,
        samesite="strict",
        max_age=max_age,
        path="/",
    )
    return response


@router.get("/app-status")
async def app_status(request: Request) -> AppAuthStatus:
    secret = settings.app_password
    if not secret:
        return AppAuthStatus(required=False, authenticated=False)

    cookie = request.cookies.get(COOKIE_NAME)
    authenticated = bool(cookie and verify_session_cookie(cookie, secret, settings.app_session_ttl))
    return AppAuthStatus(required=True, authenticated=authenticated)


@router.post("/login")
async def login(request: LoginRequest) -> LoginResponse:
    log.info("controller_login", url=request.url, user=request.username, site=request.site)

    # Validate credentials by making a lightweight call to the controller
    from app.config import UnifiCredentials

    creds = UnifiCredentials(
        url=request.url,
        username=request.username,
        password=request.password,
        site=request.site,
        verify_ssl=request.verify_ssl,
    )
    config = to_topology_config(creds)
    try:
        await asyncio.to_thread(fetch_firewall_zones, config, site=creds.site, use_cache=False)
    except UnifiAuthError as exc:
        log.warning("controller_login_failed", url=request.url, user=request.username, error=str(exc))
        return JSONResponse(status_code=401, content={"detail": "Invalid controller credentials"})  # type: ignore[return-value]
    except Exception as exc:
        log.warning("controller_login_error", url=request.url, error=str(exc))
        return JSONResponse(status_code=502, content={"detail": "Could not reach controller"})  # type: ignore[return-value]

    set_runtime_credentials(
        url=request.url,
        username=request.username,
        password=request.password,
        site=request.site,
        verify_ssl=request.verify_ssl,
    )
    return LoginResponse(status="ok", message="Credentials verified")


@router.post("/logout")
async def logout() -> LogoutResponse:
    log.info("controller_logout")
    clear_runtime_credentials()
    return LogoutResponse(status="ok", message="Credentials cleared")


@router.get("/status")
async def status() -> AuthStatusResponse:
    config = get_unifi_config()
    source = get_credential_source()
    log.debug("auth_status", source=source, configured=config is not None)

    if config is None:
        return AuthStatusResponse(configured=False, source="none", url="", username="")

    return AuthStatusResponse(configured=True, source=source, url=config.url, username=config.username)
