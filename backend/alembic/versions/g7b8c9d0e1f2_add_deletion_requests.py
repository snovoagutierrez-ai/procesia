"""Solicitudes de eliminación de procesos."""
from alembic import op
import sqlalchemy as sa

revision = 'g7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('process_deletion_requests',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('process_id', sa.BigInteger(), sa.ForeignKey('processes.id', ondelete='SET NULL')),
        sa.Column('process_code', sa.String(40), nullable=False),
        sa.Column('process_name', sa.String(200), nullable=False),
        sa.Column('requester_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('reason', sa.String(1000), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('reviewer_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('review_note', sa.String(1000)),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('reviewed_at', sa.DateTime(timezone=True)),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='chk_deletion_request_status'),
    )
    for field in ['process_id', 'requester_id', 'reviewer_id', 'status']:
        op.create_index(f'ix_process_deletion_requests_{field}', 'process_deletion_requests', [field])
    op.create_index('uq_pending_process_deletion', 'process_deletion_requests', ['process_id'], unique=True,
                    postgresql_where=sa.text("status = 'pending'"), sqlite_where=sa.text("status = 'pending'"))


def downgrade():
    op.drop_table('process_deletion_requests')
