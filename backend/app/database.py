"""
Database engine and session factory.
This module used to try connecting to Postgres at import time which makes test imports fail when
Postgres isn't available. Changed to lazily create the engine without calling `connect()` so
imports don't block. Tests override the dependency and provide their own testing session.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://user:password@db:5432/dental_db"

# Create engine without attempting to connect immediately (avoids import-time failures in tests)
engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()