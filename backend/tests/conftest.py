import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app import models
from app.auth import get_password_hash
from app.database import get_db

# Use in-memory SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
models.Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Override the dependency
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def db():
    """Provide a session with seeded data for the whole test session."""
    db = TestingSessionLocal()
    try:
        # Seed minimal data similar to app/seed.py
        admin = models.User(username="admin", hashed_password=get_password_hash("password123"), role="admin", is_active=True)
        user1 = models.User(username="user1", hashed_password=get_password_hash("userpass"), role="user", is_active=True)
        db.add_all([admin, user1])
        db.commit()

        clinic = models.Clinic(name="Test Clinic", address="123 Test St", ico="11122233", dic="SK111222333")
        db.add(clinic)
        db.flush()

        doc = models.Doctor(first_name="John", last_name="Tester", clinic_id=clinic.id)
        tech = models.Technician(first_name="Tech", last_name="Tester")
        db.add_all([doc, tech])
        db.flush()

        pat = models.Patient(first_name="Patient", last_name="Zero", birth_number="900101/0000", address="Addr")
        db.add(pat)
        db.flush()

        pl = models.PriceList(code="TEST", description="Test procedure", price=100.0)
        db.add(pl)
        db.flush()

        job = models.Job(
            patient_id=pat.id,
            clinic_id=clinic.id,
            doctor_id=doc.id,
            technician_id=tech.id,
            price=100.0,
            procedure_codes=[pl.code],
            procedure_quantities={pl.code: 1},
            description="Seed job",
        )
        db.add(job)
        db.commit()

        yield db
    finally:
        db.close()


@pytest.fixture()
def client(db):
    """TestClient that uses the overridden DB dependency."""
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def admin_token(client):
    resp = client.post("/users/token", data={"username": "admin", "password": "password123"})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture()
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}

