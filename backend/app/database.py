from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
import time

DATABASE_URL = "postgresql://user:password@db:5432/dental_db"

# Retry logic for database connection
for _ in range(5):
    try:
        engine = create_engine(DATABASE_URL)
        engine.connect()
        break
    except OperationalError:
        time.sleep(2)
else:
    raise Exception("Nepodarilo sa pripojiť k databáze po 5 pokusoch")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()