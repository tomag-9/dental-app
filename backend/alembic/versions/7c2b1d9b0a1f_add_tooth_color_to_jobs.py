"""Add tooth_color column to jobs table

Revision ID: 7c2b1d9b0a1f
Revises: 65863de4f90d
Create Date: 2025-10-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c2b1d9b0a1f'
down_revision: Union[str, Sequence[str], None] = '40e0786a05de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('tooth_color', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'tooth_color')
