"""Tests for keel_server.registry.ActionRegistry."""

import pytest

from keel_server.registry import ActionRegistry


@pytest.fixture
def registry() -> ActionRegistry:
    return ActionRegistry()


class TestActionRegistry:
    @pytest.mark.asyncio
    async def test_register_and_execute(self, registry: ActionRegistry):
        async def greet(greeting: str = "Hello") -> dict:
            return {"message": f"{greeting}, World!"}

        registry.register("greet", greet)
        result = await registry.execute("greet", greeting="Hi")
        assert result == {"message": "Hi, World!"}

    @pytest.mark.asyncio
    async def test_execute_unknown_action(self, registry: ActionRegistry):
        with pytest.raises(ValueError, match="Unknown action"):
            await registry.execute("nonexistent")

    def test_list_actions_empty(self, registry: ActionRegistry):
        assert registry.list_actions() == []

    def test_list_actions(self, registry: ActionRegistry):
        registry.register("a", lambda: None)
        registry.register("b", lambda: None)
        assert sorted(registry.list_actions()) == ["a", "b"]

    @pytest.mark.asyncio
    async def test_async_handler_with_kwargs(self, registry: ActionRegistry):
        async def add(a: int, b: int) -> int:
            return a + b

        registry.register("add", add)
        result = await registry.execute("add", a=1, b=2)
        assert result == 3
