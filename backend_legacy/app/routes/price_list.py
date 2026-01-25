from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models import PriceList, User
from app.schemas import PriceListCreate, PriceListResponse
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/price_list", tags=["price_list"])

@router.post("/", response_model=PriceListResponse)
def create_price_list(price_list: PriceListCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = price_list.model_dump()
    if current_user.role != "superadmin":
        payload["lab_id"] = current_user.lab_id
    db_price_list = PriceList(**payload)
    db.add(db_price_list)
    db.commit()
    db.refresh(db_price_list)
    return db_price_list

@router.get("/", response_model=list[PriceListResponse])
def get_price_lists(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(PriceList)
    if current_user.role != "superadmin":
        q = q.filter(PriceList.lab_id == current_user.lab_id)
    return q.all()

@router.get("/{price_list_id}", response_model=PriceListResponse)
def get_price_list(price_list_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(PriceList).filter(PriceList.id == price_list_id)
    if current_user.role != "superadmin":
        q = q.filter(PriceList.lab_id == current_user.lab_id)
    price_list = q.first()
    if price_list is None:
        raise HTTPException(status_code=404, detail="Položka cenníka nenájdená")
    return price_list

@router.put("/{price_list_id}", response_model=PriceListResponse)
def update_price_list(price_list_id: int, price_list: PriceListCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(PriceList).filter(PriceList.id == price_list_id)
    if current_user.role != "superadmin":
        q = q.filter(PriceList.lab_id == current_user.lab_id)
    db_price_list = q.first()
    if db_price_list is None:
        raise HTTPException(status_code=404, detail="Položka cenníka nenájdená")
    for key, value in price_list.model_dump().items():
        setattr(db_price_list, key, value)
    db.commit()
    db.refresh(db_price_list)
    return db_price_list

@router.delete("/{price_list_id}")
def delete_price_list(price_list_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    q = db.query(PriceList).filter(PriceList.id == price_list_id)
    if current_user.role != "superadmin":
        q = q.filter(PriceList.lab_id == current_user.lab_id)
    price_list = q.first()
    if price_list is None:
        raise HTTPException(status_code=404, detail="Položka cenníka nenájdená")
    db.delete(price_list)
    db.commit()
    return {"message": "Položka cenníka vymazaná"}