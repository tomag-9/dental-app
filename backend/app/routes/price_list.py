from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from fastapi import Depends
from app.models import PriceList
from app.schemas import PriceListCreate, PriceListResponse
from app.database import get_db

router = APIRouter(prefix="/price_list", tags=["price_list"])

@router.post("/", response_model=PriceListResponse)
def create_price_list(price_list: PriceListCreate, db: Session = Depends(get_db)):
    db_price_list = PriceList(**price_list.dict())
    db.add(db_price_list)
    db.commit()
    db.refresh(db_price_list)
    return db_price_list

@router.get("/", response_model=list[PriceListResponse])
def get_price_lists(db: Session = Depends(get_db)):
    return db.query(PriceList).all()

@router.get("/{price_list_id}", response_model=PriceListResponse)
def get_price_list(price_list_id: int, db: Session = Depends(get_db)):
    price_list = db.query(PriceList).filter(PriceList.id == price_list_id).first()
    if price_list is None:
        raise HTTPException(status_code=404, detail="Položka cenníka nenájdená")
    return price_list

@router.put("/{price_list_id}", response_model=PriceListResponse)
def update_price_list(price_list_id: int, price_list: PriceListCreate, db: Session = Depends(get_db)):
    db_price_list = db.query(PriceList).filter(PriceList.id == price_list_id).first()
    if db_price_list is None:
        raise HTTPException(status_code=404, detail="Položka cenníka nenájdená")
    for key, value in price_list.dict().items():
        setattr(db_price_list, key, value)
    db.commit()
    db.refresh(db_price_list)
    return db_price_list

@router.delete("/{price_list_id}")
def delete_price_list(price_list_id: int, db: Session = Depends(get_db)):
    price_list = db.query(PriceList).filter(PriceList.id == price_list_id).first()
    if price_list is None:
        raise HTTPException(status_code=404, detail="Položka cenníka nenájdená")
    db.delete(price_list)
    db.commit()
    return {"message": "Položka cenníka vymazaná"}