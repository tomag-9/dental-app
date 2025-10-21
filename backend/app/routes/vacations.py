from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Vacation, User
from app.schemas import VacationCreate, VacationResponse
from app.auth import get_current_user

router = APIRouter(prefix="/vacations", tags=["vacations"])

@router.get("/", response_model=list[VacationResponse])
def get_vacations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(Vacation)
    if current_user.role != "superadmin":
        q = q.filter(Vacation.lab_id == current_user.lab_id)
    return q.all()

@router.post("/", response_model=VacationResponse)
def create_vacation(vacation: VacationCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = vacation.dict()
    if current_user.role != "superadmin":
        payload["lab_id"] = current_user.lab_id
    db_vac = Vacation(**payload)
    db.add(db_vac)
    db.commit()
    db.refresh(db_vac)
    return db_vac
