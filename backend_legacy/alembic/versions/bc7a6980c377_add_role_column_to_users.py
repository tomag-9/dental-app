"""add role column to users

Revision ID: bc7a6980c377
Revises: 
Create Date: 2025-09-14 16:01:44.326036

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc7a6980c377'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('role', sa.String(length=50), nullable=True, server_default='user'))


def downgrade() -> None:
    op.drop_column('users', 'role')
