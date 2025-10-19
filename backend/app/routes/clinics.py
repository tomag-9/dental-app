from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from fastapi import Depends
from app.models import Clinic
from app.schemas import ClinicCreate, ClinicResponse
from app.database import get_db

router = APIRouter(prefix="/clinics", tags=["clinics"])

@router.post("/", response_model=ClinicResponse)
def create_clinic(clinic: ClinicCreate, db: Session = Depends(get_db)):
    db_clinic = Clinic(**clinic.dict())
    db.add(db_clinic)
    db.commit()
    db.refresh(db_clinic)
    return db_clinic

@router.get("/", response_model=list[ClinicResponse])
def get_clinics(db: Session = Depends(get_db)):
    return db.query(Clinic).all()

@router.get("/{clinic_id}", response_model=ClinicResponse)
def get_clinic(clinic_id: int, db: Session = Depends(get_db)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if clinic is None:
        raise HTTPException(status_code=404, detail="Klinika nenájdená")
    return clinic

@router.put("/{clinic_id}", response_model=ClinicResponse)
def update_clinic(clinic_id: int, clinic: ClinicCreate, db: Session = Depends(get_db)):
    db_clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if db_clinic is None:
        raise HTTPException(status_code=404, detail="Klinika nenájdená")
    for key, value in clinic.dict().items():
        setattr(db_clinic, key, value)
    db.commit()
    db.refresh(db_clinic)
    return db_clinic

@router.delete("/{clinic_id}")
def delete_clinic(clinic_id: int, db: Session = Depends(get_db)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if clinic is None:
        raise HTTPException(status_code=404, detail="Klinika nenájdená")
    db.delete(clinic)
    db.commit()
    return {"message": "Klinika vymazaná"}