"""Tests for todos endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_todo(auth_client: AsyncClient):
    """Test creating a new todo item."""
    response = await auth_client.post(
        "/api/todos",
        json={"text": "Buy groceries", "completed": False}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["text"] == "Buy groceries"
    assert data["completed"] is False
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_list_todos(auth_client: AsyncClient):
    """Test listing all todos for the current user."""
    # Create a few todos
    await auth_client.post("/api/todos", json={"text": "Task 1", "completed": False})
    await auth_client.post("/api/todos", json={"text": "Task 2", "completed": True})
    await auth_client.post("/api/todos", json={"text": "Task 3", "completed": False})

    # List todos
    response = await auth_client.get("/api/todos")
    assert response.status_code == 200
    data = response.json()
    assert "todos" in data
    assert len(data["todos"]) == 3
    # Verify all three tasks exist (order may vary when created_at is identical)
    texts = {todo["text"] for todo in data["todos"]}
    assert texts == {"Task 1", "Task 2", "Task 3"}
    # Verify completed status
    completed_map = {todo["text"]: todo["completed"] for todo in data["todos"]}
    assert completed_map["Task 1"] is False
    assert completed_map["Task 2"] is True
    assert completed_map["Task 3"] is False


@pytest.mark.asyncio
async def test_update_todo_text(auth_client: AsyncClient):
    """Test updating a todo's text."""
    # Create a todo
    create_response = await auth_client.post(
        "/api/todos",
        json={"text": "Original text", "completed": False}
    )
    todo_id = create_response.json()["id"]

    # Update the text
    response = await auth_client.patch(
        f"/api/todos/{todo_id}",
        json={"text": "Updated text"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Updated text"
    assert data["completed"] is False


@pytest.mark.asyncio
async def test_update_todo_completed(auth_client: AsyncClient):
    """Test toggling a todo's completed status."""
    # Create a todo
    create_response = await auth_client.post(
        "/api/todos",
        json={"text": "Task to complete", "completed": False}
    )
    todo_id = create_response.json()["id"]

    # Mark as completed
    response = await auth_client.patch(
        f"/api/todos/{todo_id}",
        json={"completed": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["completed"] is True
    assert data["text"] == "Task to complete"

    # Mark as incomplete
    response = await auth_client.patch(
        f"/api/todos/{todo_id}",
        json={"completed": False}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["completed"] is False


@pytest.mark.asyncio
async def test_update_todo_both_fields(auth_client: AsyncClient):
    """Test updating both text and completed status."""
    # Create a todo
    create_response = await auth_client.post(
        "/api/todos",
        json={"text": "Original", "completed": False}
    )
    todo_id = create_response.json()["id"]

    # Update both fields
    response = await auth_client.patch(
        f"/api/todos/{todo_id}",
        json={"text": "Modified", "completed": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Modified"
    assert data["completed"] is True


@pytest.mark.asyncio
async def test_update_nonexistent_todo(auth_client: AsyncClient):
    """Test updating a todo that doesn't exist."""
    response = await auth_client.patch(
        "/api/todos/nonexistent-id",
        json={"text": "Updated"}
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_todo(auth_client: AsyncClient):
    """Test deleting a todo."""
    # Create a todo
    create_response = await auth_client.post(
        "/api/todos",
        json={"text": "To be deleted", "completed": False}
    )
    todo_id = create_response.json()["id"]

    # Delete it
    response = await auth_client.delete(f"/api/todos/{todo_id}")
    assert response.status_code == 200
    assert "deleted" in response.json()["message"].lower()

    # Verify it's gone
    list_response = await auth_client.get("/api/todos")
    todos = list_response.json()["todos"]
    assert not any(t["id"] == todo_id for t in todos)


@pytest.mark.asyncio
async def test_delete_nonexistent_todo(auth_client: AsyncClient):
    """Test deleting a todo that doesn't exist."""
    response = await auth_client.delete("/api/todos/nonexistent-id")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_todos_are_user_scoped(auth_client: AsyncClient):
    """Test that users can only see their own todos."""
    # Create a todo as the authenticated user
    response = await auth_client.post(
        "/api/todos",
        json={"text": "My todo", "completed": False}
    )
    assert response.status_code == 201

    # List todos - should only see our own
    list_response = await auth_client.get("/api/todos")
    todos = list_response.json()["todos"]
    assert all(t["text"] == "My todo" for t in todos if t["text"] == "My todo")


@pytest.mark.asyncio
async def test_create_todo_with_completed_true(auth_client: AsyncClient):
    """Test creating a todo that's already completed."""
    response = await auth_client.post(
        "/api/todos",
        json={"text": "Already done", "completed": True}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["text"] == "Already done"
    assert data["completed"] is True


@pytest.mark.asyncio
async def test_create_todo_defaults_to_incomplete(auth_client: AsyncClient):
    """Test that completed defaults to False if not provided."""
    response = await auth_client.post(
        "/api/todos",
        json={"text": "New task"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["completed"] is False
