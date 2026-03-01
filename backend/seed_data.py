"""
Seed data script for the dental app
This script creates test users and sample data for development/testing
"""

from django.contrib.auth import authenticate
from apps.core.models import User, Lab
from apps.crm.models import Patient, Clinic, Doctor
from apps.jobs.models import Job, Technician, Vacation
from apps.finance.models import Invoice, PriceList
from apps.inventory.models import WarehouseItem
import datetime

def run():
    # Get or create default lab
    lab, _ = Lab.objects.get_or_create(
        name='Default Lab',
        defaults={'country': 'Slovakia', 'email': 'lab@example.com'}
    )

    print("=== CREATING TEST USERS ===")
    # Delete existing test users
    User.objects.filter(username__in=['user', 'superadmin', 'admin']).delete()

    # Create admin (superuser)
    admin = User.objects.create_superuser(
        username='admin',
        email='admin@example.com',
        password='admin123',
        role='superadmin'
    )
    admin.lab = lab
    admin.save()

    # Create regular user
    user = User.objects.create_user(
        username='user',
        email='user@example.com',
        password='user123',
        role='user'
    )
    user.lab = lab
    user.save()

    # Create superadmin user
    superadmin = User.objects.create_user(
        username='superadmin',
        email='superadmin@example.com',
        password='superadmin123',
        role='superadmin'
    )
    superadmin.is_superuser = True
    superadmin.is_staff = True
    superadmin.lab = lab
    superadmin.save()

    print("✓ admin (password: admin123)")
    print("✓ user (password: user123)")
    print("✓ superadmin (password: superadmin123)")

    # Test authentication
    print("\n=== AUTHENTICATION TEST ===")
    test_user = authenticate(username='user', password='user123')
    print(f"User auth test: {'✓ PASS' if test_user else '✗ FAIL'}")

    test_admin = authenticate(username='admin', password='admin123')
    print(f"Admin auth test: {'✓ PASS' if test_admin else '✗ FAIL'}")

    # Create seed data
    print("\n=== CREATING SEED DATA ===")

    # Clinics
    clinic1, _ = Clinic.objects.get_or_create(
        name='Downtown Clinic',
        defaults={'lab': lab, 'address': '123 Main St', 'city': 'Bratislava', 'phone': '+421 2 1234 5678'}
    )

    clinic2, _ = Clinic.objects.get_or_create(
        name='Uptown Clinic',
        defaults={'lab': lab, 'address': '456 Oak Ave', 'city': 'Kosice', 'phone': '+421 55 1234 5678'}
    )
    print(f"✓ Created {Clinic.objects.count()} clinics")

    # Doctors
    doctor1, _ = Doctor.objects.get_or_create(
        name='Dr. John Smith',
        defaults={'lab': lab, 'specialization': 'General Dentistry', 'phone': '+421 910 123456'}
    )

    doctor2, _ = Doctor.objects.get_or_create(
        name='Dr. Jane Doe',
        defaults={'lab': lab, 'specialization': 'Orthodontics', 'phone': '+421 915 234567'}
    )
    print(f"✓ Created {Doctor.objects.count()} doctors")

    # Patients
    patient1, _ = Patient.objects.get_or_create(
        name='John Patient',
        defaults={
            'lab': lab,
            'clinic': clinic1,
            'phone': '+421 900 111111',
            'email': 'john@patient.com'
        }
    )

    patient2, _ = Patient.objects.get_or_create(
        name='Maria Garcia',
        defaults={
            'lab': lab,
            'clinic': clinic2,
            'phone': '+421 910 222222',
            'email': 'maria@patient.com'
        }
    )
    print(f"✓ Created {Patient.objects.count()} patients")

    # Technicians
    tech1, _ = Technician.objects.get_or_create(
        name='Tom Mechanic',
        defaults={'lab': lab, 'specialization': 'Prosthodontics', 'phone': '+421 920 333333'}
    )

    tech2, _ = Technician.objects.get_or_create(
        name='Lisa Fabricator',
        defaults={'lab': lab, 'specialization': 'Orthodontic Lab', 'phone': '+421 925 444444'}
    )
    print(f"✓ Created {Technician.objects.count()} technicians")

    # Jobs
    job1 = Job.objects.create(
        lab=lab,
        patient=patient1,
        doctor=doctor1,
        technician=tech1,
        description='Crown preparation for tooth #16',
        status='pending',
        job_type='crown'
    )

    job2 = Job.objects.create(
        lab=lab,
        patient=patient2,
        doctor=doctor2,
        technician=tech2,
        description='Braces adjustment',
        status='in_progress',
        job_type='braces'
    )
    print(f"✓ Created {Job.objects.count()} jobs")

    # Invoices
    Invoice.objects.all().delete()
    invoice1 = Invoice.objects.create(
        lab=lab,
        patient=patient1,
        doctor=doctor1,
        amount=250.00,
        status='pending',
        due_date=datetime.date.today() + datetime.timedelta(days=30)
    )

    invoice2 = Invoice.objects.create(
        lab=lab,
        patient=patient2,
        doctor=doctor2,
        amount=500.00,
        status='paid',
        paid_date=datetime.date.today() - datetime.timedelta(days=5),
        due_date=datetime.date.today()
    )
    print(f"✓ Created {Invoice.objects.count()} invoices")

    # Price Lists
    pricelist, _ = PriceList.objects.get_or_create(
        lab=lab,
        name='Standard Pricing',
        defaults={'currency': 'EUR'}
    )
    print(f"✓ Created {PriceList.objects.count()} price lists")

    # Warehouse Items
    WarehouseItem.objects.all().delete()
    item1 = WarehouseItem.objects.create(
        lab=lab,
        name='Dental Cement',
        quantity=50,
        unit='box',
        price=15.50
    )

    item2 = WarehouseItem.objects.create(
        lab=lab,
        name='Composite Resin',
        quantity=100,
        unit='syringe',
        price=8.75
    )
    print(f"✓ Created {WarehouseItem.objects.count()} warehouse items")

    # Vacations
    vacation1, _ = Vacation.objects.get_or_create(
        lab=lab,
        user=admin,
        start_date=datetime.date(2026, 7, 1),
        defaults={'end_date': datetime.date(2026, 7, 15), 'status': 'approved'}
    )
    print(f"✓ Created {Vacation.objects.count()} vacations")

    print("\n=== ALL SEED DATA CREATED SUCCESSFULLY ===")
