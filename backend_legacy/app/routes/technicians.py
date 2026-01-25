from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models import Technician, User
from app.schemas import TechnicianCreate, TechnicianResponse
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/technicians", tags=["technicians"])

@router.post("/", response_model=TechnicianResponse)
def create_technician(technician: TechnicianCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not current_user.lab_id:
        raise HTTPException(status_code=400, detail="User is not assigned to any lab")
    payload = technician.model_dump()
    # Always assign lab_id from current user
    payload["lab_id"] = current_user.lab_id
    db_technician = Technician(**payload)
    db.add(db_technician)
    db.commit()
    db.refresh(db_technician)
    return db_technician

@router.get("/", response_model=list[TechnicianResponse])
def get_technicians(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(Technician)
    if current_user.role != "superadmin":
        q = q.filter(Technician.lab_id == current_user.lab_id)
    return q.all()

@router.get("/{technician_id}", response_model=TechnicianResponse)
def get_technician(technician_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if technician is None:
        raise HTTPException(status_code=404, detail="Technik nenájdený")
    if current_user.role != "superadmin" and technician.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return technician

@router.put("/{technician_id}", response_model=TechnicianResponse)
def update_technician(technician_id: int, technician: TechnicianCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db_technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if db_technician is None:
        raise HTTPException(status_code=404, detail="Technik nenájdený")
    if current_user.role != "superadmin" and db_technician.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    for key, value in technician.model_dump().items():
        setattr(db_technician, key, value)
    db.commit()
    db.refresh(db_technician)
    return db_technician

@router.delete("/{technician_id}")
def delete_technician(technician_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if technician is None:
        raise HTTPException(status_code=404, detail="Technik nenájdený")
    if current_user.role != "superadmin" and technician.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(technician)
    db.commit()
    return {"message": "Technik vymazaný"}