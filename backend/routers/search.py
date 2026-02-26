from fastapi import APIRouter, Query
from services import scraper

router = APIRouter(tags=["search"])

@router.get("/api/search")
async def search_recommendations(
    q: str = Query(..., description="Search keyword"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=20, description="Results per page"),
):
    """Search endpoint with pagination."""
    data, has_more = await scraper.scrape_data(keyword=q, limit=limit, page=page)
    scraper.save_to_db(data, append=(page > 1))

    return {
        'results': data,
        'has_more': has_more,
        'page': page,
    }
