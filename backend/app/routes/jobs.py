from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models import Job, PriceList
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

@router.post("/", response_model=JobResponse, dependencies=[Depends(get_current_user)])
def create_job(job: JobCreate, db: Session = Depends(get_db)):
    validate_procedure_codes(job.procedure_codes, db)
    db_job = Job(**job.dict())
    try:
        db.add(db_job)
        db.commit()
        db.refresh(db_job)
        return db_job
    except IntegrityError as e:
        db.rollback()
        if "jobs_patient_id_fkey" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid patient_id: {job.patient_id} does not exist")
        elif "jobs_clinic_id_fkey" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid clinic_id: {job.clinic_id} does not exist")
        elif "jobs_doctor_id_fkey" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid doctor_id: {job.doctor_id} does not exist")
        elif "jobs_technician_id_fkey" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid technician_id: {job.technician_id} does not exist")
        raise HTTPException(status_code=400, detail="Database integrity error")

@router.get("/", response_model=list[JobResponse], dependencies=[Depends(get_current_user)])
def get_jobs(db: Session = Depends(get_db)):
    return db.query(Job).all()

@router.get("/{job_id}", response_model=JobResponse, dependencies=[Depends(get_current_user)])
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.put("/{job_id}", response_model=JobResponse, dependencies=[Depends(get_current_user)])
def update_job(job_id: int, job: JobCreate, db: Session = Depends(get_db)):
    validate_procedure_codes(job.procedure_codes, db)
    db_job = db.query(Job).filter(Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        for key, value in job.dict().items():
            setattr(db_job, key, value)
        db.commit()
        db.refresh(db_job)
        return db_job
    except IntegrityError as e:
        db.rollback()
        if "jobs_patient_id_fkey" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid patient_id: {job.patient_id} does not exist")
        elif "jobs_clinic_id_fkey" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid clinic_id: {job.clinic_id} does not exist")
        elif "jobs_doctor_id_fkey" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid doctor_id: {job.doctor_id} does not exist")
        elif "jobs_technician_id_fkey" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid technician_id: {job.technician_id} does not exist")
        raise HTTPException(status_code=400, detail="Database integrity error")

@router.delete("/{job_id}", dependencies=[Depends(get_current_user)])
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}