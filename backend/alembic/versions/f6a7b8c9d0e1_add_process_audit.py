"""Historial de cambios por proceso

Observaciones del 10/09: saber quien fue el ultimo en entrar, quien hizo el
ultimo cambio y sobre que objeto, y de quien es la responsabilidad del flujo.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""
from alembic import op
import sqlalchemy as sa


revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'process_audit',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('process_id', sa.BigInteger(), nullable=False),
        # SET NULL y no CASCADE: si alguien se da de baja, su rastro debe
        # quedar. Un historial que se borra solo no sirve para auditar.
        sa.Column('user_id', sa.BigInteger(), nullable=True),
        sa.Column('action', sa.String(length=40), nullable=False),
        sa.Column('target_type', sa.String(length=20), nullable=True),
        sa.Column('target_bpmn_id', sa.String(length=60), nullable=True),
        sa.Column('summary', sa.String(length=300), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['process_id'], ['processes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_process_audit_process_id', 'process_audit', ['process_id'])
    op.create_index('ix_process_audit_user_id', 'process_audit', ['user_id'])
    # La consulta habitual es «lo ultimo de este proceso»: se ordena por fecha
    # descendente dentro de un proceso, asi que el indice va por las dos.
    op.create_index('ix_process_audit_proceso_fecha', 'process_audit', ['process_id', 'created_at'])


def downgrade():
    op.drop_index('ix_process_audit_proceso_fecha', table_name='process_audit')
    op.drop_index('ix_process_audit_user_id', table_name='process_audit')
    op.drop_index('ix_process_audit_process_id', table_name='process_audit')
    op.drop_table('process_audit')
