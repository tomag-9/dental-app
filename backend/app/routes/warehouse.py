from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import WarehouseItem, User
from app.schemas import WarehouseItemCreate, WarehouseItemUpdate, WarehouseItemResponse
from app.auth import get_current_user

router = APIRouter(prefix="/warehouse", tags=["warehouse"]) 


def _ensure_access(item: WarehouseItem, current_user: User):
    if current_user.role != "superadmin" and item.lab_id != current_user.lab_id:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/items", response_model=List[WarehouseItemResponse])
def list_items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    q = db.query(WarehouseItem)
    if current_user.role != "superadmin":
        if not current_user.lab_id:
            return []  # Users without lab_id see empty list
        q = q.filter(WarehouseItem.lab_id == current_user.lab_id)
    return q.all()


@router.post("/items", response_model=WarehouseItemResponse)
def create_item(item: WarehouseItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    lab_id = current_user.lab_id
    if not lab_id:
        raise HTTPException(status_code=400, detail="User must be assigned to a lab to create warehouse items")
    
    if current_user.role == "superadmin" and getattr(item, "lab_id", None):
        lab_id = item.lab_id  # not exposed in schema, kept simple
    # check SKU uniqueness within lab if provided
    if item.sku:
        exists = db.query(WarehouseItem).filter(WarehouseItem.lab_id == lab_id, WarehouseItem.sku == item.sku).first()
        if exists:
            raise HTTPException(status_code=400, detail="SKU already exists in this lab")
    db_item = WarehouseItem(
        name=item.name,
        sku=item.sku,
        quantity=item.quantity or 0,
        unit=item.unit or "pcs",
        min_threshold=item.min_threshold,
        category=item.category,
        location=item.location,
        cost_price=item.cost_price,
        notes=item.notes,
        lab_id=lab_id,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@router.get("/items/{item_id}", response_model=WarehouseItemResponse)
def get_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    item = db.get(WarehouseItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    _ensure_access(item, current_user)
    return item


@router.put("/items/{item_id}", response_model=WarehouseItemResponse)
def update_item(item_id: int, payload: WarehouseItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    item = db.get(WarehouseItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    _ensure_access(item, current_user)
    # SKU uniqueness check if updating
    if payload.sku and payload.sku != item.sku:
        exists = db.query(WarehouseItem).filter(WarehouseItem.lab_id == item.lab_id, WarehouseItem.sku == payload.sku).first()
        if exists:
            raise HTTPException(status_code=400, detail="SKU already exists in this lab")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    item = db.get(WarehouseItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    _ensure_access(item, current_user)
    db.delete(item)
    db.commit()
    return {"ok": True}
