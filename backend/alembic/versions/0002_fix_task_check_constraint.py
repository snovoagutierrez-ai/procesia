"""fix_task_check_constraint

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-22 16:58:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Drop the old constraint
    op.drop_constraint('chk_task_value_waste', 'tasks', type_='check')
    # Create the new constraint
    op.create_check_constraint(
        'chk_task_value_waste',
        'tasks',
        "value_classification <> 'NVA' OR waste_type IS NOT NULL"
    )

def downgrade() -> None:
    # Drop the new constraint
    op.drop_constraint('chk_task_value_waste', 'tasks', type_='check')
    # Create the old constraint
    op.create_check_constraint(
        'chk_task_value_waste',
        'tasks',
        "value_classification = 'VA' OR waste_type IS NOT NULL"
    )
