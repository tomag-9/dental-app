"""Add planning fields to jobs table

Revision ID: b61825966c9a
Revises: 65863de4f90d
Create Date: 2025-09-14 22:03:10.696808

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b61825966c9a'
down_revision: Union[str, Sequence[str], None] = '65863de4f90d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('start_date', sa.Date(), nullable=True))
    op.add_column('jobs', sa.Column('end_date', sa.Date(), nullable=True))
    op.add_column('jobs', sa.Column('planned_end_date', sa.Date(), nullable=True))
    op.add_column('jobs', sa.Column('skuska', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'start_date')
    op.drop_column('jobs', 'end_date')
    op.drop_column('jobs', 'planned_end_date')
    op.drop_column('jobs', 'skuska')
