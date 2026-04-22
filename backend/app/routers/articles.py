"""Articles router — CRUD endpoints for RSS feed articles."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_id, PaginationParams
from app.models.article import Article
from app.schemas.article import ArticleOut, ArticleListResponse

router = APIRouter(prefix="/api/articles", tags=["articles"])


@router.get("", response_model=ArticleListResponse)
async def list_articles(
    pagination: PaginationParams = Depends(),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List articles for the current user with pagination."""
    # Count total
    count_stmt = select(func.count()).select_from(Article).where(Article.user_id == user_id)
    total = (await db.execute(count_stmt)).scalar_one()

    # Fetch paginated articles
    stmt = (
        select(Article)
        .where(Article.user_id == user_id)
        .order_by(desc(Article.published_at))
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    result = await db.execute(stmt)
    articles = result.scalars().all()

    return ArticleListResponse(
        articles=[ArticleOut.model_validate(a) for a in articles],
        total=total,
        skip=pagination.offset,
        limit=pagination.limit,
    )


@router.get("/{article_id}", response_model=ArticleOut)
async def get_article(
    article_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a single article by ID."""
    stmt = select(Article).where(Article.id == article_id, Article.user_id == user_id)
    result = await db.execute(stmt)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    return ArticleOut.model_validate(article)


@router.delete("/{article_id}")
async def delete_article(
    article_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete an article."""
    stmt = select(Article).where(Article.id == article_id, Article.user_id == user_id)
    result = await db.execute(stmt)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    await db.delete(article)
    await db.commit()

    return {"status": "ok", "message": "Article deleted"}
