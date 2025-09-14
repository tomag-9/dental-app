from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List, Dict

class UserCreate(BaseModel):
    username: str
    password: Optional[str] = None
    role: Optional[str] = "user"  # Allow role to be set

class UserResponse(BaseModel):
    id: int
    username: str
    role: str  # Add this line
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class DentalPracticeCreate(BaseModel):
    name: str
    ico: Optional[str] = None
    dic: Optional[str] = None
    address: Optional[str] = None
    bank_details: Optional[str] = None
    contact_info: Optional[Dict] = None

class DentalPracticeResponse(DentalPracticeCreate):
    id: int
    created_at: datetime

class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    birth_number: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class PatientResponse(PatientCreate):
    id: int
    created_at: datetime

class ClinicCreate(BaseModel):
    name: str
    ico: Optional[str] = None
    dic: Optional[str] = None
    address: Optional[str] = None
    bank_details: Optional[str] = None
    contact_info: Optional[Dict] = None

class ClinicResponse(ClinicCreate):
    id: int
    created_at: datetime

class DoctorCreate(BaseModel):
    first_name: str
    last_name: str
    title_before: Optional[str] = None
    title_after: Optional[str] = None
    contact_info: Optional[Dict] = None
    clinic_id: Optional[int] = None

class DoctorResponse(DoctorCreate):
    id: int
    created_at: datetime

class TechnicianCreate(BaseModel):
    first_name: str
    last_name: str
    title_before: Optional[str] = None
    title_after: Optional[str] = None
    contact_info: Optional[Dict] = None

class TechnicianResponse(TechnicianCreate):
    id: int
    created_at: datetime

class PriceListCreate(BaseModel):
    code: str
    description: str
    price: float
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None

class PriceListResponse(PriceListCreate):
    id: int
    created_at: datetime

class JobCreate(BaseModel):
    patient_id: int
    clinic_id: int
    doctor_id: int
    technician_id: int
    price: Optional[float] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    procedure_codes: Optional[List[str]] = None
    procedure_quantities: Optional[Dict[str, int]] = None  # New field for quantities

class JobResponse(JobCreate):
    id: int
    created_at: datetime