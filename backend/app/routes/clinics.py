from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from fastapi import Depends
from app.models import Clinic
from app.schemas import ClinicCreate, ClinicResponse
from app.database import get_db
from app.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/clinics", tags=["clinics"])

@router.post("/", response_model=ClinicResponse)
def create_clinic(clinic: ClinicCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Assign clinic to current user's lab unless superadmin; superadmin must specify via future param
    if current_user.role != "superadmin" and not current_user.lab_id:
        raise HTTPException(status_code=400, detail="User is not assigned to any lab")
    payload = clinic.dict()
    if current_user.role != "superadmin":
        payload["lab_id"] = current_user.lab_id
    db_clinic = Clinic(**payload)
    db.add(db_clinic)
    db.commit()
    db.refresh(db_clinic)
    return db_clinic

@router.get("/", response_model=list[ClinicResponse])
def get_clinics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(Clinic)
    if current_user.role != "superadmin":
        q = q.filter(Clinic.lab_id == current_user.lab_id)
    return q.all()

@router.get("/{clinic_id}", response_model=ClinicResponse)
def get_clinic(clinic_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if clinic is None:
        raise HTTPException(status_code=404, detail="Klinika nenájdená")
    if current_user.role != "superadmin" and clinic.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return clinic

@router.put("/{clinic_id}", response_model=ClinicResponse)
def update_clinic(clinic_id: int, clinic: ClinicCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db_clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if db_clinic is None:
        raise HTTPException(status_code=404, detail="Klinika nenájdená")
    if current_user.role != "superadmin" and db_clinic.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    for key, value in clinic.dict().items():
        setattr(db_clinic, key, value)
    db.commit()
    db.refresh(db_clinic)
    return db_clinic

@router.delete("/{clinic_id}")
def delete_clinic(clinic_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if clinic is None:
        raise HTTPException(status_code=404, detail="Klinika nenájdená")
    if current_user.role != "superadmin" and clinic.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(clinic)
    db.commit()
    return {"message": "Klinika vymazaná"}