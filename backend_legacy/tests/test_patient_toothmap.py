import pytest
from app import models


def test_cumulative_tooth_map_basic(client, auth_headers, db):
    """Test basic cumulative tooth map functionality."""
    # Get the seeded patient
    patient = db.query(models.Patient).first()
    assert patient is not None

    # Create a closed job with tooth procedures
    clinic = db.query(models.Clinic).first()
    doctor = db.query(models.Doctor).first()
    technician = db.query(models.Technician).first()
    lab = db.query(models.Lab).first()

    job = models.Job(
        patient_id=patient.id,
        clinic_id=clinic.id,
        doctor_id=doctor.id,
        technician_id=technician.id,
        lab_id=lab.id,
        status="closed",
        tooth_procedures={"11": "crown", "12": "filling"}
    )
    db.add(job)
    db.commit()

    # Test the endpoint
    resp = client.get(f"/patients/{patient.id}/cumulative_tooth_map", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data == {"11": "crown", "12": "filling"}


def test_cumulative_tooth_map_override(client, auth_headers, db):
    """Test that newer jobs override older ones for the same tooth."""
    # Get the seeded patient
    patient = db.query(models.Patient).first()
    assert patient is not None

    # Get seeded entities
    clinic = db.query(models.Clinic).first()
    doctor = db.query(models.Doctor).first()
    technician = db.query(models.Technician).first()
    lab = db.query(models.Lab).first()

    # Create first job (older)
    job1 = models.Job(
        patient_id=patient.id,
        clinic_id=clinic.id,
        doctor_id=doctor.id,
        technician_id=technician.id,
        lab_id=lab.id,
        status="closed",
        tooth_procedures={"11": "filling", "12": "crown"}
    )
    db.add(job1)
    db.commit()

    # Create second job (newer) that overrides tooth 11
    job2 = models.Job(
        patient_id=patient.id,
        clinic_id=clinic.id,
        doctor_id=doctor.id,
        technician_id=technician.id,
        lab_id=lab.id,
        status="closed",
        tooth_procedures={"11": "implant", "13": "bridge"}
    )
    db.add(job2)
    db.commit()

    # Test the endpoint - should show overridden values
    resp = client.get(f"/patients/{patient.id}/cumulative_tooth_map", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data == {"11": "implant", "12": "crown", "13": "bridge"}


def test_cumulative_tooth_map_empty(client, auth_headers, db):
    """Test that empty dict is returned when patient has no closed jobs."""
    # Create a new patient with no jobs
    lab = db.query(models.Lab).first()
    patient = models.Patient(
        first_name="Empty",
        last_name="Patient",
        birth_number="800101/0000",
        lab_id=lab.id
    )
    db.add(patient)
    db.commit()

    # Test the endpoint
    resp = client.get(f"/patients/{patient.id}/cumulative_tooth_map", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data == {}


def test_cumulative_tooth_map_only_closed_jobs(client, auth_headers, db):
    """Test that only closed jobs are included in cumulative map."""
    # Create a new patient for this test to avoid interference
    lab = db.query(models.Lab).first()
    patient = models.Patient(
        first_name="Test",
        last_name="Patient",
        birth_number="750101/0000",
        lab_id=lab.id
    )
    db.add(patient)
    db.commit()

    # Get seeded entities
    clinic = db.query(models.Clinic).first()
    doctor = db.query(models.Doctor).first()
    technician = db.query(models.Technician).first()

    # Create a closed job
    job_closed = models.Job(
        patient_id=patient.id,
        clinic_id=clinic.id,
        doctor_id=doctor.id,
        technician_id=technician.id,
        lab_id=lab.id,
        status="closed",
        tooth_procedures={"11": "crown"}
    )
    db.add(job_closed)

    # Create an open job (should not be included)
    job_open = models.Job(
        patient_id=patient.id,
        clinic_id=clinic.id,
        doctor_id=doctor.id,
        technician_id=technician.id,
        lab_id=lab.id,
        status="in_progress",
        tooth_procedures={"12": "filling"}
    )
    db.add(job_open)
    db.commit()

    # Test the endpoint - should only include closed job
    resp = client.get(f"/patients/{patient.id}/cumulative_tooth_map", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data == {"11": "crown"}
    assert "12" not in data


def test_cumulative_tooth_map_requires_auth(client):
    """Test that authentication is required for the endpoint."""
    # Test without auth headers
    resp = client.get("/patients/1/cumulative_tooth_map")
    assert resp.status_code == 401