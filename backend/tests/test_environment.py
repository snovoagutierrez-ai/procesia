import pytest

from app.environment import is_production


@pytest.mark.parametrize("variable,value,expected", [
    ("ENV", "production", True), ("ENV", "PRODUCTION", True),
    ("ENVIRONMENT", "production", True), ("RENDER", "true", True),
    ("ENV", "development", False), ("RENDER", "false", False),
])
def test_production_detection(monkeypatch, variable, value, expected):
    for key in ("ENV", "ENVIRONMENT", "RENDER"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv(variable, value)
    assert is_production() is expected
