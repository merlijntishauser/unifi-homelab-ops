import hmac
import logging
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import (
    clear_runtime_credentials,
    get_credential_source,
    get_unifi_config,
    set_runtime_credentials,
    settings,
)
from app.middleware import COOKIE_NAME, create_session_cookie, verify_session_cookie
from app.models import AppAuthStatus, AppLoginInput

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


@router.post("/app-login")
async def app_login(body: AppLoginInput) -> JSONResponse:
    secret = settings.app_password
    if not secret:
        return JSONResponse(status_code=400, content={"detail": "App auth is not enabled"})

    if not hmac.compare_digest(body.password.encode(), secret.encode()):
        logger.debug("App login failed: wrong password")
        return JSONResponse(status_code=401, content={"detail": "Invalid password"})

    cookie_value, max_age = create_session_cookie(secret, settings.app_session_ttl)
    logger.debug("App login succeeded")
    response = JSONResponse(content={"status": "ok"})
    response.set_cookie(
        COOKIE_NAME,
        cookie_value,
        httponly=True,
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
