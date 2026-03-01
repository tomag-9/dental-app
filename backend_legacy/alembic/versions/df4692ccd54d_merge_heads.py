"""merge_heads

Revision ID: df4692ccd54d
Revises: 7c2b1d9b0a1f, aa01add0lab0
Create Date: 2025-10-20 23:08:53.225471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df4692ccd54d'
down_revision: Union[str, Sequence[str], None] = ('7c2b1d9b0a1f', 'aa01add0lab0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
