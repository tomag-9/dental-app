from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Vacation
from app.schemas import VacationCreate, VacationResponse

router = APIRouter(prefix="/vacations", tags=["vacations"])

@router.get("/", response_model=list[VacationResponse])
def get_vacations(db: Session = Depends(get_db)):
    return db.query(Vacation).all()

@router.post("/", response_model=VacationResponse)
def create_vacation(vacation: VacationCreate, db: Session = Depends(get_db)):
    db_vac = Vacation(**vacation.dict())
    db.add(db_vac)
    db.commit()
    db.refresh(db_vac)
    return db_vac
