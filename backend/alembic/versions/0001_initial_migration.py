"""Initial migration

Revision ID: 0001
Revises: None
Create Date: 2026-06-22 00:00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Enums
    op.execute("CREATE TYPE value_class AS ENUM ('VA', 'NNVA', 'NVA')")
    op.execute("CREATE TYPE waste_type AS ENUM ('defects','overproduction','waiting','non_utilized_talent','transportation','inventory','motion','excess_processing')")
    op.execute("CREATE TYPE task_type AS ENUM ('manual','user','service','script')")
    op.execute("CREATE TYPE raci_type AS ENUM ('R','A','C','I')")
    op.execute("CREATE TYPE bpmn_node_type AS ENUM ('startEvent','endEvent','intermediateEvent','exclusiveGateway','parallelGateway','inclusiveGateway')")
    op.execute("CREATE TYPE opt_status AS ENUM ('pending','processing','completed','failed')")
    op.execute("CREATE TYPE artifact_source AS ENUM ('manual','optimized')")

    # 2. Create Tables
    # macroprocesses
    op.create_table(
        'macroprocesses',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('code', sa.String(length=40), nullable=False, unique=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('owner_area', sa.String(length=120), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    # processes
    op.create_table(
        'processes',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('macroprocess_id', sa.BigInteger(), sa.ForeignKey('macroprocesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('code', sa.String(length=40), nullable=False, unique=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('objective', sa.Text(), nullable=True),
        sa.Column('trigger_event', sa.String(length=200), nullable=True),
        sa.Column('output_result', sa.String(length=200), nullable=True),
    )

    # activities
    op.create_table(
        'activities',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('process_id', sa.BigInteger(), sa.ForeignKey('processes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('position_order', sa.Integer(), nullable=False),
    )

    # tasks
    op.create_table(
        'tasks',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('activity_id', sa.BigInteger(), sa.ForeignKey('activities.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bpmn_id', sa.String(length=60), nullable=False, unique=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('position_order', sa.Integer(), nullable=False),
        sa.Column('task_type', postgresql.ENUM('manual', 'user', 'service', 'script', name='task_type', create_type=False), server_default='user', nullable=False),
        sa.Column('value_classification', postgresql.ENUM('VA', 'NNVA', 'NVA', name='value_class', create_type=False), nullable=False),
        sa.Column('waste_type', postgresql.ENUM('defects','overproduction','waiting','non_utilized_talent','transportation','inventory','motion','excess_processing', name='waste_type', create_type=False), nullable=True),
        sa.Column('std_cycle_time_sec', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=True),
        sa.Column('std_wait_time_sec', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=True),
        sa.CheckConstraint("value_classification = 'VA' OR waste_type IS NOT NULL", name='chk_task_value_waste')
    )

    # time_measurements
    op.create_table(
        'time_measurements',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('task_id', sa.BigInteger(), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('observed_cycle_sec', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('observed_wait_sec', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('case_ref', sa.String(length=80), nullable=True),
        sa.Column('observed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    # roles
    op.create_table(
        'roles',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('area', sa.String(length=120), nullable=True),
        sa.Column('cost_per_hour', sa.Numeric(precision=10, scale=2), nullable=True),
    )

    # task_raci
    op.create_table(
        'task_raci',
        sa.Column('task_id', sa.BigInteger(), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role_id', sa.BigInteger(), sa.ForeignKey('roles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('raci_type', postgresql.ENUM('R', 'A', 'C', 'I', name='raci_type', create_type=False), nullable=False),
        sa.PrimaryKeyConstraint('task_id', 'role_id', 'raci_type')
    )

    # systems
    op.create_table(
        'systems',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('system_type', sa.String(length=80), nullable=True),
        sa.Column('vendor', sa.String(length=120), nullable=True),
    )

    # task_systems
    op.create_table(
        'task_systems',
        sa.Column('task_id', sa.BigInteger(), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('system_id', sa.BigInteger(), sa.ForeignKey('systems.id', ondelete='CASCADE'), nullable=False),
        sa.Column('interaction_type', sa.String(length=40), nullable=True),
        sa.PrimaryKeyConstraint('task_id', 'system_id')
    )

    # flow_nodes
    op.create_table(
        'flow_nodes',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('process_id', sa.BigInteger(), sa.ForeignKey('processes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bpmn_id', sa.String(length=60), nullable=False, unique=True),
        sa.Column('node_type', postgresql.ENUM('startEvent', 'endEvent', 'intermediateEvent', 'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', name='bpmn_node_type', create_type=False), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=True),
    )

    # sequence_flows
    op.create_table(
        'sequence_flows',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('process_id', sa.BigInteger(), sa.ForeignKey('processes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bpmn_id', sa.String(length=60), nullable=False, unique=True),
        sa.Column('source_ref', sa.String(length=60), nullable=False),
        sa.Column('target_ref', sa.String(length=60), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=True),
        sa.Column('condition_expression', sa.Text(), nullable=True),
    )

    # optimization_runs
    op.create_table(
        'optimization_runs',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('process_id', sa.BigInteger(), sa.ForeignKey('processes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', postgresql.ENUM('pending', 'processing', 'completed', 'failed', name='opt_status', create_type=False), server_default='pending', nullable=False),
        sa.Column('model_used', sa.String(length=80), nullable=True),
        sa.Column('input_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('value_added_ratio', sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )

    # bpmn_artifacts
    op.create_table(
        'bpmn_artifacts',
        sa.Column('id', sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column('process_id', sa.BigInteger(), sa.ForeignKey('processes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('source', postgresql.ENUM('manual', 'optimized', name='artifact_source', create_type=False), server_default='manual', nullable=False),
        sa.Column('xml_content', sa.Text(), nullable=False),
        sa.Column('checksum', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.UniqueConstraint('process_id', 'version', name='uq_bpmn_artifact_process_version')
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('bpmn_artifacts')
    op.drop_table('optimization_runs')
    op.drop_table('sequence_flows')
    op.drop_table('flow_nodes')
    op.drop_table('task_systems')
    op.drop_table('systems')
    op.drop_table('task_raci')
    op.drop_table('roles')
    op.drop_table('time_measurements')
    op.drop_table('tasks')
    op.drop_table('activities')
    op.drop_table('processes')
    op.drop_table('macroprocesses')

    # Drop enums
    op.execute("DROP TYPE artifact_source")
    op.execute("DROP TYPE opt_status")
    op.execute("DROP TYPE bpmn_node_type")
    op.execute("DROP TYPE raci_type")
    op.execute("DROP TYPE task_type")
    op.execute("DROP TYPE waste_type")
    op.execute("DROP TYPE value_class")
