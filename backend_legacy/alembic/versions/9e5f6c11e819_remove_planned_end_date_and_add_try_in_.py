"""Remove planned_end_date and add try_in as date to jobs table

Revision ID: 9e5f6c11e819
Revises: b61825966c9a
Create Date: 2025-09-15 20:36:37.505817

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e5f6c11e819'
down_revision: Union[str, Sequence[str], None] = 'b61825966c9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.drop_column("planned_end_date")
        batch_op.add_column(sa.Column("try_in", sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.add_column(sa.Column("planned_end_date", sa.Date(), nullable=True))
        batch_op.drop_column("try_in")
