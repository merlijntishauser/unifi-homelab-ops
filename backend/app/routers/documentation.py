"""Router for documentation generator endpoints."""

import asyncio

import structlog
from fastapi import APIRouter
from fastapi.responses import Response

from app.config import RequireCredentials
from app.models import DocumentationResponse
from app.services.documentation import get_documentation_export, get_documentation_sections

log = structlog.get_logger()

router = APIRouter(tags=["documentation"])


@router.get("/sections")
async def documentation_sections(credentials: RequireCredentials) -> DocumentationResponse:
    sections = await asyncio.to_thread(get_documentation_sections, credentials)
    log.info("documentation_sections_served", section_count=len(sections))
    return DocumentationResponse(sections=sections)


@router.get("/export")
async def documentation_export(credentials: RequireCredentials) -> Response:
    markdown = await asyncio.to_thread(get_documentation_export, credentials)
    log.info("documentation_export_served", length=len(markdown))
    return Response(content=markdown, media_type="text/markdown")
