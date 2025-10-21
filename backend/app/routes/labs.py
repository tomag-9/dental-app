from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Lab, User, Subscription
from app.schemas import LabCreate, LabResponse
from app.database import get_db
from app.auth import get_current_user, get_superadmin_user

router = APIRouter(prefix="/labs", tags=["labs"]) 

@router.post("/", response_model=LabResponse)
def create_lab(lab: LabCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db_lab = Lab(**lab.dict())
    db.add(db_lab)
    db.commit()
    db.refresh(db_lab)
    return db_lab

@router.get("/", response_model=list[LabResponse])
def get_labs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if current_user.role == "superadmin":
        return db.query(Lab).all()
    if current_user.lab_id:
        lab = db.query(Lab).filter(Lab.id == current_user.lab_id).all()
        return lab
    return []

@router.get("/{lab_id}", response_model=LabResponse)
def get_lab(lab_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if lab is None:
        raise HTTPException(status_code=404, detail="Lab nenájdený")
    if current_user.role != "superadmin" and current_user.lab_id != lab.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return lab

@router.put("/{lab_id}", response_model=LabResponse)
def update_lab(lab_id: int, lab: LabCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db_lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if db_lab is None:
        raise HTTPException(status_code=404, detail="Lab nenájdený")
    if current_user.role != "superadmin" and current_user.lab_id != db_lab.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
    for field, value in lab.dict().items():
        setattr(db_lab, field, value)
    
    db.commit()
    db.refresh(db_lab)
    return db_lab

@router.delete("/{lab_id}")
def delete_lab(lab_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if lab is None:
        raise HTTPException(status_code=404, detail="Lab nenájdený")
    if current_user.role != "superadmin" and current_user.lab_id != lab.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
    db.delete(lab)
    db.commit()
    return {"message": "Lab bol zmazaný"}

# Superadmin-only endpoints
@router.get("/superadmin/all", response_model=list[dict])
def get_all_labs_with_stats(current_user: User = Depends(get_superadmin_user), db: Session = Depends(get_db)):
    """Get all labs with user count and subscription info (superadmin only)."""
    labs = db.query(Lab).all()
    result = []
    for lab in labs:
        user_count = db.query(func.count(User.id)).filter(User.lab_id == lab.id).scalar()
        subscription = db.query(Subscription).filter(Subscription.lab_id == lab.id).first()
        result.append({
            "id": lab.id,
            "name": lab.name,
            "email": lab.email,
            "city": lab.city,
            "created_at": lab.created_at,
            "user_count": user_count,
            "subscription_plan": subscription.plan if subscription else "none",
            "subscription_status": subscription.status if subscription else "inactive",
            "subscription_seats": subscription.seats if subscription else 0
        })
    return result
