from datetime import date
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    User,
    Clinic,
    Doctor,
    Technician,
    Patient,
    PriceList,
    Job,
)
from app.auth import get_password_hash


def get_or_create(session: Session, model, defaults: dict | None = None, **kwargs):
    instance = session.query(model).filter_by(**kwargs).first()
    if instance:
        return instance, False
    params = dict(**kwargs)
    if defaults:
        params.update(defaults)
    instance = model(**params)
    session.add(instance)
    session.flush()
    return instance, True


def run() -> None:
    db = SessionLocal()
    try:
        # Users
        # Superadmin user (no lab_id needed)
        superadmin_user, _ = get_or_create(
            db,
            User,
            defaults={
                "hashed_password": get_password_hash("password123"),
                "role": "superadmin",
                "is_active": True,
                "nickname": "superadmin",
            },
            email="superadmin@dentallab.com",
        )
        if not getattr(superadmin_user, "hashed_password", None) or len(superadmin_user.hashed_password) < 10:
            superadmin_user.hashed_password = get_password_hash("password123")
        superadmin_user.role = "superadmin"
        superadmin_user.is_active = True
        superadmin_user.email = superadmin_user.email or "superadmin@dentallab.com"
        superadmin_user.nickname = superadmin_user.nickname or "superadmin"
        
        admin_user, _ = get_or_create(
            db,
            User,
            defaults={
                "hashed_password": get_password_hash("password123"),
                "role": "admin",
                "is_active": True,
                "nickname": "admin",
            },
            email="admin@dentallab.com",
        )
        if not getattr(admin_user, "hashed_password", None) or len(admin_user.hashed_password) < 10:
            admin_user.hashed_password = get_password_hash("password123")
        admin_user.role = "admin"
        admin_user.is_active = True
        admin_user.email = admin_user.email or "admin@dentallab.com"
        admin_user.nickname = admin_user.nickname or "admin"

        normal_user, _ = get_or_create(
            db,
            User,
            defaults={
                "hashed_password": get_password_hash("userpass"),
                "role": "user",
                "is_active": True,
                "nickname": "user1",
            },
            email="user1@dentallab.com",
        )
        if not getattr(normal_user, "hashed_password", None) or len(normal_user.hashed_password) < 10:
            normal_user.hashed_password = get_password_hash("userpass")
        normal_user.role = "user"
        normal_user.is_active = True
        normal_user.email = normal_user.email or "user1@dentallab.com"
        normal_user.nickname = normal_user.nickname or "user1"

        db.commit()

        # Clinics
        clinic1, _ = get_or_create(db, Clinic, name="Smile Dental Clinic")
        clinic1.address = clinic1.address or "123 Main St"
        clinic1.ico = clinic1.ico or "12345678"
        clinic1.dic = clinic1.dic or "SK1234567890"

        clinic2, _ = get_or_create(db, Clinic, name="Bright Teeth Center")
        clinic2.address = clinic2.address or "456 Oak Ave"
        clinic2.ico = clinic2.ico or "87654321"
        clinic2.dic = clinic2.dic or "SK0987654321"

        db.commit()

        # Doctors
        doc1, _ = get_or_create(db, Doctor, first_name="John", last_name="Doe", clinic_id=clinic1.id)
        doc2, _ = get_or_create(db, Doctor, first_name="Eva", last_name="Novak", clinic_id=clinic2.id)

        # Technicians
        tech1, _ = get_or_create(db, Technician, first_name="Peter", last_name="Kovac")
        tech2, _ = get_or_create(db, Technician, first_name="Marta", last_name="Svobodova")

        db.commit()

        # Patients
        pat1, _ = get_or_create(
            db,
            Patient,
            first_name="Anna",
            last_name="Horvath",
            birth_number="900101/1234",
        )
        pat1.address = pat1.address or "Maple Street 10"
        pat1.phone = pat1.phone or "+421900111222"
        pat1.email = pat1.email or "anna@example.com"

        pat2, _ = get_or_create(
            db,
            Patient,
            first_name="Milan",
            last_name="Kral",
            birth_number="850505/5678",
        )
        pat2.address = pat2.address or "Pine Road 5"
        pat2.phone = pat2.phone or "+421900333444"
        pat2.email = pat2.email or "milan@example.com"

        db.commit()

        # Price List
        pl1, _ = get_or_create(db, PriceList, code="CROWN", description="Ceramic crown", price=250.0)
        pl2, _ = get_or_create(db, PriceList, code="IMPLANT", description="Dental implant", price=800.0)
        pl3, _ = get_or_create(db, PriceList, code="WHITEN", description="Teeth whitening", price=120.0)

        db.commit()

        # Jobs - create multiple for testing
        def ensure_job(pat, cli, doc, tech, price, status, desc, codes, quants):
            job, _ = get_or_create(
                db,
                Job,
                patient_id=pat.id,
                clinic_id=cli.id,
                doctor_id=doc.id,
                technician_id=tech.id,
                description=desc,
            )
            job.status = job.status or status
            job.price = job.price if job.price is not None else price
            job.due_date = job.due_date or date.today()
            job.procedure_codes = job.procedure_codes or codes
            job.procedure_quantities = job.procedure_quantities or quants
            return job

        ensure_job(
            pat1,
            clinic1,
            doc1,
            tech1,
            250.0,
            "planned",
            "Ceramic crown for tooth #16",
            [pl1.code],
            {pl1.code: 1},
        )
        ensure_job(
            pat2,
            clinic2,
            doc2,
            tech2,
            920.0,
            "in_progress",
            "Implant with whitening",
            [pl2.code, pl3.code],
            {pl2.code: 1, pl3.code: 1},
        )
        # Additional synthetic jobs
        patients = [pat1, pat2]
        clinics = [clinic1, clinic2]
        docs = [doc1, doc2]
        techs = [tech1, tech2]
        proc_sets = [
            ([pl1.code], {pl1.code: 1}, 250.0, "planned", "Single crown"),
            ([pl3.code], {pl3.code: 2}, 240.0, "in_progress", "Whitening x2"),
            ([pl2.code], {pl2.code: 1}, 800.0, "finished_unfactured", "Implant"),
            ([pl1.code, pl3.code], {pl1.code: 1, pl3.code: 1}, 370.0, "planned", "Crown + whitening"),
        ]
        for i in range(1, 21):
            p = patients[i % len(patients)]
            c = clinics[i % len(clinics)]
            d = docs[i % len(docs)]
            t = techs[i % len(techs)]
            codes, quants, price, status, desc = proc_sets[i % len(proc_sets)]
            ensure_job(p, c, d, t, price, status, f"Job #{i}: {desc}", codes, quants)

        db.commit()
        print("Seed completed: users, clinics, doctors, technicians, patients, price list, jobs (multiple)")
    finally:
        db.close()


if __name__ == "__main__":
    run()


