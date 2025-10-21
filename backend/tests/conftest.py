import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set testing environment variable BEFORE importing app
os.environ["TESTING"] = "1"

from app.main import app
from app import models
from app.auth import get_password_hash
from app.database import get_db

# Use a file-based SQLite for tests (temporary file in /tmp)
TEST_DB_PATH = "/tmp/test_dental_app.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"

# For in-memory testing with StaticPool to ensure single connection
# SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool  # Use StaticPool to maintain single connection for in-memory DB
)

# Enable foreign keys for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Override the dependency
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables and seed data once for the entire test session."""
    # Remove existing test database if it exists
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    
    # Create all tables
    models.Base.metadata.create_all(bind=engine)
    
    # Seed minimal data
    db = TestingSessionLocal()
    try:
        # Create a Lab and assign users to it
        lab = models.Lab(name="Test Lab", address="Lab Street 1")
        db.add(lab)
        db.flush()

        admin = models.User(nickname="admin", email="admin@test.local", hashed_password=get_password_hash("password123"), role="admin", is_active=True, lab_id=lab.id)
        user1 = models.User(nickname="user1", email="user1@test.local", hashed_password=get_password_hash("userpass"), role="user", is_active=True, lab_id=lab.id)
        db.add_all([admin, user1])
        db.flush()

        clinic = models.Clinic(name="Test Clinic", address="123 Test St", ico="11122233", dic="SK111222333", lab_id=lab.id)
        db.add(clinic)
        db.flush()

        doc = models.Doctor(first_name="John", last_name="Tester", clinic_id=clinic.id, lab_id=lab.id)
        tech = models.Technician(first_name="Tech", last_name="Tester", lab_id=lab.id)
        db.add_all([doc, tech])
        db.flush()

        pat = models.Patient(first_name="Patient", last_name="Zero", birth_number="900101/0000", address="Addr", lab_id=lab.id)
        db.add(pat)
        db.flush()

        pl = models.PriceList(code="TEST", description="Test procedure", price=100.0, lab_id=lab.id)
        db.add(pl)
        db.flush()

        job1 = models.Job(
            patient_id=pat.id,
            clinic_id=clinic.id,
            doctor_id=doc.id,
            technician_id=tech.id,
            lab_id=lab.id,
            price=100.0,
            procedure_codes=[pl.code],
            procedure_quantities={pl.code: 1},
            description="Seed job 1",
        )
        job2 = models.Job(
            patient_id=pat.id,
            clinic_id=clinic.id,
            doctor_id=doc.id,
            technician_id=tech.id,
            lab_id=lab.id,
            price=150.0,
            procedure_codes=[pl.code],
            procedure_quantities={pl.code: 2},
            description="Seed job 2",
        )
        db.add_all([job1, job2])
        db.commit()
    finally:
        db.close()
    
    yield
    
    # Cleanup after all tests
    models.Base.metadata.drop_all(bind=engine)
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


@pytest.fixture()
def db():
    """Provide a database session for individual tests."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


@pytest.fixture()
def client():
    """TestClient that uses the overridden DB dependency."""
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def admin_token(client):
    resp = client.post("/users/token", data={"username": "admin@test.local", "password": "password123"})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture()
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}

