from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from app.database import get_db
from app.auth import get_current_user
from app.models import Invoice, InvoiceItem, Job, Clinic, User, Patient, Lab
from app.schemas import InvoiceCreate, InvoiceResponse, InvoiceUpdateStatus, InvoiceItemResponse, InvoiceResponse
import xml.etree.ElementTree as ET

try:
	import qrcode
	from qrcode.image.svg import SvgImage
except Exception:
	qrcode = None

router = APIRouter(prefix="/invoices", tags=["invoices"]) 


@router.get("/test")
def test_endpoint():
	return {"message": "Invoices router working"}

def generate_invoice_number(db: Session) -> str:
	# Simple incremental numbering: INV-<timestamp>-<count>
	count = db.query(Invoice).count() + 1
	return f"INV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{count:04d}"


@router.post("/", response_model=InvoiceResponse)
def create_invoice(payload: InvoiceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	if not current_user:
		raise HTTPException(status_code=401, detail="Not authenticated")

	clinic = db.query(Clinic).filter(Clinic.id == payload.clinic_id).first()
	if not clinic:
		raise HTTPException(status_code=404, detail="Clinic not found")
	# Enforce lab scoping for non-superadmin
	if current_user.role != "superadmin" and clinic.lab_id != current_user.lab_id:
		raise HTTPException(status_code=403, detail="Forbidden")

	jobs: List[Job] = db.query(Job).filter(Job.id.in_(payload.job_ids)).all()
	if len(jobs) != len(payload.job_ids):
		raise HTTPException(status_code=400, detail="One or more jobs not found")

	number = generate_invoice_number(db)
	invoice = Invoice(clinic_id=clinic.id, lab_id=clinic.lab_id, number=number, status="issued", created_at=datetime.utcnow(), issued_at=datetime.utcnow())
	db.add(invoice)
	db.flush()

	total_amount = 0.0
	for job in jobs:
		# Build items from job's procedures and quantities
		procedures = job.procedure_codes or []
		quantities = job.procedure_quantities or {}
		if not procedures:
			# Fallback to a single line by job description
			quantity = 1
			unit_price = float(job.price or 0.0)
			line_total = quantity * unit_price
			item = InvoiceItem(
				invoice_id=invoice.id,
				job_id=job.id,
				description=job.description or "Dental work",
				quantity=quantity,
				unit_price=unit_price,
				line_total=line_total,
			)
			db.add(item)
			total_amount += line_total
		else:
			for code in procedures:
				quantity = int(quantities.get(code, 1))
				# Unit price fallback: use job.price if single item, else 0. Caller may update later
				unit_price = float(job.price or 0.0) if len(procedures) == 1 else 0.0
				line_total = quantity * unit_price
				item = InvoiceItem(
					invoice_id=invoice.id,
					job_id=job.id,
					description=code,
					quantity=quantity,
					unit_price=unit_price,
					line_total=line_total,
				)
				db.add(item)
				total_amount += line_total

	invoice.total_amount = total_amount

	# Mark jobs as factured
	for job in jobs:
		if not job.status or job.status != "finished_factured":
			job.status = "finished_factured"

	db.commit()
	db.refresh(invoice)
	return enrich_invoice(invoice, db)


@router.get("/", response_model=List[InvoiceResponse])
def list_invoices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	if not current_user:
		raise HTTPException(status_code=401, detail="Not authenticated")
	q = db.query(Invoice)
	if current_user.role != "superadmin":
		q = q.filter(Invoice.lab_id == current_user.lab_id)
	invoices = q.all()
	return [enrich_invoice(inv, db) for inv in invoices]


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	if not current_user:
		raise HTTPException(status_code=401, detail="Not authenticated")
	q = db.query(Invoice).filter(Invoice.id == invoice_id)
	if current_user.role != "superadmin":
		q = q.filter(Invoice.lab_id == current_user.lab_id)
	invoice = q.first()
	if not invoice:
		raise HTTPException(status_code=404, detail="Invoice not found")
	return enrich_invoice(invoice, db)


@router.put("/{invoice_id}/status", response_model=InvoiceResponse)
def update_invoice_status(invoice_id: int, update: InvoiceUpdateStatus, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	if not current_user:
		raise HTTPException(status_code=401, detail="Not authenticated")
	q = db.query(Invoice).filter(Invoice.id == invoice_id)
	if current_user.role != "superadmin":
		q = q.filter(Invoice.lab_id == current_user.lab_id)
	invoice = q.first()
	if not invoice:
		raise HTTPException(status_code=404, detail="Invoice not found")
	invoice.status = update.status
	if update.status == "issued" and not invoice.issued_at:
		invoice.issued_at = datetime.utcnow()
	if update.status == "paid" and not invoice.paid_at:
		invoice.paid_at = datetime.utcnow()
	db.commit()
	db.refresh(invoice)

	# Sync job statuses according to invoice status
	items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()
	jobs = db.query(Job).filter(Job.id.in_([it.job_id for it in items])).all()
	for job in jobs:
		if update.status == "paid":
			job.status = "closed"
		elif update.status == "issued":
			job.status = "finished_factured"
		elif update.status == "cancelled":
			job.status = "finished_unfactured"
	db.commit()

	return enrich_invoice(invoice, db)


@router.get("/{invoice_id}/qr")
def invoice_qr_svg(invoice_id: int, db: Session = Depends(get_db)):
	invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
	if not invoice:
		raise HTTPException(status_code=404, detail="Invoice not found")
	if not qrcode:
		raise HTTPException(status_code=500, detail="QR generation not available on server")
	payload = f"INVOICE|{invoice.number}|{invoice.total_amount:.2f}|{invoice.status}"
	img = qrcode.make(payload, image_factory=SvgImage)
	# qrcode returns an XML Element for SVG
	element = img.get_image()
	svg_bytes = ET.tostring(element)
	return Response(content=svg_bytes, media_type="image/svg+xml")


@router.get("/{invoice_id}/pdf", response_class=Response)
def invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
	# Minimal PDF with invoice header, items, total, and embedded QR (rasterized)
	try:
		from reportlab.lib.pagesizes import A4
		from reportlab.pdfgen import canvas
		from reportlab.lib.units import mm
		from reportlab.lib.utils import ImageReader
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"PDF generation not available: {e}")

	invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
	if not invoice:
		raise HTTPException(status_code=404, detail="Invoice not found")
	
	clinic = db.query(Clinic).filter(Clinic.id == invoice.clinic_id).first()
	items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()
	jobs = db.query(Job).filter(Job.id.in_([it.job_id for it in items])).all()
	patients = db.query(Patient).filter(Patient.id.in_([j.patient_id for j in jobs])).all()
	patient_names = [f"{p.first_name} {p.last_name}" for p in patients]
	
	# Get lab billing info for PDF header based on clinic's lab
	lab = db.query(Lab).join(Clinic, Clinic.lab_id == Lab.id).filter(Clinic.id == invoice.clinic_id).first()

	# Prepare QR raster image for PDF
	qr_img_reader = None
	if qrcode:
		qr_payload = f"INVOICE|{invoice.number}|{invoice.total_amount:.2f}|{invoice.status}"
		qr_png = qrcode.make(qr_payload)
		# Convert PIL image to bytes for ImageReader
		from io import BytesIO
		qr_buffer = BytesIO()
		qr_png.save(qr_buffer, format='PNG')
		qr_buffer.seek(0)
		qr_img_reader = ImageReader(qr_buffer)

	from io import BytesIO
	buf = BytesIO()
	c = canvas.Canvas(buf, pagesize=A4)
	width, height = A4

	# Add QR code to top right corner
	if qr_img_reader:
		c.drawImage(qr_img_reader, width - 50*mm, height - 50*mm, width=30*mm, height=30*mm, preserveAspectRatio=True, mask='auto')

	# Header with lab billing info
	c.setFont("Helvetica-Bold", 16)
	c.drawString(20*mm, (height - 20*mm), "FAKTURA")
	c.setFont("Helvetica", 10)
	c.drawString(20*mm, (height - 28*mm), f"Cislo: {invoice.number}")
	c.drawString(20*mm, (height - 34*mm), f"Datum vystavenia: {invoice.issued_at.strftime('%d.%m.%Y') if invoice.issued_at else datetime.utcnow().strftime('%d.%m.%Y')}")
	
	# Seller (Lab) info
	if lab:
		c.setFont("Helvetica-Bold", 12)
		c.drawString(20*mm, (height - 50*mm), "Dodavatel:")
		c.setFont("Helvetica", 10)
		y_pos = height - 56*mm
		if lab.name:
			c.drawString(20*mm, y_pos, lab.name)
			y_pos -= 6*mm
		if lab.address:
			c.drawString(20*mm, y_pos, lab.address)
			y_pos -= 6*mm
		if lab.city and lab.postal_code:
			c.drawString(20*mm, y_pos, f"{lab.postal_code} {lab.city}")
			y_pos -= 6*mm
		if lab.tax_id:
			c.drawString(20*mm, y_pos, f"ICO: {lab.tax_id}")
			y_pos -= 6*mm
		if lab.vat_id:
			c.drawString(20*mm, y_pos, f"IC DPH: {lab.vat_id}")
			y_pos -= 6*mm
		if lab.bank_account:
			c.drawString(20*mm, y_pos, f"IBAN: {lab.bank_account}")
			y_pos -= 6*mm
		if lab.bank_bic:
			c.drawString(20*mm, y_pos, f"BIC: {lab.bank_bic}")
			y_pos -= 6*mm
	else:
		c.setFont("Helvetica-Bold", 12)
		c.drawString(20*mm, (height - 50*mm), "Dodavatel:")
		c.setFont("Helvetica", 10)
		c.drawString(20*mm, (height - 56*mm), "Spolocnost - udaje nie su k dispozicii")

	# Buyer (Clinic) info
	c.setFont("Helvetica-Bold", 12)
	c.drawString(110*mm, (height - 50*mm), "Odberatel:")
	c.setFont("Helvetica", 10)
	y_pos = height - 56*mm
	if clinic:
		c.drawString(110*mm, y_pos, clinic.name)
		y_pos -= 6*mm
		if clinic.address:
			c.drawString(110*mm, y_pos, clinic.address)
			y_pos -= 6*mm
		if clinic.ico:
			c.drawString(110*mm, y_pos, f"ICO: {clinic.ico}")
			y_pos -= 6*mm
		if clinic.dic:
			c.drawString(110*mm, y_pos, f"DIC: {clinic.dic}")
			y_pos -= 6*mm
	else:
		c.drawString(110*mm, y_pos, "Klinika - udaje nie su k dispozicii")

	# Items table (simplified)
	y = height - 120*mm  # Adjusted for lab info
	c.setFont("Helvetica-Bold", 10)
	c.drawString(20*mm, y, "Description")
	c.drawString(120*mm, y, "Qty")
	c.drawString(140*mm, y, "Unit")
	c.drawString(160*mm, y, "Line")
	y -= 6*mm
	c.setFont("Helvetica", 10)
	for it in items[:20]:
		c.drawString(20*mm, y, it.description)
		c.drawRightString(135*mm, y, str(it.quantity))
		c.drawRightString(155*mm, y, f"€{it.unit_price:.2f}")
		c.drawRightString(190*mm, y, f"€{it.line_total:.2f}")
		y -= 6*mm
		if y < 40*mm:
			break

	# Total
	c.setFont("Helvetica-Bold", 12)
	c.drawRightString(190*mm, 30*mm, f"Total: €{invoice.total_amount:.2f}")

	# QR in PDF (optional)
	# TODO: Fix QR code embedding in PDF
	# if qr_img_reader:
	#     c.drawImage(qr_img_reader, 20*mm, 20*mm, width=30*mm, height=30*mm, preserveAspectRatio=True, mask='auto')

	c.showPage()
	c.save()
	pdf_bytes = buf.getvalue()
	buf.close()
	
	# Set proper headers for PDF download
	response = Response(content=pdf_bytes, media_type="application/pdf")
	response.headers["Content-Disposition"] = f"inline; filename=invoice_{invoice.number}.pdf"
	return response


@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	if not current_user:
		raise HTTPException(status_code=401, detail="Not authenticated")
	invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
	if not invoice:
		raise HTTPException(status_code=404, detail="Invoice not found")
	# rollback job statuses to unfactured if they were linked to this invoice
	items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()
	jobs = db.query(Job).filter(Job.id.in_([it.job_id for it in items])).all()
	for job in jobs:
		if job.status in ("finished_factured", "closed"):
			job.status = "finished_unfactured"
	# delete items then invoice
	for it in items:
		db.delete(it)
	db.delete(invoice)
	db.commit()
	return {"detail": "deleted"}


def enrich_invoice(invoice: Invoice, db: Session):
	# attach clinic_name and patient_names
	clinic = db.query(Clinic).filter(Clinic.id == invoice.clinic_id).first()
	items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()
	jobs = db.query(Job).filter(Job.id.in_([it.job_id for it in items])).all()
	patient_ids = list({j.patient_id for j in jobs})
	patients = db.query(Patient).filter(Patient.id.in_(patient_ids)).all()
	patient_names = [f"{p.first_name} {p.last_name}" for p in patients]

	# Populate calculated fields
	invoice.clinic = clinic or invoice.clinic
	# monkey-attach extra attrs for response_model
	invoice.clinic_name = clinic.name if clinic else None  # type: ignore[attr-defined]
	invoice.patient_names = patient_names  # type: ignore[attr-defined]
	return invoice
