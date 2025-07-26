from sqlalchemy import Column, Integer, String, Date, Float, JSON, ForeignKey, ARRAY, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql.sqltypes import DateTime
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    created_at = Column(DateTime, default=datetime.utcnow)

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

class Technician(Base):
    __tablename__ = "technicians"
    id = Column(Integer, primary_key=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    title_before = Column(String)
    title_after = Column(String)
    contact_info = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    clinic_id = Column(Integer, ForeignKey("clinics.id"))
    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    technician_id = Column(Integer, ForeignKey("technicians.id"))
    price = Column(Float)
    due_date = Column(Date)
    status = Column(String)
    procedure_codes = Column(ARRAY(String))
    created_at = Column(DateTime, default=datetime.utcnow)