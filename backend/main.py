import os
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from dotenv import load_dotenv
import scraper

load_dotenv()

app = FastAPI()

# Allow frontend origins — both local dev and GitHub Pages production
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:5174",
    "https://aqcc-chung.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/recommendations")
def get_recommendations():
    conn = sqlite3.connect("influencer.db")
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM recommendations ORDER BY rating DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(ix) for ix in rows]

@app.get("/api/search")
def search_recommendations(
    q: str = Query(..., description="Search keyword"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=20, description="Results per page"),
):
    """Search endpoint with pagination."""
    data, has_more = scraper.scrape_data(keyword=q, limit=limit, page=page)
    scraper.save_to_db(data, append=(page > 1))

    return {
        'results': data,
        'has_more': has_more,
        'page': page,
    }

@app.get("/health")
def health_check():
    """Health check endpoint for Render."""
    return {"status": "ok"}
