from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.models import User
from app.schemas import UserCreate, UserResponse, Token
from app.database import get_db
from app.auth import get_current_user, get_password_hash, verify_password, create_access_token

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=list[UserResponse])
def get_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view users")
    users = db.query(User).all()
    return [UserResponse(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at
    ) for user in users]

@router.post("/register", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/", response_model=UserResponse)
def create_user_direct(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed_password, role=user.role or "user")
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me/", response_model=UserResponse)
def get_current_user_me(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

@router.put("/me/", response_model=UserResponse)
def update_current_user(me_update: UserCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if me_update.username and me_update.username != current_user.username:
        db_user = db.query(User).filter(User.username == me_update.username).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        current_user.username = me_update.username
    if me_update.password:
        current_user.hashed_password = get_password_hash(me_update.password)
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user_update: UserCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user or getattr(current_user, 'role', None) != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update users")
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
    if db.query(User).filter(User.username == user_update.username).first() and db_user.username != user_update.username:
        raise HTTPException(status_code=400, detail="Username already registered")
    db_user.username = user_update.username
    if user_update.password:
        db_user.hashed_password = get_password_hash(user_update.password)
    if user_update.role:
        db_user.role = user_update.role
    db.commit()
    db.refresh(db_user)
    return db_user