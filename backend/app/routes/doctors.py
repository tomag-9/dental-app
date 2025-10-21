from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models import Doctor, User
from app.schemas import DoctorCreate, DoctorResponse
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/doctors", tags=["doctors"])

@router.post("/", response_model=DoctorResponse)
def create_doctor(doctor: DoctorCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if current_user.role != "superadmin" and not current_user.lab_id:
        raise HTTPException(status_code=400, detail="User is not assigned to any lab")
    payload = doctor.dict()
    if current_user.role != "superadmin":
        payload["lab_id"] = current_user.lab_id
    db_doctor = Doctor(**payload)
    db.add(db_doctor)
    db.commit()
    db.refresh(db_doctor)
    return db_doctor

@router.get("/", response_model=list[DoctorResponse])
def get_doctors(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(Doctor)
    if current_user.role != "superadmin":
        q = q.filter(Doctor.lab_id == current_user.lab_id)
    return q.all()

@router.get("/{doctor_id}", response_model=DoctorResponse)
def get_doctor(doctor_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if doctor is None:
        raise HTTPException(status_code=404, detail="Lekár nenájdený")
    if current_user.role != "superadmin" and doctor.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return doctor

@router.put("/{doctor_id}", response_model=DoctorResponse)
def update_doctor(doctor_id: int, doctor: DoctorCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db_doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if db_doctor is None:
        raise HTTPException(status_code=404, detail="Lekár nenájdený")
    if current_user.role != "superadmin" and db_doctor.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    for key, value in doctor.dict().items():
        setattr(db_doctor, key, value)
    db.commit()
    db.refresh(db_doctor)
    return db_doctor

@router.delete("/{doctor_id}")
def delete_doctor(doctor_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if doctor is None:
        raise HTTPException(status_code=404, detail="Lekár nenájdený")
    if current_user.role != "superadmin" and doctor.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(doctor)
    db.commit()
    return {"message": "Lekár vymazaný"}