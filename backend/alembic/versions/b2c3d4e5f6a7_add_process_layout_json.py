"""Add layout_json to processes (posiciones manuales del diagrama)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-28 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Posiciones manuales de los nodos del diagrama: { "<node_id>": {"x": n, "y": n}, ... }.
    # Nullable: si está vacío, el diagrama usa el auto-layout (dagre).
    op.add_column('processes', sa.Column('layout_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('processes', 'layout_json')
