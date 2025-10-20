"""add_tooth_procedures_to_patient_and_job

Revision ID: 463810954c1a
Revises: 7317c6e30b91
Create Date: 2025-10-20 13:20:28.421865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '463810954c1a'
down_revision: Union[str, Sequence[str], None] = '7317c6e30b91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add tooth_procedures column to patients table
    op.add_column('patients', sa.Column('tooth_procedures', sa.JSON(), nullable=True))
    
    # Add tooth_procedures column to jobs table
    op.add_column('jobs', sa.Column('tooth_procedures', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove tooth_procedures column from jobs table
    op.drop_column('jobs', 'tooth_procedures')
    
    # Remove tooth_procedures column from patients table
    op.drop_column('patients', 'tooth_procedures')
