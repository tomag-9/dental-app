from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from fastapi import Depends
from app.models import Technician
from app.schemas import TechnicianCreate, TechnicianResponse
from app.database import get_db

router = APIRouter(prefix="/technicians", tags=["technicians"])

@router.post("/", response_model=TechnicianResponse)
def create_technician(technician: TechnicianCreate, db: Session = Depends(get_db)):
    db_technician = Technician(**technician.dict())
    db.add(db_technician)
    db.commit()
    db.refresh(db_technician)
    return db_technician

@router.get("/", response_model=list[TechnicianResponse])
def get_technicians(db: Session = Depends(get_db)):
    return db.query(Technician).all()

@router.get("/{technician_id}", response_model=TechnicianResponse)
def get_technician(technician_id: int, db: Session = Depends(get_db)):
    technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if technician is None:
        raise HTTPException(status_code=404, detail="Technik nenájdený")
    return technician

@router.put("/{technician_id}", response_model=TechnicianResponse)
def update_technician(technician_id: int, technician: TechnicianCreate, db: Session = Depends(get_db)):
    db_technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if db_technician is None:
        raise HTTPException(status_code=404, detail="Technik nenájdený")
    for key, value in technician.dict().items():
        setattr(db_technician, key, value)
    db.commit()
    db.refresh(db_technician)
    return db_technician

@router.delete("/{technician_id}")
def delete_technician(technician_id: int, db: Session = Depends(get_db)):
    technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if technician is None:
        raise HTTPException(status_code=404, detail="Technik nenájdený")
    db.delete(technician)
    db.commit()
    return {"message": "Technik vymazaný"}