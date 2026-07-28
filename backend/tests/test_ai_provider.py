"""Tests for the shared AI provider client.

The point of these: a provider that answers 200 with a body this client cannot
read must produce a message naming the provider and what arrived. Before, the
bare KeyError/IndexError/JSONDecodeError escaped to the callers' catch-all and
every one of these cases surfaced as "Unexpected error during AI analysis".
"""

from __future__ import annotations

import httpx
import pytest

from app.services._ai_provider import (
    ANTHROPIC_MAX_TOKENS,
    AiProviderResponseError,
    call_anthropic,
    call_openai,
)

BASE = "https://provider.example/v1"


def _mock_post(monkeypatch: pytest.MonkeyPatch, response: httpx.Response) -> None:
    def fake_post(*_args: object, **_kwargs: object) -> httpx.Response:
        return response

    monkeypatch.setattr(httpx, "post", fake_post)


def _resp(payload: object = None, *, text: str | None = None, status: int = 200) -> httpx.Response:
    request = httpx.Request("POST", BASE)
    if text is not None:
        return httpx.Response(status, text=text, request=request)
    return httpx.Response(status, json=payload, request=request)


class TestCallOpenAiHappyPath:
    def test_returns_the_message_content(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(monkeypatch, _resp({"choices": [{"message": {"content": "hello"}}]}))
        assert call_openai(BASE, "k", "m", "sys", "user") == "hello"


class TestCallOpenAiBadShapes:
    def test_non_json_body_names_the_provider(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(monkeypatch, _resp(text="<html>502 Bad Gateway</html>"))
        with pytest.raises(AiProviderResponseError) as excinfo:
            call_openai(BASE, "k", "m", "sys", "user")
        msg = str(excinfo.value)
        assert "non-JSON" in msg
        assert "OpenAI-compatible provider" in msg

    def test_missing_choices_reports_the_path(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(monkeypatch, _resp({"error": {"message": "quota exceeded"}}))
        with pytest.raises(AiProviderResponseError) as excinfo:
            call_openai(BASE, "k", "m", "sys", "user")
        assert "unexpected response shape" in str(excinfo.value)

    def test_empty_choices_list(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(monkeypatch, _resp({"choices": []}))
        with pytest.raises(AiProviderResponseError):
            call_openai(BASE, "k", "m", "sys", "user")

    def test_non_string_content(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(monkeypatch, _resp({"choices": [{"message": {"content": {"a": 1}}}]}))
        with pytest.raises(AiProviderResponseError) as excinfo:
            call_openai(BASE, "k", "m", "sys", "user")
        assert "non-string" in str(excinfo.value)

    def test_http_error_still_raises_httpx_not_our_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Status errors keep their own handler in the callers -- don't swallow them."""
        _mock_post(monkeypatch, _resp({"error": "unauthorized"}, status=401))
        with pytest.raises(httpx.HTTPStatusError):
            call_openai(BASE, "k", "m", "sys", "user")

    def test_body_snippet_is_truncated(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(monkeypatch, _resp(text="x" * 5000))
        with pytest.raises(AiProviderResponseError) as excinfo:
            call_openai(BASE, "k", "m", "sys", "user")
        # The whole 5000-char body must not land in the message or the logs.
        assert len(str(excinfo.value)) < 400
        assert "..." in str(excinfo.value)


class TestCallAnthropic:
    def test_returns_the_text(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(monkeypatch, _resp({"content": [{"text": "hi"}]}))
        assert call_anthropic(BASE, "k", "m", "sys", "user") == "hi"

    def test_skips_a_leading_thinking_block(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # The shape current Claude models actually return: the model reasons
        # before answering, so text is not content[0]. Indexing position 0
        # raised KeyError and surfaced as "Unexpected error during AI analysis".
        _mock_post(
            monkeypatch,
            _resp(
                {
                    "content": [
                        {"type": "thinking", "thinking": "weighing the zones"},
                        {"type": "text", "text": "hi"},
                    ],
                    "stop_reason": "end_turn",
                }
            ),
        )
        assert call_anthropic(BASE, "k", "m", "sys", "user") == "hi"

    def test_no_text_block_reports_what_arrived(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # stop_reason is end_turn, not max_tokens: a truncated reply is caught
        # earlier by the token-limit guard, so this exercises the genuinely
        # odd case -- the model finished but emitted no text block at all.
        _mock_post(
            monkeypatch,
            _resp(
                {"content": [{"type": "thinking", "thinking": "..."}], "stop_reason": "end_turn"}
            ),
        )
        with pytest.raises(AiProviderResponseError) as excinfo:
            call_anthropic(BASE, "k", "m", "sys", "user")
        # The message must name the block types and why it stopped, or the
        # next person debugging this learns nothing from the log line.
        assert "thinking" in str(excinfo.value)
        assert "end_turn" in str(excinfo.value)

    def test_skips_non_dict_blocks(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """A malformed entry in the list must not abort the whole read."""
        _mock_post(
            monkeypatch,
            _resp({"content": ["stray string", {"type": "text", "text": "hi"}]}),
        )
        assert call_anthropic(BASE, "k", "m", "sys", "user") == "hi"

    def test_non_string_text_block_is_reported(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(monkeypatch, _resp({"content": [{"type": "text", "text": {"a": 1}}]}))
        with pytest.raises(AiProviderResponseError) as excinfo:
            call_anthropic(BASE, "k", "m", "sys", "user")
        assert "non-string text block" in str(excinfo.value)

    def test_bad_shape_names_anthropic(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(monkeypatch, _resp({"completion": "legacy shape"}))
        with pytest.raises(AiProviderResponseError) as excinfo:
            call_anthropic(BASE, "k", "m", "sys", "user")
        assert "Anthropic" in str(excinfo.value)

    def test_non_json_body(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(monkeypatch, _resp(text="upstream timeout"))
        with pytest.raises(AiProviderResponseError):
            call_anthropic(BASE, "k", "m", "sys", "user")


class TestTruncationIsNamed:
    """A reply cut off at the token limit is invalid JSON. Reported as a budget
    problem, not left to surface as "Failed to parse AI response"."""

    def test_anthropic_max_tokens_stop_reason(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(
            monkeypatch,
            _resp(
                {
                    "content": [{"type": "text", "text": '[{"id": "partial"'}],
                    "stop_reason": "max_tokens",
                }
            ),
        )
        with pytest.raises(AiProviderResponseError) as excinfo:
            call_anthropic(BASE, "k", "m", "sys", "user")
        msg = str(excinfo.value)
        assert "token limit" in msg
        assert "cut off" in msg

    def test_openai_length_finish_reason(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _mock_post(
            monkeypatch,
            _resp(
                {
                    "choices": [
                        {"finish_reason": "length", "message": {"content": '[{"id": "partial"'}}
                    ]
                }
            ),
        )
        with pytest.raises(AiProviderResponseError) as excinfo:
            call_openai(BASE, "k", "m", "sys", "user")
        assert "token limit" in str(excinfo.value)

    def test_normal_stop_reason_is_not_flagged(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """end_turn must pass through -- this guard must not break working calls."""
        _mock_post(
            monkeypatch,
            _resp({"content": [{"type": "text", "text": "[]"}], "stop_reason": "end_turn"}),
        )
        assert call_anthropic(BASE, "k", "m", "sys", "user") == "[]"

    def test_missing_stop_reason_is_not_flagged(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Providers that omit the field entirely still work."""
        _mock_post(monkeypatch, _resp({"choices": [{"message": {"content": "[]"}}]}))
        assert call_openai(BASE, "k", "m", "sys", "user") == "[]"

    def test_non_json_body_does_not_break_the_reason_lookup(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _mock_post(monkeypatch, _resp(text="not json"))
        with pytest.raises(AiProviderResponseError) as excinfo:
            call_openai(BASE, "k", "m", "sys", "user")
        assert "non-JSON" in str(excinfo.value)


class TestTokenBudget:
    def test_anthropic_sends_the_raised_budget(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """4096 was spent on thinking before the findings array finished."""
        captured: dict[str, object] = {}

        def fake_post(*_args: object, **kwargs: object) -> httpx.Response:
            captured.update(kwargs.get("json") or {})  # type: ignore[arg-type]
            return _resp({"content": [{"type": "text", "text": "[]"}]})

        monkeypatch.setattr(httpx, "post", fake_post)
        call_anthropic(BASE, "k", "m", "sys", "user")
        assert captured["max_tokens"] == ANTHROPIC_MAX_TOKENS
        assert ANTHROPIC_MAX_TOKENS > 4096
