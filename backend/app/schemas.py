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
    tooth_procedures: Optional[Dict] = None  # Cumulative tooth map

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

class CompanyCreate(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "Slovakia"
    tax_id: Optional[str] = None  # IČO/DIC
    vat_id: Optional[str] = None   # IČ DPH
    bank_account: Optional[str] = None  # IBAN
    bank_bic: Optional[str] = None     # BIC/SWIFT
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None

class CompanyResponse(CompanyCreate):
    id: int
    created_at: datetime
    updated_at: datetime

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
    tooth_procedures: Optional[Dict[str, str]] = None  # Job-specific tooth map
    description: Optional[str] = None  # New field for description
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    try_in: Optional[date] = None

class JobResponse(JobCreate):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


# Invoicing
class InvoiceItemCreate(BaseModel):
    job_id: int
    description: str
    quantity: int
    unit_price: float


class InvoiceItemResponse(InvoiceItemCreate):
    id: int
    line_total: float

    class Config:
        orm_mode = True


class InvoiceCreate(BaseModel):
    clinic_id: int
    job_ids: List[int]


class InvoiceUpdateStatus(BaseModel):
    status: str  # draft, issued, paid, cancelled


class InvoiceResponse(BaseModel):
    id: int
    number: str
    clinic_id: int
    clinic_name: Optional[str] = None
    status: str
    total_amount: float
    created_at: datetime
    issued_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    items: List[InvoiceItemResponse]
    patient_names: Optional[List[str]] = None

    class Config:
        orm_mode = True

# Vacation schemas
class VacationCreate(BaseModel):
    start: datetime
    end: datetime
    description: Optional[str] = None

class VacationResponse(VacationCreate):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True