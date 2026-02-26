import sqlite3
import os

DB_NAME = "influencer.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            image TEXT,
            influencer TEXT,
            quote TEXT,
            rating REAL,
            price_range TEXT,
            location TEXT,
            source_url TEXT,
            article_url TEXT,
            address TEXT
        )
    ''')
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized.")
