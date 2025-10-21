from pydantic import BaseModel, field_validator, ConfigDict
from datetime import datetime, date
from typing import Optional, List, Dict

class UserCreate(BaseModel):
    nickname: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = "user"  # Allow role to be set
    lab_id: Optional[int] = None  # For assigning users to an existing lab

class UserResponse(BaseModel):
    id: int
    nickname: Optional[str] = None
    email: Optional[str] = None
    role: str  # Add this line
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

# Warehouse schemas
class WarehouseItemBase(BaseModel):
    name: str
    sku: Optional[str] = None
    quantity: float = 0
    unit: str = "pcs"
    min_threshold: Optional[float] = None
    category: Optional[str] = None
    location: Optional[str] = None
    cost_price: Optional[float] = None
    notes: Optional[str] = None

class WarehouseItemCreate(WarehouseItemBase):
    pass

class WarehouseItemUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    min_threshold: Optional[float] = None
    category: Optional[str] = None
    location: Optional[str] = None
    cost_price: Optional[float] = None
    notes: Optional[str] = None

class WarehouseItemResponse(WarehouseItemBase):
    id: int
    lab_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

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
    model_config = ConfigDict(from_attributes=True)

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
    model_config = ConfigDict(from_attributes=True)

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
    model_config = ConfigDict(from_attributes=True)

class LabCreate(BaseModel):
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

class LabResponse(LabCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    # Allow creating this model from ORM (SQLAlchemy) objects
    model_config = ConfigDict(from_attributes=True)

class SignupRequest(BaseModel):
    # Lab information
    lab_name: str
    lab_address: Optional[str] = None
    lab_city: Optional[str] = None
    lab_postal_code: Optional[str] = None
    lab_country: Optional[str] = "Slovakia"
    lab_tax_id: Optional[str] = None
    lab_vat_id: Optional[str] = None
    lab_phone: Optional[str] = None
    lab_email: Optional[str] = None
    
    # Admin user credentials
    nickname: Optional[str] = None  # Optional display name; login is by email
    password: str
    email: Optional[str] = None

class SignupResponse(BaseModel):
    lab: LabResponse
    user: UserResponse
    token: Token

class TechnicianCreate(BaseModel):
    first_name: str
    last_name: str
    title_before: Optional[str] = None
    title_after: Optional[str] = None
    contact_info: Optional[Dict] = None

class TechnicianResponse(TechnicianCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PriceListCreate(BaseModel):
    code: str
    description: str
    price: float
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None

class PriceListResponse(PriceListCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

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
    tooth_color: Optional[str] = None  # A1-D4
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    try_in: Optional[date] = None

    @field_validator('tooth_color')
    @classmethod
    def validate_tooth_color(cls, v):
        if v is None or v == '':
            return None
        valid = {f"{letter}{num}" for letter in ['A','B','C','D'] for num in range(1,5)}
        if v not in valid:
            raise ValueError("Invalid tooth_color. Allowed shades: A1-D4")
        return v

class JobResponse(JobCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Invoicing
class InvoiceItemCreate(BaseModel):
    job_id: int
    description: str
    quantity: int
    unit_price: float


class InvoiceItemResponse(InvoiceItemCreate):
    id: int
    line_total: float

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)

# Vacation schemas
class VacationCreate(BaseModel):
    start: datetime
    end: datetime
    description: Optional[str] = None

class VacationResponse(VacationCreate):
    id: int
    created_at: datetime
    lab_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)