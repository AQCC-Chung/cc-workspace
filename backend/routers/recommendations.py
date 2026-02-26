from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from database import get_session
from models.recommendation import Recommendation

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

@router.get("/")
def get_recommendations(session: Session = Depends(get_session)):
    statement = select(Recommendation).order_by(Recommendation.rating.desc())
    results = session.exec(statement).all()
    return results
