"""Add description column to jobs table

Revision ID: 65863de4f90d
Revises: 2de89b62dcbc
Create Date: 2025-09-14 21:34:39.130893

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '65863de4f90d'
down_revision: Union[str, Sequence[str], None] = '2de89b62dcbc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('description', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'description')
