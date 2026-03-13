"""Router for AI-powered firewall rule analysis."""

import structlog
from fastapi import APIRouter
from pydantic import BaseModel

from app.models import AiAnalysisResult, Rule
from app.services.ai_analyzer import analyze_with_ai
from app.services.analyzer import analyze_zone_pair

log = structlog.get_logger()

router = APIRouter(prefix="/api", tags=["analyze"])


class AnalyzeRequest(BaseModel):
    source_zone_name: str
    destination_zone_name: str
    rules: list[Rule]


@router.post("/analyze", response_model=AiAnalysisResult)
async def analyze(body: AnalyzeRequest) -> AiAnalysisResult:
    log.info(
        "ai_analysis_requested",
        src_zone=body.source_zone_name, dst_zone=body.destination_zone_name, rule_count=len(body.rules),
    )
    # Run static analysis to provide context to the AI
    static_result = analyze_zone_pair(
        body.rules, body.source_zone_name, body.destination_zone_name,
    )
    result = await analyze_with_ai(
        body.rules,
        body.source_zone_name,
        body.destination_zone_name,
        static_findings=static_result.findings,
    )
    log.info("ai_analysis_complete", status=result.status, finding_count=len(result.findings))
    return result
