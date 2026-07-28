"""Shared AI provider calling utilities.

Used by ai_analyzer (firewall zone pair analysis) and site_health (cross-domain analysis).
"""

from __future__ import annotations

from typing import Any

import httpx

# Enough of the body to identify what answered; short enough not to dump a
# provider response (or whatever a proxy substituted for it) into the logs.
_SNIPPET_LIMIT = 200


class AiProviderResponseError(RuntimeError):
    """The provider answered, but not with the shape this client can read.

    Raised instead of letting a bare KeyError/IndexError/JSONDecodeError escape:
    those reach the callers' catch-all and surface as "Unexpected error during
    AI analysis", which says nothing about the provider or what it sent.
    """


def _describe(resp: httpx.Response) -> str:
    """Summarize a response for an error message, without dumping the body."""
    content_type = resp.headers.get("content-type", "unknown")
    body = resp.text or ""
    snippet = body[:_SNIPPET_LIMIT].replace("\n", " ").strip()
    suffix = "..." if len(body) > _SNIPPET_LIMIT else ""
    return f"HTTP {resp.status_code}, content-type {content_type}, body: {snippet}{suffix}"


def _extract(resp: httpx.Response, provider: str, *path: str | int) -> str:
    """Walk `path` through the JSON body, reporting what arrived if it does not fit."""
    try:
        payload: Any = resp.json()
    except ValueError as exc:
        msg = f"{provider} returned a non-JSON response ({_describe(resp)})"
        raise AiProviderResponseError(msg) from exc

    cursor: Any = payload
    for key in path:
        try:
            cursor = cursor[key]
        except (KeyError, IndexError, TypeError) as exc:
            trail = "".join(f"[{k!r}]" for k in path)
            msg = (
                f"{provider} returned an unexpected response shape: no {trail} "
                f"({_describe(resp)})"
            )
            raise AiProviderResponseError(msg) from exc

    if not isinstance(cursor, str):
        trail = "".join(f"[{k!r}]" for k in path)
        msg = f"{provider} returned a non-string value at {trail} ({_describe(resp)})"
        raise AiProviderResponseError(msg)
    return cursor


def call_openai(
    base_url: str, api_key: str, model: str, system_prompt: str, user_prompt: str
) -> str:
    """Call an OpenAI-compatible API."""
    url = f"{base_url}/chat/completions"
    resp = httpx.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    return _extract(resp, "OpenAI-compatible provider", "choices", 0, "message", "content")


def call_anthropic(
    base_url: str, api_key: str, model: str, system_prompt: str, user_prompt: str
) -> str:
    """Call the Anthropic API."""
    url = f"{base_url}/messages"
    resp = httpx.post(
        url,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    return _extract_anthropic_text(resp)


def _extract_anthropic_text(resp: httpx.Response) -> str:
    """Return the first text block, skipping any the model emits ahead of it.

    `content` is a list of typed blocks, and text is not guaranteed to be
    first: current Claude models return a `thinking` block ahead of it, so
    indexing `content[0]["text"]` raises KeyError as soon as the model
    reasons before answering. Selecting by type is stable whether or not a
    thinking block is present.
    """
    try:
        payload: Any = resp.json()
    except ValueError as exc:
        msg = f"Anthropic returned a non-JSON response ({_describe(resp)})"
        raise AiProviderResponseError(msg) from exc

    blocks = payload.get("content") if isinstance(payload, dict) else None
    if not isinstance(blocks, list):
        msg = f"Anthropic returned an unexpected response shape: no ['content'] list ({_describe(resp)})"
        raise AiProviderResponseError(msg)

    for block in blocks:
        if not isinstance(block, dict):
            continue
        # A real response always carries `type`; default to "text" so a block
        # that omits it is still read rather than silently skipped.
        if block.get("type", "text") != "text":
            continue
        text = block.get("text")
        if not isinstance(text, str):
            msg = f"Anthropic returned a non-string text block ({_describe(resp)})"
            raise AiProviderResponseError(msg)
        return text

    types = ", ".join(str(b.get("type")) for b in blocks if isinstance(b, dict)) or "none"
    stop = payload.get("stop_reason")
    msg = (
        f"Anthropic returned no text block (block types: {types}; "
        f"stop_reason: {stop}) ({_describe(resp)})"
    )
    raise AiProviderResponseError(msg)
