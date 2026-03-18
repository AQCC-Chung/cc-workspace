from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from dotenv import load_dotenv
import scraper
import stock_monitor

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
    allow_methods=["GET"],
    allow_headers=[],
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

@app.get("/api/stock/scan")
def stock_scan(
    tickers: str = Query(..., description="逗號分隔的台股代號，如 2330,2317,0050"),
):
    """掃描台股標的，回傳技術指標與籌碼面訊號。"""
    ticker_list = [t.strip() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        return {"error": "tickers 不可為空"}
    return stock_monitor.run_scan(ticker_list)


@app.get("/api/stock/chart/{ticker}")
def stock_chart(
    ticker: str,
    interval: str = Query("1d", description="1d | 1h | 1m"),
):
    """取得台股 K 線圖資料（含大盤 ^TWII 用於 RS Line）。"""
    return stock_monitor.get_chart_data(ticker, interval)


@app.get("/api/stock/screener")
def stock_screener(
    min_score: int = Query(5, ge=0, le=10, description="最低得分門檻"),
):
    """掃描預設清單，回傳符合得分條件的標的。"""
    return stock_monitor.run_screener(min_score)


@app.get("/health")
def health_check():
    """Health check endpoint for Render."""
    return {"status": "ok"}
