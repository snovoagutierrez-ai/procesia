"""Sincroniza columnas aplicadas a mano en produccion

Estas columnas (branch_probability, source/target_handle, suppliers/customers y
la tabla node_comments) se agregaron directamente sobre la base de produccion sin
migracion, por lo que una base nueva creada con `alembic upgrade head` quedaba
sin ellas y la app fallaba al arrancar. Todo aqui es idempotente (IF NOT EXISTS)
para poder correrlo tambien sobre produccion sin romper nada.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE sequence_flows ADD COLUMN IF NOT EXISTS branch_probability NUMERIC(5,2)")
    op.execute("ALTER TABLE sequence_flows ADD COLUMN IF NOT EXISTS source_handle VARCHAR(10)")
    op.execute("ALTER TABLE sequence_flows ADD COLUMN IF NOT EXISTS target_handle VARCHAR(10)")
    op.execute("ALTER TABLE processes ADD COLUMN IF NOT EXISTS suppliers VARCHAR(300)")
    op.execute("ALTER TABLE processes ADD COLUMN IF NOT EXISTS customers VARCHAR(300)")
    op.execute("""
        CREATE TABLE IF NOT EXISTS node_comments (
            id BIGSERIAL PRIMARY KEY,
            process_id BIGINT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
            node_bpmn_id VARCHAR(60) NOT NULL,
            author_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_node_comments_process_id ON node_comments (process_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_node_comments_node_bpmn_id ON node_comments (node_bpmn_id)")
    op.execute("ALTER TABLE node_comments ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    # No se revierte: estas columnas ya existen en produccion y contienen datos.
    pass
