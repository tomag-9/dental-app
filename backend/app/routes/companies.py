from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from app.models import Lab
from app.schemas import LabCreate, LabResponse
from app.database import get_db
from app.auth import get_current_user
from app.models import User

# Backward compatibility router - redirects to labs
router = APIRouter(prefix="/companies", tags=["companies (deprecated)"])

@router.post("/", response_model=LabResponse)
def create_company(lab: LabCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db_lab = Lab(**lab.dict())
    db.add(db_lab)
    db.commit()
    db.refresh(db_lab)
    return db_lab

@router.get("/", response_model=list[LabResponse])
def get_companies(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if current_user.role == "superadmin":
        return db.query(Lab).all()
    if current_user.lab_id:
        lab = db.query(Lab).filter(Lab.id == current_user.lab_id).all()
        return lab
    return []

@router.get("/{company_id}", response_model=LabResponse)
def get_company(company_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    lab = db.query(Lab).filter(Lab.id == company_id).first()
    if lab is None:
        raise HTTPException(status_code=404, detail="Spoločnosť nenájdená")
    if current_user.role != "superadmin" and current_user.lab_id != lab.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return lab

@router.put("/{company_id}", response_model=LabResponse)
def update_company(company_id: int, lab: LabCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db_lab = db.query(Lab).filter(Lab.id == company_id).first()
    if db_lab is None:
        raise HTTPException(status_code=404, detail="Spoločnosť nenájdená")
    if current_user.role != "superadmin" and current_user.lab_id != db_lab.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
    for field, value in lab.dict().items():
        setattr(db_lab, field, value)
    
    db.commit()
    db.refresh(db_lab)
    return db_lab

@router.delete("/{company_id}")
def delete_company(company_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    lab = db.query(Lab).filter(Lab.id == company_id).first()
    if lab is None:
        raise HTTPException(status_code=404, detail="Spoločnosť nenájdená")
    if current_user.role != "superadmin" and current_user.lab_id != lab.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
    db.delete(lab)
    db.commit()
    return {"message": "Spoločnosť bola zmazaná"}
