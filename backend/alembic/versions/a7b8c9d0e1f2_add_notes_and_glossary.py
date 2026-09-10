"""Notas sobre el lienzo y glosario de nomenclaturas

Observaciones del 10/09:
  - notas tipo post-it (aviso, importante) por fuera del flujo, como apoyo visual
  - glosa de nomenclaturas con su significado y una tabla referencial

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
"""
from alembic import op
import sqlalchemy as sa


revision = 'a7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'process_notes',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('process_id', sa.BigInteger(), nullable=False),
        sa.Column('author_id', sa.BigInteger(), nullable=True),
        sa.Column('kind', sa.String(length=20), server_default='nota', nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        # La nota no es un nodo BPMN: no tiene bpmn_id ni entra en el flujo.
        # Solo necesita saber donde se dejo sobre el lienzo.
        sa.Column('pos_x', sa.Numeric(10, 2), server_default='0', nullable=False),
        sa.Column('pos_y', sa.Numeric(10, 2), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['process_id'], ['processes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_process_notes_process_id', 'process_notes', ['process_id'])
    op.create_index('ix_process_notes_author_id', 'process_notes', ['author_id'])

    op.create_table(
        'glossary_terms',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('process_id', sa.BigInteger(), nullable=False),
        sa.Column('term', sa.String(length=80), nullable=False),
        sa.Column('meaning', sa.String(length=400), nullable=False),
        sa.Column('reference', sa.String(length=200), nullable=True),
        sa.Column('position_order', sa.Integer(), server_default='0', nullable=False),
        sa.ForeignKeyConstraint(['process_id'], ['processes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_glossary_terms_process_id', 'glossary_terms', ['process_id'])


def downgrade():
    op.drop_index('ix_glossary_terms_process_id', table_name='glossary_terms')
    op.drop_table('glossary_terms')
    op.drop_index('ix_process_notes_author_id', table_name='process_notes')
    op.drop_index('ix_process_notes_process_id', table_name='process_notes')
    op.drop_table('process_notes')
