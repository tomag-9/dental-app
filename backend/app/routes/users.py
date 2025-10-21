from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.models import User, Lab, Subscription
from app.schemas import UserCreate, UserResponse, Token, SignupRequest, SignupResponse
from app.database import get_db
from app.auth import get_current_user, get_password_hash, verify_password, create_access_token, get_superadmin_user
from datetime import datetime, timedelta

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/signup", response_model=SignupResponse)
def signup(signup_data: SignupRequest, db: Session = Depends(get_db)):
    """
    Public endpoint for new lab registration.
    Creates a Lab, admin User, and Subscription atomically.
    Returns JWT token for immediate login.
    """
    # Validate unique lab name
    existing_lab = db.query(Lab).filter(Lab.name == signup_data.lab_name).first()
    if existing_lab:
        raise HTTPException(status_code=400, detail="Lab name already exists")
    
    # Validate unique email
    if signup_data.email:
        existing_user_email = db.query(User).filter(User.email == signup_data.email).first()
        if existing_user_email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    try:
        # Create Lab
        new_lab = Lab(
            name=signup_data.lab_name,
            address=signup_data.lab_address,
            city=signup_data.lab_city,
            postal_code=None,
            country=None,
            tax_id=None,
            vat_id=None,
            phone=None,
            email=signup_data.lab_email or signup_data.email,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(new_lab)
        db.flush()  # Get lab ID without committing
        
        # Create admin User
        hashed_password = get_password_hash(signup_data.password)
        new_user = User(
            nickname=signup_data.nickname,
            hashed_password=hashed_password,
            role="admin",
            lab_id=new_lab.id,
            email=signup_data.email,
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(new_user)
        db.flush()
        
        # Create free subscription (30-day trial)
        subscription = Subscription(
            lab_id=new_lab.id,
            plan="free",
            status="active",
            seats=5,
            current_period_start=datetime.utcnow().date(),
            current_period_end=(datetime.utcnow() + timedelta(days=30)).date(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(subscription)
        
        # Commit transaction
        db.commit()
        db.refresh(new_lab)
        db.refresh(new_user)
        db.refresh(subscription)

        # Create JWT token for auto-login using email as subject
        access_token = create_access_token(data={"sub": new_user.email})

        return SignupResponse(
            lab=new_lab,
            user=UserResponse(
                id=new_user.id,
                nickname=new_user.nickname,
                email=new_user.email,
                role=new_user.role,
                is_active=new_user.is_active,
                created_at=new_user.created_at
            ),
            token=Token(access_token=access_token, token_type="bearer")
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.get("/", response_model=list[UserResponse])
def get_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Only admins can view users")
    q = db.query(User)
    if current_user.role != "superadmin":
        q = q.filter(User.lab_id == current_user.lab_id)
    users = q.all()
    return [UserResponse(
        id=user.id,
        nickname=user.nickname,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at
    ) for user in users]

@router.post("/register", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    if not user.email:
        raise HTTPException(status_code=400, detail="Email is required")
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = get_password_hash(user.password or "")
    db_user = User(
        nickname=user.nickname,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role or "user",
        lab_id=user.lab_id,
        created_at=datetime.utcnow(),
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/", response_model=UserResponse)
def create_user_direct(user: UserCreate, db: Session = Depends(get_db)):
    if not user.email:
        raise HTTPException(status_code=400, detail="Email is required")
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = get_password_hash(user.password or "")
    db_user = User(nickname=user.nickname, email=user.email, hashed_password=hashed_password, role=user.role or "user")
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Support login with email (sent in username field)
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
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
    if me_update.nickname and me_update.nickname != current_user.nickname:
        db_user = db.query(User).filter(User.nickname == me_update.nickname).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Nickname already registered")
        current_user.nickname = me_update.nickname
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
    if user_update.nickname:
        if db.query(User).filter(User.nickname == user_update.nickname).first() and db_user.nickname != user_update.nickname:
            raise HTTPException(status_code=400, detail="Nickname already registered")
        db_user.nickname = user_update.nickname
    if user_update.password:
        db_user.hashed_password = get_password_hash(user_update.password)
    if user_update.role:
        db_user.role = user_update.role
    db.commit()
    db.refresh(db_user)
    return db_user

# Superadmin-only endpoints
@router.get("/superadmin/all", response_model=list[dict])
def get_all_users(current_user: User = Depends(get_superadmin_user), db: Session = Depends(get_db)):
    """Get all users across all labs with lab info (superadmin only)."""
    users = db.query(User).all()
    result = []
    for user in users:
        lab = db.query(Lab).filter(Lab.id == user.lab_id).first() if user.lab_id else None
        result.append({
            "id": user.id,
            "nickname": user.nickname,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "lab_id": user.lab_id,
            "lab_name": lab.name if lab else None,
            "created_at": user.created_at
        })
    return result

@router.put("/superadmin/{user_id}/toggle-active")
def toggle_user_active(user_id: int, current_user: User = Depends(get_superadmin_user), db: Session = Depends(get_db)):
    """Toggle user active status (superadmin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}