from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from .models import User
from .database import get_db
import os
from pathlib import Path
from dotenv import load_dotenv

APP_ENV = os.getenv("APP_ENV", "development")  # development | production | test

# Load environment variables conditionally
if os.getenv("TESTING") == "1":
    # Testing environment: provide a deterministic test secret
    SECRET_KEY = "test-secret-key-for-testing-only-do-not-use-in-production"
    ALGORITHM = os.getenv("ALGORITHM", "HS256")
elif APP_ENV == "development":
    # Development: allow loading from a local .env.dev in the backend folder if present
    backend_root = Path(__file__).resolve().parents[1]
    dev_env_file = backend_root / ".env.dev"
    # Load without overriding any pre-set environment variable (e.g., from Docker)
    if dev_env_file.exists():
        load_dotenv(dotenv_path=dev_env_file, override=False)
    # Provide a soft default to avoid crashes during local dev, but encourage overriding
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
    ALGORITHM = os.getenv("ALGORITHM", "HS256")
else:
    # Production: absolutely require explicit SECRET_KEY from the environment
    SECRET_KEY = os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY environment variable must be set for production use")
    ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/token")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_superadmin_user(current_user: User = Depends(get_current_user)):
    """Dependency to ensure current user is a superadmin."""
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required"
        )
    return current_user