"""Router for site health endpoints."""

import asyncio

import structlog
from fastapi import APIRouter

from app.config import RequireCredentials
from app.models import HealthAnalysisResult, HealthSummaryResponse
from app.services.site_health import analyze_site_health, get_health_summary

log = structlog.get_logger()

router = APIRouter(tags=["health"])


@router.get("/summary")
async def health_summary(credentials: RequireCredentials) -> HealthSummaryResponse:
    return await asyncio.to_thread(get_health_summary, credentials)


@router.post("/analyze")
async def health_analyze(credentials: RequireCredentials) -> HealthAnalysisResult:
    log.info("health_analysis_requested")
    result = await analyze_site_health(credentials)
    log.info("health_analysis_complete", status=result.status, finding_count=len(result.findings))
    return result
