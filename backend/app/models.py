from sqlalchemy import Column, Integer, String, Date, Float, JSON, ForeignKey, ARRAY, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql.sqltypes import DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")  # Updated
    is_active = Column(Boolean, nullable=False, default=True)  # Updated
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)  # Updated

class DentalPractice(Base):
    __tablename__ = "dental_practice"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    ico = Column(String, unique=True)
    dic = Column(String)
    address = Column(String)
    bank_details = Column(String)
    contact_info = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    birth_number = Column(String, unique=True, nullable=False)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    tooth_procedures = Column(JSON, nullable=True)  # Cumulative tooth map for patient
    created_at = Column(DateTime, default=datetime.utcnow)
    jobs = relationship("Job", back_populates="patient")

class Clinic(Base):
    __tablename__ = "clinics"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    ico = Column(String, unique=True)
    dic = Column(String)
    address = Column(String)
    bank_details = Column(String)
    contact_info = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    jobs = relationship("Job", back_populates="clinic")

class Doctor(Base):
    __tablename__ = "doctors"
    id = Column(Integer, primary_key=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    title_before = Column(String)
    title_after = Column(String)
    contact_info = Column(JSON)
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    jobs = relationship("Job", back_populates="doctor")

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    address = Column(String)
    city = Column(String)
    postal_code = Column(String)
    country = Column(String, default="Slovakia")
    tax_id = Column(String)  # IČO/DIC
    vat_id = Column(String)   # IČ DPH
    bank_account = Column(String)  # IBAN
    bank_bic = Column(String)     # BIC/SWIFT
    phone = Column(String)
    email = Column(String)
    website = Column(String)
    logo_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Technician(Base):
    __tablename__ = "technicians"
    id = Column(Integer, primary_key=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    title_before = Column(String)
    title_after = Column(String)
    contact_info = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    jobs = relationship("Job", back_populates="technician")

class PriceList(Base):
    __tablename__ = "price_list"
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    valid_from = Column(Date)
    valid_to = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)

class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=False)
    price = Column(Float, nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(String, nullable=True)
    procedure_codes = Column(JSON, nullable=True)  # Store as JSON list
    procedure_quantities = Column(JSON, nullable=True)  # Store as JSON dict
    tooth_procedures = Column(JSON, nullable=True)  # Job-specific tooth map data
    description = Column(String, nullable=True)  # New field for description
    tooth_color = Column(String, nullable=True)  # Shade like A1-D4
    created_at = Column(DateTime, default=datetime.utcnow)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    try_in = Column(Date, nullable=True)

    patient = relationship("Patient", back_populates="jobs")
    clinic = relationship("Clinic", back_populates="jobs")
    doctor = relationship("Doctor", back_populates="jobs")
    technician = relationship("Technician", back_populates="jobs")


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    number = Column(String, unique=True, nullable=False)
    status = Column(String, nullable=False, default="draft")  # draft, issued, paid, cancelled
    total_amount = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    issued_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)

    clinic = relationship("Clinic")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    description = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False, default=0.0)
    line_total = Column(Float, nullable=False, default=0.0)

    invoice = relationship("Invoice", back_populates="items")
    job = relationship("Job")

class Vacation(Base):
    __tablename__ = "vacations"
    id = Column(Integer, primary_key=True)
    start = Column(DateTime, nullable=False)
    end = Column(DateTime, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)