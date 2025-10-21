"""
Database engine and session factory.
This module used to try connecting to Postgres at import time which makes test imports fail when
Postgres isn't available. Changed to lazily create the engine without calling `connect()` so
imports don't block. Tests override the dependency and provide their own testing session.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Determine database URL with safe defaults for CI/tests
TESTING = os.getenv("TESTING") == "1"
DATABASE_URL = os.getenv("DATABASE_URL")

# Provide a harmless fallback to avoid import-time crashes in CI where DATABASE_URL isn't set
if not DATABASE_URL:
    # For tests, use an in-memory SQLite placeholder (real test engine is provided by conftest overrides)
    DATABASE_URL = "sqlite:///:memory:" if TESTING else "postgresql+psycopg2://postgres:postgres@db:5432/dental_app"

# Create engine without attempting to connect immediately (avoids import-time failures in tests)
engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()