"""Add monthly_volume to processes

Revision ID: a1b2c3d4e5f6
Revises: c0ec29d6f8fe
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'c0ec29d6f8fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Volumen de ejecuciones por mes — habilita costo mensual/anualizado.
    # Nullable: procesos existentes quedan sin volumen hasta que el usuario lo defina.
    op.add_column('processes', sa.Column('monthly_volume', sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('processes', 'monthly_volume')
