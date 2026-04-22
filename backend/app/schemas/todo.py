from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TodoCreate(BaseModel):
    text: str
    completed: bool = False


class TodoUpdate(BaseModel):
    text: str | None = None
    completed: bool | None = None


class TodoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    text: str
    completed: bool
    created_at: datetime
    updated_at: datetime


class TodosResponse(BaseModel):
    todos: list[TodoOut]
