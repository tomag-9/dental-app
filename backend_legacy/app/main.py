from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from app.routes import patients, clinics, doctors, technicians, price_list, jobs, users, invoices, labs, vacations, subscriptions, warehouse
from app.routes import patient_toothmap
from app.models import Base
from app.database import engine

app = FastAPI(
    title="Zubná technika API",
    openapi_tags=[
        {"name": "users", "description": "User authentication and registration"},
        {"name": "patients", "description": "Patient management"},
        {"name": "jobs", "description": "Job management"},
        {"name": "price_list", "description": "Price list management"},
        {"name": "clinics", "description": "Clinic management"},
        {"name": "doctors", "description": "Doctor management"},
        {"name": "technicians", "description": "Technician management"},
    ],
    swagger_ui_parameters={
        "defaultModelsExpandDepth": -1,  # Hide schemas in Swagger UI
    }
)

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Create database tables only if not in testing mode
# Tests will create their own tables in conftest.py
if os.getenv("TESTING") != "1":
    Base.metadata.create_all(bind=engine)

# Include routers
app.include_router(patients.router)
app.include_router(patient_toothmap.router)
app.include_router(clinics.router)
app.include_router(doctors.router)
app.include_router(technicians.router)
app.include_router(price_list.router)
app.include_router(jobs.router)
app.include_router(users.router)
app.include_router(invoices.router)
app.include_router(subscriptions.router)
app.include_router(labs.router)
app.include_router(vacations.router)
app.include_router(warehouse.router)

@app.get("/")
def read_root():
    return {"message": "Zubná technika API"}