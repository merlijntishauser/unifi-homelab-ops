"""Router for AI-powered firewall rule analysis."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import DEFAULT_DB_PATH
from app.models import FindingModel, Rule
from app.services.ai_analyzer import analyze_with_ai
from app.services.ai_settings import get_ai_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analyze"])


class AnalyzeRequest(BaseModel):
    source_zone_name: str
    destination_zone_name: str
    rules: list[Rule]


class AnalyzeResponse(BaseModel):
    findings: list[FindingModel]


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    config = get_ai_config(DEFAULT_DB_PATH)
    if config is None or not config["has_key"]:
        raise HTTPException(status_code=400, detail="No AI provider configured")

    logger.debug(
        "AI analysis requested: %s -> %s (%d rules)",
        body.source_zone_name, body.destination_zone_name, len(body.rules),
    )
    findings = await analyze_with_ai(
        body.rules,
        body.source_zone_name,
        body.destination_zone_name,
        db_path=DEFAULT_DB_PATH,
    )
    logger.debug("AI analysis returned %d findings", len(findings))
    return AnalyzeResponse(findings=findings)
