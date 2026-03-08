import pytest
from httpx import ASGITransport, AsyncClient

from app.config import clear_runtime_credentials
from app.main import app


@pytest.fixture(autouse=True)
def _clean_runtime_credentials() -> None:  # type: ignore[misc]
    """Ensure runtime credentials are cleared before and after each test."""
    clear_runtime_credentials()
    yield  # type: ignore[misc]
    clear_runtime_credentials()


@pytest.fixture
async def client() -> AsyncClient:  # type: ignore[misc]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac  # type: ignore[misc]
