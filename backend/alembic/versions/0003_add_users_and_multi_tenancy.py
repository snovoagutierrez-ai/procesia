"""add_users_and_multi_tenancy

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-22 17:12:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import os
from passlib.context import CryptContext
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def upgrade() -> None:
    # 1. Create UserRole Enum safely
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE user_role AS ENUM ('user', 'admin'); END IF; END $$;")
    user_role_enum = postgresql.ENUM('user', 'admin', name='user_role', create_type=False)

    # 2. Create users table
    op.create_table('users',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', user_role_enum, server_default='user', nullable=False),
        sa.Column('is_active', sa.Integer(), server_default='1', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 3. Create initial admin user
    admin_email = os.environ.get('INITIAL_ADMIN_EMAIL', 'admin@procesia.com')
    admin_password = os.environ.get('INITIAL_ADMIN_PASSWORD', 'admin123')
    hashed_password = pwd_context.hash(admin_password)

    op.execute(
        f"INSERT INTO users (email, password_hash, role, is_active, created_at) "
        f"VALUES ('{admin_email}', '{hashed_password}', 'admin', 1, NOW())"
    )

    # 4. Add owner_id to macroprocesses and processes
    op.add_column('macroprocesses', sa.Column('owner_id', sa.BigInteger(), nullable=True))
    op.add_column('processes', sa.Column('owner_id', sa.BigInteger(), nullable=True))

    # 5. Set owner_id for existing records to the new admin user
    op.execute(
        "UPDATE macroprocesses SET owner_id = (SELECT id FROM users WHERE email = '{}')".format(admin_email)
    )
    op.execute(
        "UPDATE processes SET owner_id = (SELECT id FROM users WHERE email = '{}')".format(admin_email)
    )

    # 6. Alter columns to NOT NULL and add foreign keys
    op.alter_column('macroprocesses', 'owner_id', nullable=False)
    op.create_foreign_key('fk_macroprocesses_owner_id', 'macroprocesses', 'users', ['owner_id'], ['id'], ondelete='CASCADE')

    op.alter_column('processes', 'owner_id', nullable=False)
    op.create_foreign_key('fk_processes_owner_id', 'processes', 'users', ['owner_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_constraint('fk_processes_owner_id', 'processes', type_='foreignkey')
    op.drop_column('processes', 'owner_id')

    op.drop_constraint('fk_macroprocesses_owner_id', 'macroprocesses', type_='foreignkey')
    op.drop_column('macroprocesses', 'owner_id')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    
    # Drop enum
    user_role_enum = postgresql.ENUM('user', 'admin', name='user_role')
    user_role_enum.drop(op.get_bind(), checkfirst=True)
