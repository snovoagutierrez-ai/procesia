"""Las notas se anclan a un paso concreto

La nota suelta servia de apoyo general, pero se pedia que quedara ligada a la
tarea a la que se refiere y que la acompañe al moverla.

Se guarda el bpmn_id del paso, no su id numerico: asi el vinculo sobrevive a
recrear la tarea (restaurar una version, aplicar un flujo optimizado). Sin FK
por el mismo motivo: la tarea puede desaparecer y volver con otro id, y una
clave foranea borraria la nota en el intermedio.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
"""
from alembic import op
import sqlalchemy as sa


revision = 'b8c9d0e1f2a3'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('process_notes', sa.Column('task_bpmn_id', sa.String(length=60), nullable=True))
    op.create_index('ix_process_notes_task_bpmn_id', 'process_notes', ['task_bpmn_id'])


def downgrade():
    op.drop_index('ix_process_notes_task_bpmn_id', table_name='process_notes')
    op.drop_column('process_notes', 'task_bpmn_id')
