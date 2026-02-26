from typing import Optional
from sqlmodel import Field, SQLModel

class Recommendation(SQLModel, table=True):
    __tablename__ = "recommendations"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    category: str
    image: Optional[str] = None
    influencer: Optional[str] = None
    quote: Optional[str] = None
    rating: Optional[float] = None
    price_range: Optional[str] = None
    location: Optional[str] = None
    source_url: Optional[str] = None
    article_url: Optional[str] = None
    address: Optional[str] = None
