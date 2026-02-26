from sqlmodel import SQLModel, create_engine, Session
from models.recommendation import Recommendation  # noqa: F401
import os

DB_NAME = "influencer.db"
sqlite_url = f"sqlite:///{DB_NAME}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

if __name__ == "__main__":
    create_db_and_tables()
    print("Database initialized.")
init_db = create_db_and_tables
