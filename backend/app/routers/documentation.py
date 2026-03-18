"""Router for documentation generator endpoints."""

import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.config import get_unifi_config, has_credentials
from app.models import DocumentationResponse
from app.services.documentation import get_documentation_export, get_documentation_sections

log = structlog.get_logger()

router = APIRouter(tags=["documentation"])


@router.get("/sections")
async def documentation_sections() -> DocumentationResponse:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None

    sections = get_documentation_sections(credentials)
    log.info("documentation_sections_served", section_count=len(sections))
    return DocumentationResponse(sections=sections)


@router.get("/export")
async def documentation_export() -> Response:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None

    markdown = get_documentation_export(credentials)
    log.info("documentation_export_served", length=len(markdown))
    return Response(content=markdown, media_type="text/markdown")
