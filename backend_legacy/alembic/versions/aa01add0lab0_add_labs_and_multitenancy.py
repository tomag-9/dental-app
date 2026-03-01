"""add_labs_and_multitenancy

Revision ID: aa01add0lab0
Revises: 7317c6e30b91
Create Date: 2025-10-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa01add0lab0'
down_revision: Union[str, Sequence[str], None] = '7317c6e30b91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Only create labs table if it doesn't exist
    if 'labs' not in inspector.get_table_names():
        op.create_table(
            'labs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('name', sa.String(), nullable=False, unique=True),
            sa.Column('address', sa.String(), nullable=True),
            sa.Column('city', sa.String(), nullable=True),
            sa.Column('postal_code', sa.String(), nullable=True),
            sa.Column('country', sa.String(), nullable=True),
            sa.Column('tax_id', sa.String(), nullable=True),
            sa.Column('vat_id', sa.String(), nullable=True),
            sa.Column('bank_account', sa.String(), nullable=True),
            sa.Column('bank_bic', sa.String(), nullable=True),
            sa.Column('phone', sa.String(), nullable=True),
            sa.Column('email', sa.String(), nullable=True),
            sa.Column('website', sa.String(), nullable=True),
            sa.Column('logo_url', sa.String(), nullable=True),
            sa.Column('contact_info', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
    else:
        # Add missing columns to existing labs table
        labs_columns = [c['name'] for c in inspector.get_columns('labs')]
        for col_name, col_type in [
            ('city', sa.String()), ('postal_code', sa.String()), ('country', sa.String()),
            ('tax_id', sa.String()), ('vat_id', sa.String()), ('bank_account', sa.String()),
            ('bank_bic', sa.String()), ('phone', sa.String()), ('email', sa.String()),
            ('website', sa.String()), ('logo_url', sa.String()), ('updated_at', sa.DateTime())
        ]:
            if col_name not in labs_columns:
                op.add_column('labs', sa.Column(col_name, col_type, nullable=True))

    # Add lab_id columns (nullable initially for safe migration) and FK constraints
    users_columns = [c['name'] for c in inspector.get_columns('users')]
    if 'lab_id' not in users_columns:
        op.add_column('users', sa.Column('lab_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_users_labs', 'users', 'labs', ['lab_id'], ['id'])

    patients_columns = [c['name'] for c in inspector.get_columns('patients')]
    if 'lab_id' not in patients_columns:
        op.add_column('patients', sa.Column('lab_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_patients_labs', 'patients', 'labs', ['lab_id'], ['id'])

    clinics_columns = [c['name'] for c in inspector.get_columns('clinics')]
    if 'lab_id' not in clinics_columns:
        op.add_column('clinics', sa.Column('lab_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_clinics_labs', 'clinics', 'labs', ['lab_id'], ['id'])

    doctors_columns = [c['name'] for c in inspector.get_columns('doctors')]
    if 'lab_id' not in doctors_columns:
        op.add_column('doctors', sa.Column('lab_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_doctors_labs', 'doctors', 'labs', ['lab_id'], ['id'])

    technicians_columns = [c['name'] for c in inspector.get_columns('technicians')]
    if 'lab_id' not in technicians_columns:
        op.add_column('technicians', sa.Column('lab_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_technicians_labs', 'technicians', 'labs', ['lab_id'], ['id'])

    price_list_columns = [c['name'] for c in inspector.get_columns('price_list')]
    if 'lab_id' not in price_list_columns:
        op.add_column('price_list', sa.Column('lab_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_price_list_labs', 'price_list', 'labs', ['lab_id'], ['id'])

    jobs_columns = [c['name'] for c in inspector.get_columns('jobs')]
    if 'lab_id' not in jobs_columns:
        op.add_column('jobs', sa.Column('lab_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_jobs_labs', 'jobs', 'labs', ['lab_id'], ['id'])

    # Invoices: add lab_id and backfill from clinics
    invoices_columns = [c['name'] for c in inspector.get_columns('invoices')]
    if 'lab_id' not in invoices_columns:
        op.add_column('invoices', sa.Column('lab_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_invoices_labs', 'invoices', 'labs', ['lab_id'], ['id'])
        # Backfill invoices.lab_id from clinics if clinics.lab_id exists
        if 'lab_id' in clinics_columns:
            op.execute(
                """
                UPDATE invoices
                SET lab_id = clinics.lab_id
                FROM clinics
                WHERE invoices.clinic_id = clinics.id
                """
            )

    # Subscriptions table: only create if it doesn't exist
    if 'subscriptions' not in inspector.get_table_names():
        op.create_table(
            'subscriptions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('lab_id', sa.Integer(), nullable=False, unique=True),
            sa.Column('plan', sa.String(), nullable=False, server_default='free'),
            sa.Column('status', sa.String(), nullable=False, server_default='inactive'),
            sa.Column('seats', sa.Integer(), nullable=False, server_default='5'),
            sa.Column('current_period_start', sa.Date(), nullable=True),
            sa.Column('current_period_end', sa.Date(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['lab_id'], ['labs.id'], name='fk_subscriptions_labs'),
        )


def downgrade() -> None:
    # Drop subscriptions
    op.drop_table('subscriptions')

    # Drop FKs and columns for lab_id
    op.drop_constraint('fk_invoices_labs', 'invoices', type_='foreignkey')
    op.drop_column('invoices', 'lab_id')

    op.drop_constraint('fk_jobs_labs', 'jobs', type_='foreignkey')
    op.drop_column('jobs', 'lab_id')

    op.drop_constraint('fk_price_list_labs', 'price_list', type_='foreignkey')
    op.drop_column('price_list', 'lab_id')

    op.drop_constraint('fk_technicians_labs', 'technicians', type_='foreignkey')
    op.drop_column('technicians', 'lab_id')

    op.drop_constraint('fk_doctors_labs', 'doctors', type_='foreignkey')
    op.drop_column('doctors', 'lab_id')

    op.drop_constraint('fk_clinics_labs', 'clinics', type_='foreignkey')
    op.drop_column('clinics', 'lab_id')

    op.drop_constraint('fk_patients_labs', 'patients', type_='foreignkey')
    op.drop_column('patients', 'lab_id')

    op.drop_constraint('fk_users_labs', 'users', type_='foreignkey')
    op.drop_column('users', 'lab_id')

    # Drop labs table
    op.drop_table('labs')
