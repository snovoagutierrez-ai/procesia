"""add_macro_opt

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-22 22:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('macro_optimization_runs',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('macroprocess_id', sa.BigInteger(), nullable=False),
    sa.Column('status', postgresql.ENUM('pending', 'completed', 'failed', name='opt_status', create_type=False), server_default='pending', nullable=False),
    sa.Column('model_used', sa.String(length=80), nullable=True),
    sa.Column('input_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['macroprocess_id'], ['macroprocesses.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('macro_optimization_runs')
