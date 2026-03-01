from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models import Job
from app.database import get_db
from app.auth import get_current_user
from typing import Dict

router = APIRouter(prefix="/patients", tags=["patients"])

@router.get("/{patient_id}/cumulative_tooth_map", response_model=Dict[str, str], dependencies=[Depends(get_current_user)])
def get_cumulative_tooth_map(patient_id: int, db: Session = Depends(get_db)):
    # Get all closed jobs for the patient, ordered by creation date
    jobs = db.query(Job).filter(Job.patient_id == patient_id, Job.status == "closed").order_by(Job.created_at).all()
    if not jobs:
        return {}
    tooth_map = {}
    for job in jobs:
        if job.tooth_procedures:
            # Newer jobs override older ones for the same tooth
            tooth_map.update(job.tooth_procedures)
    return tooth_map
