"""Tests for the variable expression resolver."""

import os
from types import SimpleNamespace

import pytest

from app.services.variable_resolver import resolve_all_expressions, resolve_expression


pytestmark = pytest.mark.anyio


def _make_user(name: str = "Alice", user_id: str = "u123", email: str = "alice@example.com"):
    return SimpleNamespace(name=name, id=user_id, email=email, username=name.lower())


async def test_resolve_user_name():
    ctx = {"user": _make_user()}
    result = await resolve_expression("Hello {{user.name}}", ctx)
    assert result == "Hello Alice"


async def test_resolve_user_id():
    ctx = {"user": _make_user()}
    result = await resolve_expression("ID: {{user.id}}", ctx)
    assert result == "ID: u123"


async def test_resolve_user_email():
    ctx = {"user": _make_user(email="bob@test.com")}
    result = await resolve_expression("{{user.email}}", ctx)
    assert result == "bob@test.com"


async def test_resolve_component_value():
    ctx = {
        "component_state": {
            "input1": {"value": "typed text"},
        },
    }
    result = await resolve_expression("You typed: {{component.input1.value}}", ctx)
    assert result == "You typed: typed text"


async def test_resolve_self_value():
    ctx = {
        "self_id": "slider1",
        "component_state": {
            "slider1": {"value": "42"},
        },
    }
    result = await resolve_expression("Value is {{self.value}}", ctx)
    assert result == "Value is 42"


async def test_resolve_custom_variable():
    ctx = {
        "custom_variables": {"theme": "dark"},
    }
    result = await resolve_expression("Theme: {{custom.theme}}", ctx)
    assert result == "Theme: dark"


async def test_resolve_env_variable():
    os.environ["TEST_HELM_VAR"] = "secret123"
    try:
        ctx = {}
        result = await resolve_expression("Key: {{env.TEST_HELM_VAR}}", ctx)
        assert result == "Key: secret123"
    finally:
        del os.environ["TEST_HELM_VAR"]


async def test_resolve_data_source():
    ctx = {
        "data_cache": {
            "weather": {"temperature": "22C", "city": "London"},
        },
    }
    result = await resolve_expression("Temp: {{data.weather.temperature}}", ctx)
    assert result == "Temp: 22C"


async def test_unresolved_expression_returns_original():
    ctx = {}
    result = await resolve_expression("{{unknown.thing}}", ctx)
    assert result == "{{unknown.thing}}"


async def test_multiple_expressions_in_one_string():
    ctx = {
        "user": _make_user(),
        "custom_variables": {"greeting": "Hi"},
    }
    result = await resolve_expression("{{custom.greeting}} {{user.name}}!", ctx)
    assert result == "Hi Alice!"


async def test_mixed_resolved_and_unresolved():
    ctx = {"user": _make_user()}
    result = await resolve_expression("{{user.name}} - {{unknown.x}}", ctx)
    assert result == "Alice - {{unknown.x}}"


async def test_resolve_all_expressions_nested_dict():
    ctx = {
        "user": _make_user(),
        "custom_variables": {"color": "blue"},
    }
    payload = {
        "title": "Hello {{user.name}}",
        "style": {
            "backgroundColor": "{{custom.color}}",
            "nested": {
                "deep": "{{user.email}}",
            },
        },
        "items": [
            "{{user.id}}",
            "literal",
            {"label": "{{custom.color}}"},
        ],
        "count": 42,
    }
    result = await resolve_all_expressions(payload, ctx)
    assert result["title"] == "Hello Alice"
    assert result["style"]["backgroundColor"] == "blue"
    assert result["style"]["nested"]["deep"] == "alice@example.com"
    assert result["items"][0] == "u123"
    assert result["items"][1] == "literal"
    assert result["items"][2]["label"] == "blue"
    assert result["count"] == 42


async def test_resolve_all_expressions_preserves_non_strings():
    ctx = {}
    payload = {"number": 123, "flag": True, "nothing": None}
    result = await resolve_all_expressions(payload, ctx)
    assert result == payload


async def test_no_expressions_passthrough():
    ctx = {"user": _make_user()}
    result = await resolve_expression("No expressions here", ctx)
    assert result == "No expressions here"


async def test_resolve_connection_from_cache():
    ctx = {
        "connections_cache": {
            "weather_api": {"api_key": "secret123", "endpoint": "https://api.weather.com"},
        },
    }
    result = await resolve_expression("Key: {{connection.weather_api.api_key}}", ctx)
    assert result == "Key: secret123"


async def test_resolve_connection_from_db(db_session, test_user):
    """Test connection resolution by querying the database."""
    from app.config import settings
    from app.models.connection import Connection
    from app.routers.connections import _encrypt_credentials

    # Create a connection in the database
    connection = Connection(
        id="conn123",
        user_id=test_user.id,
        name="weather_api",
        provider="openweather",
        credentials_encrypted=_encrypt_credentials({"api_key": "db_secret_456"}),
    )
    db_session.add(connection)
    await db_session.commit()

    ctx = {
        "db": db_session,
        "user_id": test_user.id,
        "encryption_key": settings.encryption_key,
        "connections_cache": {},
    }
    result = await resolve_expression("API Key: {{connection.weather_api.api_key}}", ctx)
    assert result == "API Key: db_secret_456"

    # Verify cache was populated
    assert "weather_api" in ctx["connections_cache"]
    assert ctx["connections_cache"]["weather_api"]["api_key"] == "db_secret_456"


async def test_resolve_connection_not_found():
    """Connection not found should return original expression."""
    ctx = {
        "connections_cache": {},
    }
    result = await resolve_expression("{{connection.nonexistent.api_key}}", ctx)
    assert result == "{{connection.nonexistent.api_key}}"


async def test_resolve_connection_missing_credential_key():
    """Missing credential key should return original expression."""
    ctx = {
        "connections_cache": {
            "weather_api": {"api_key": "secret123"},
        },
    }
    result = await resolve_expression("{{connection.weather_api.missing_key}}", ctx)
    assert result == "{{connection.weather_api.missing_key}}"
