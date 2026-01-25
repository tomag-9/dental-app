from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models import Subscription, Lab
from app.database import get_db
from app.auth import get_superadmin_user, get_current_user
from app.models import User
from pydantic import BaseModel, ConfigDict
from datetime import date
from typing import Optional

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

class SubscriptionUpdate(BaseModel):
    plan: Optional[str] = None
    status: Optional[str] = None
    seats: Optional[int] = None
    current_period_start: Optional[date] = None
    current_period_end: Optional[date] = None

class SubscriptionResponse(BaseModel):
    id: int
    lab_id: int
    plan: str
    status: str
    seats: int
    current_period_start: Optional[date]
    current_period_end: Optional[date]
    
    model_config = ConfigDict(from_attributes=True)

@router.get("/my", response_model=SubscriptionResponse)
def get_my_subscription(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current user's lab subscription."""
    if not current_user.lab_id:
        raise HTTPException(status_code=404, detail="No lab associated with user")
    
    subscription = db.query(Subscription).filter(Subscription.lab_id == current_user.lab_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="No subscription found")
    
    return subscription

@router.get("/{subscription_id}", response_model=SubscriptionResponse)
def get_subscription(subscription_id: int, current_user: User = Depends(get_superadmin_user), db: Session = Depends(get_db)):
    """Get subscription by ID (superadmin only)."""
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return subscription

@router.put("/{subscription_id}", response_model=SubscriptionResponse)
def update_subscription(
    subscription_id: int, 
    update_data: SubscriptionUpdate,
    current_user: User = Depends(get_superadmin_user),
    db: Session = Depends(get_db)
):
    """Update subscription (superadmin only)."""
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    if update_data.plan is not None:
        subscription.plan = update_data.plan
    if update_data.status is not None:
        subscription.status = update_data.status
    if update_data.seats is not None:
        subscription.seats = update_data.seats
    if update_data.current_period_start is not None:
        subscription.current_period_start = update_data.current_period_start
    if update_data.current_period_end is not None:
        subscription.current_period_end = update_data.current_period_end
    
    db.commit()
    db.refresh(subscription)
    return subscription

@router.get("/", response_model=list[SubscriptionResponse])
def get_all_subscriptions(current_user: User = Depends(get_superadmin_user), db: Session = Depends(get_db)):
    """Get all subscriptions (superadmin only)."""
    return db.query(Subscription).all()
