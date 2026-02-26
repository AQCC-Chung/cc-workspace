import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers.recommendations import router as recommendations_router
from routers.search import router as search_router
import database

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

app.include_router(recommendations_router)
app.include_router(search_router)

@app.get("/health")
def health_check():
    """Health check endpoint for Render."""
    return {"status": "ok"}
