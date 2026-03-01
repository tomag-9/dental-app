"""set defaults and not null for is_active, created_at, role

Revision ID: 2de89b62dcbc
Revises: bc7a6980c377
Create Date: 2025-09-14 16:42:02.520093

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2de89b62dcbc'
down_revision: Union[str, Sequence[str], None] = 'bc7a6980c377'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Set defaults and NOT NULL constraints
    op.alter_column('users', 'is_active', existing_type=sa.Boolean(), nullable=False, server_default='true')
    op.alter_column('users', 'created_at', existing_type=sa.DateTime(), nullable=False, server_default=sa.func.now())
    op.alter_column('users', 'role', existing_type=sa.String(length=50), nullable=False, server_default='user')

def downgrade():
    # Revert to original state (allowing NULL, removing defaults)
    op.alter_column('users', 'is_active', existing_type=sa.Boolean(), nullable=True, server_default=None)
    op.alter_column('users', 'created_at', existing_type=sa.DateTime(), nullable=True, server_default=None)
    op.alter_column('users', 'role', existing_type=sa.String(length=50), nullable=True, server_default=None)
