from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models import Patient, User
from app.schemas import PatientCreate, PatientResponse
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/patients", tags=["patients"])

@router.post("/", response_model=PatientResponse)
def create_patient(patient: PatientCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not current_user.lab_id:
        raise HTTPException(status_code=400, detail="User is not assigned to any lab")
    payload = patient.model_dump()
    # Always assign lab_id from current user (superadmin uses their lab_id, others use their lab_id)
    payload["lab_id"] = current_user.lab_id
    db_patient = Patient(**payload)
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@router.get("/", response_model=list[PatientResponse])
def get_patients(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(Patient)
    if current_user.role != "superadmin":
        q = q.filter(Patient.lab_id == current_user.lab_id)
    return q.all()

@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Pacient nenájdený")
    if current_user.role != "superadmin" and patient.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return patient

@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(patient_id: int, patient: PatientCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if db_patient is None:
        raise HTTPException(status_code=404, detail="Pacient nenájdený")
    if current_user.role != "superadmin" and db_patient.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    for key, value in patient.model_dump().items():
        setattr(db_patient, key, value)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@router.delete("/{patient_id}")
def delete_patient(patient_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Pacient nenájdený")
    if current_user.role != "superadmin" and patient.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(patient)
    db.commit()
    return {"message": "Pacient vymazaný"}