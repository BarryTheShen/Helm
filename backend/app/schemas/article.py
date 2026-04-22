"""Article schemas for request/response validation."""
from datetime import datetime
from pydantic import BaseModel, Field


class ArticleBase(BaseModel):
    """Base article fields."""
    title: str = Field(..., max_length=500)
    source: str = Field(..., max_length=200)
    url: str
    summary_markdown: str | None = None
    content_markdown: str | None = None
    image_url: str | None = None
    published_at: datetime


class ArticleCreate(ArticleBase):
    """Schema for creating a new article."""
    pass


class ArticleOut(ArticleBase):
    """Schema for article responses."""
    id: str
    user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleListResponse(BaseModel):
    """Paginated article list response."""
    articles: list[ArticleOut]
    total: int
    skip: int
    limit: int
