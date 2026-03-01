"""backfill_lab_id_for_existing_records

Revision ID: 7d88cb559f4c
Revises: df4692ccd54d
Create Date: 2025-10-20 23:09:02.257632

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7d88cb559f4c'
down_revision: Union[str, Sequence[str], None] = 'df4692ccd54d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Backfill lab_id for all existing records that have NULL lab_id.
    
    This migration ensures that all existing data is assigned to lab_id=1 (Demo Lab)
    so it becomes visible after multi-tenancy implementation.
    """
    # Backfill all existing records with lab_id=1 (default lab) if they have NULL lab_id
    # This ensures existing data is accessible after multi-tenancy migration
    op.execute("UPDATE patients SET lab_id = 1 WHERE lab_id IS NULL")
    op.execute("UPDATE clinics SET lab_id = 1 WHERE lab_id IS NULL")
    op.execute("UPDATE doctors SET lab_id = 1 WHERE lab_id IS NULL")
    op.execute("UPDATE technicians SET lab_id = 1 WHERE lab_id IS NULL")
    op.execute("UPDATE price_list SET lab_id = 1 WHERE lab_id IS NULL")
    op.execute("UPDATE jobs SET lab_id = 1 WHERE lab_id IS NULL")
    op.execute("UPDATE invoices SET lab_id = 1 WHERE lab_id IS NULL")


def downgrade() -> None:
    """Downgrade schema - set lab_id back to NULL for backfilled records.
    
    Note: This is a lossy downgrade - we can't distinguish between records
    that were originally lab_id=1 vs those that were backfilled.
    """
    # No safe way to downgrade without data loss
    # If you need to undo this, you'll need to restore from a backup
    pass
