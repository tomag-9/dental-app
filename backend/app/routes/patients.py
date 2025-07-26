from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models import Patient
from app.schemas import PatientCreate, PatientResponse
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/patients", tags=["patients"])

@router.post("/", response_model=PatientResponse, dependencies=[Depends(get_current_user)])
def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    db_patient = Patient(**patient.dict())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@router.get("/", response_model=list[PatientResponse], dependencies=[Depends(get_current_user)])
def get_patients(db: Session = Depends(get_db)):
    return db.query(Patient).all()

@router.get("/{patient_id}", response_model=PatientResponse, dependencies=[Depends(get_current_user)])
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Pacient nenájdený")
    return patient

@router.put("/{patient_id}", response_model=PatientResponse, dependencies=[Depends(get_current_user)])
def update_patient(patient_id: int, patient: PatientCreate, db: Session = Depends(get_db)):
    db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if db_patient is None:
        raise HTTPException(status_code=404, detail="Pacient nenájdený")
    for key, value in patient.dict().items():
        setattr(db_patient, key, value)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@router.delete("/{patient_id}", dependencies=[Depends(get_current_user)])
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Pacient nenájdený")
    db.delete(patient)
    db.commit()
    return {"message": "Pacient vymazaný"}