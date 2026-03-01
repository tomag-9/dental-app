"""
add warehouse items table

Revision ID: a1b2c3d4e5f6
Revises: 9e5f6c11e819
Create Date: 2025-10-21
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
# Chain after the latest user/lab-related migration
down_revision = '5df8f0906be3'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'warehouse_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('sku', sa.String(), nullable=True),
        sa.Column('quantity', sa.Float(), nullable=False, server_default='0'),
        sa.Column('unit', sa.String(), nullable=False, server_default='pcs'),
        sa.Column('min_threshold', sa.Float(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('cost_price', sa.Float(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('lab_id', sa.Integer(), sa.ForeignKey('labs.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_index('ix_warehouse_items_lab_id', 'warehouse_items', ['lab_id'])
    op.create_unique_constraint('uq_warehouse_items_lab_sku', 'warehouse_items', ['lab_id', 'sku'])


def downgrade():
    op.drop_constraint('uq_warehouse_items_lab_sku', 'warehouse_items', type_='unique')
    op.drop_index('ix_warehouse_items_lab_id', table_name='warehouse_items')
    op.drop_table('warehouse_items')
