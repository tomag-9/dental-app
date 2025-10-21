from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models import Job, PriceList, Patient, Clinic, Doctor, Technician, User
from app.schemas import JobCreate, JobResponse
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])

def validate_procedure_codes(procedure_codes: list[str], db: Session):
    if not procedure_codes:
        return
    valid_codes = db.query(PriceList.code).all()
    valid_codes = [code[0] for code in valid_codes]
    invalid_codes = [code for code in procedure_codes if code not in valid_codes]
    if invalid_codes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid procedure codes: {invalid_codes}"
        )

@router.post("/", response_model=JobResponse)
def create_job(job: JobCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    validate_procedure_codes(job.procedure_codes, db)
    if job.procedure_codes and job.procedure_quantities:
        if len(job.procedure_codes) != len(set(job.procedure_quantities.keys())):
            raise HTTPException(status_code=400, detail="Procedure codes and quantities must match")
    payload = job.dict(exclude_unset=True)
    # Non-superadmin: enforce lab scope and consistency
    if current_user.role != "superadmin":
        if not current_user.lab_id:
            raise HTTPException(status_code=400, detail="User is not assigned to any lab")
        # Check referenced entities belong to same lab
        pat = db.query(Patient).filter(Patient.id == payload["patient_id"]).first()
        cli = db.query(Clinic).filter(Clinic.id == payload["clinic_id"]).first()
        doc = db.query(Doctor).filter(Doctor.id == payload["doctor_id"]).first()
        tech = db.query(Technician).filter(Technician.id == payload["technician_id"]).first()
        if not all([pat, cli, doc, tech]):
            raise HTTPException(status_code=400, detail="Referenced entities not found")
        if any(getattr(ent, "lab_id", None) != current_user.lab_id for ent in [pat, cli, doc, tech]):
            raise HTTPException(status_code=403, detail="Entities must belong to the same lab")
        payload["lab_id"] = current_user.lab_id
    db_job = Job(**payload)
    try:
        db.add(db_job)
        db.commit()
        db.refresh(db_job)
        return db_job
    except IntegrityError as e:
        db.rollback()
        if "jobs_patient_id_fkey" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid patient_id: {job.patient_id} does not exist")
        raise HTTPException(status_code=400, detail="Database integrity error")

@router.get("/", response_model=list[JobResponse])
def get_jobs(patient_id: int = Query(None, description="Filter by patient ID"), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(Job)
    if current_user.role != "superadmin":
        q = q.filter(Job.lab_id == current_user.lab_id)
    if patient_id:
        q = q.filter(Job.patient_id == patient_id)
        jobs = q.all()
        if not jobs:
            raise HTTPException(status_code=404, detail=f"No jobs found for patient_id: {patient_id}")
        return jobs
    return q.all()

@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(Job).filter(Job.id == job_id)
    if current_user.role != "superadmin":
        q = q.filter(Job.lab_id == current_user.lab_id)
    job = q.first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.put("/{job_id}", response_model=JobResponse)
def update_job(job_id: int, job: JobCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    validate_procedure_codes(job.procedure_codes, db)
    if job.procedure_codes and job.procedure_quantities:
        if len(job.procedure_codes) != len(set(job.procedure_quantities.keys())):
            raise HTTPException(status_code=400, detail="Procedure codes and quantities must match")
    q = db.query(Job).filter(Job.id == job_id)
    if current_user.role != "superadmin":
        q = q.filter(Job.lab_id == current_user.lab_id)
    db_job = q.first()
    if db_job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        for key, value in job.dict(exclude_unset=True).items():
            setattr(db_job, key, value)
        db.commit()
        db.refresh(db_job)
        return db_job
    except IntegrityError as e:
        db.rollback()
        if "jobs_patient_id_fkey" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid patient_id: {job.patient_id} does not exist")
        # ... (other integrity checks)
        raise HTTPException(status_code=400, detail="Database integrity error")

@router.delete("/{job_id}")
def delete_job(job_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(Job).filter(Job.id == job_id)
    if current_user.role != "superadmin":
        q = q.filter(Job.lab_id == current_user.lab_id)
    job = q.first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}