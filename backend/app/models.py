import enum
from sqlalchemy import (
    Column, BigInteger, String, Text, Integer, Numeric, DateTime, ForeignKey, Boolean,
    CheckConstraint, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from app.database import Base

# ========= ENUMS =========
class UserRole(str, enum.Enum):
    user = 'user'
    admin = 'admin'

class ValueClass(str, enum.Enum):
    VA = 'VA'
    NNVA = 'NNVA'
    NVA = 'NVA'

class WasteType(str, enum.Enum):
    defects = 'defects'
    overproduction = 'overproduction'
    waiting = 'waiting'
    non_utilized_talent = 'non_utilized_talent'
    transportation = 'transportation'
    inventory = 'inventory'
    motion = 'motion'
    excess_processing = 'excess_processing'

class TaskType(str, enum.Enum):
    manual = 'manual'
    user = 'user'
    service = 'service'
    script = 'script'

class RaciType(str, enum.Enum):
    R = 'R'
    A = 'A'
    C = 'C'
    I = 'I'

class BpmnNodeType(str, enum.Enum):
    startEvent = 'startEvent'
    endEvent = 'endEvent'
    intermediateEvent = 'intermediateEvent'
    exclusiveGateway = 'exclusiveGateway'
    parallelGateway = 'parallelGateway'
    inclusiveGateway = 'inclusiveGateway'

class OptStatus(str, enum.Enum):
    pending = 'pending'
    processing = 'processing'
    completed = 'completed'
    failed = 'failed'

class ArtifactSource(str, enum.Enum):
    manual = 'manual'
    optimized = 'optimized'

# ========= TABLES =========

class User(Base):
    __tablename__ = 'users'

    id = Column(BigInteger, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(ENUM(UserRole, name='user_role'), nullable=False, server_default='user')
    is_active = Column(Boolean, server_default='true')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    macroprocesses = relationship("Macroprocess", back_populates="owner")
    processes = relationship("Process", back_populates="owner")


class Macroprocess(Base):
    __tablename__ = 'macroprocesses'

    id = Column(BigInteger, primary_key=True)
    owner_id = Column(BigInteger, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    code = Column(String(40), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    owner_area = Column(String(120))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="macroprocesses")
    processes = relationship("Process", back_populates="macroprocess", cascade="all, delete-orphan", passive_deletes=True)
    optimization_runs = relationship("MacroOptimizationRun", back_populates="macroprocess", cascade="all, delete-orphan", passive_deletes=True)
    macro_sequence_flows = relationship("MacroSequenceFlow", back_populates="macroprocess", cascade="all, delete-orphan", passive_deletes=True)


class Process(Base):
    __tablename__ = 'processes'

    id = Column(BigInteger, primary_key=True)
    owner_id = Column(BigInteger, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    macroprocess_id = Column(BigInteger, ForeignKey('macroprocesses.id', ondelete='CASCADE'), nullable=False, index=True)
    code = Column(String(40), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    objective = Column(Text)
    trigger_event = Column(String(200))
    output_result = Column(String(200))
    monthly_volume = Column(Numeric(12, 2), nullable=True)  # ejecuciones por mes → costo mensual/anualizado
    layout_json = Column(JSONB, nullable=True)  # posiciones manuales de nodos { node_id: {x,y} }

    owner = relationship("User", back_populates="processes")
    macroprocess = relationship("Macroprocess", back_populates="processes")
    activities = relationship("Activity", back_populates="process", cascade="all, delete-orphan", passive_deletes=True)
    flow_nodes = relationship("FlowNode", back_populates="process", cascade="all, delete-orphan", passive_deletes=True)
    sequence_flows = relationship("SequenceFlow", back_populates="process", cascade="all, delete-orphan", passive_deletes=True)
    optimization_runs = relationship("OptimizationRun", back_populates="process", cascade="all, delete-orphan", passive_deletes=True)
    bpmn_artifacts = relationship("BpmnArtifact", back_populates="process", cascade="all, delete-orphan", passive_deletes=True)
    snapshots = relationship("ProcessSnapshot", back_populates="process", cascade="all, delete-orphan", passive_deletes=True)


class NodeComment(Base):
    """Comentario colaborativo anclado a un nodo del proceso (tarea o compuerta)."""
    __tablename__ = 'node_comments'

    id = Column(BigInteger, primary_key=True)
    process_id = Column(BigInteger, ForeignKey('processes.id', ondelete='CASCADE'), nullable=False, index=True)
    node_bpmn_id = Column(String(60), nullable=False, index=True)
    author_id = Column(BigInteger, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    author = relationship("User")


class ProcessSnapshot(Base):
    __tablename__ = 'process_snapshots'

    id = Column(BigInteger, primary_key=True)
    process_id = Column(BigInteger, ForeignKey('processes.id', ondelete='CASCADE'), nullable=False, index=True)
    snapshot_json = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    process = relationship("Process", back_populates="snapshots")


class Activity(Base):
    __tablename__ = 'activities'

    id = Column(BigInteger, primary_key=True)
    process_id = Column(BigInteger, ForeignKey('processes.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    position_order = Column(Integer, nullable=False)

    process = relationship("Process", back_populates="activities")
    tasks = relationship("Task", back_populates="activity", cascade="all, delete-orphan", passive_deletes=True)


class Task(Base):
    __tablename__ = 'tasks'

    id = Column(BigInteger, primary_key=True)
    activity_id = Column(BigInteger, ForeignKey('activities.id', ondelete='CASCADE'), nullable=False, index=True)
    bpmn_id = Column(String(60), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    position_order = Column(Integer, nullable=False)
    task_type = Column(ENUM(TaskType, name='task_type'), nullable=False, server_default='user')
    value_classification = Column(ENUM(ValueClass, name='value_class'), nullable=False)
    waste_type = Column(ENUM(WasteType, name='waste_type'), nullable=True)
    std_cycle_time_sec = Column(Numeric(12, 2), server_default='0.00')
    std_wait_time_sec = Column(Numeric(12, 2), server_default='0.00')

    __table_args__ = (
        CheckConstraint(
            "value_classification <> 'NVA' OR waste_type IS NOT NULL", 
            name="chk_task_value_waste"
        ),
    )

    activity = relationship("Activity", back_populates="tasks")
    time_measurements = relationship("TimeMeasurement", back_populates="task", cascade="all, delete-orphan", passive_deletes=True)
    raci = relationship("TaskRaci", back_populates="task", cascade="all, delete-orphan", passive_deletes=True)
    systems = relationship("TaskSystem", back_populates="task", cascade="all, delete-orphan", passive_deletes=True)


class TimeMeasurement(Base):
    __tablename__ = 'time_measurements'

    id = Column(BigInteger, primary_key=True)
    task_id = Column(BigInteger, ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False)
    observed_cycle_sec = Column(Numeric(12, 2), nullable=False)
    observed_wait_sec = Column(Numeric(12, 2), nullable=False, server_default='0.00')
    case_ref = Column(String(80))
    observed_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", back_populates="time_measurements")


class Role(Base):
    __tablename__ = 'roles'

    id = Column(BigInteger, primary_key=True)
    name = Column(String(120), nullable=False)
    area = Column(String(120))
    cost_per_hour = Column(Numeric(10, 2))

    raci = relationship("TaskRaci", back_populates="role", cascade="all, delete-orphan", passive_deletes=True)


class TaskRaci(Base):
    __tablename__ = 'task_raci'

    task_id = Column(BigInteger, ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True)
    role_id = Column(BigInteger, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True)
    raci_type = Column(ENUM(RaciType, name='raci_type'), primary_key=True)

    task = relationship("Task", back_populates="raci")
    role = relationship("Role", back_populates="raci")


class System(Base):
    __tablename__ = 'systems'

    id = Column(BigInteger, primary_key=True)
    name = Column(String(120), nullable=False)
    system_type = Column(String(80))
    vendor = Column(String(120))

    tasks = relationship("TaskSystem", back_populates="system", cascade="all, delete-orphan", passive_deletes=True)


class TaskSystem(Base):
    __tablename__ = 'task_systems'

    task_id = Column(BigInteger, ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True)
    system_id = Column(BigInteger, ForeignKey('systems.id', ondelete='CASCADE'), primary_key=True)
    interaction_type = Column(String(40))

    task = relationship("Task", back_populates="systems")
    system = relationship("System", back_populates="tasks")


class FlowNode(Base):
    __tablename__ = 'flow_nodes'

    id = Column(BigInteger, primary_key=True)
    process_id = Column(BigInteger, ForeignKey('processes.id', ondelete='CASCADE'), nullable=False)
    bpmn_id = Column(String(60), unique=True, nullable=False)
    node_type = Column(ENUM(BpmnNodeType, name='bpmn_node_type'), nullable=False)
    name = Column(String(200))

    process = relationship("Process", back_populates="flow_nodes")


class SequenceFlow(Base):
    __tablename__ = 'sequence_flows'

    id = Column(BigInteger, primary_key=True)
    process_id = Column(BigInteger, ForeignKey('processes.id', ondelete='CASCADE'), nullable=False)
    bpmn_id = Column(String(60), unique=True, nullable=False)
    source_ref = Column(String(60), nullable=False)
    target_ref = Column(String(60), nullable=False)
    name = Column(String(200))
    condition_expression = Column(Text)
    # Probabilidad de tomar esta rama al salir de una compuerta exclusiva (0-100).
    # NULL = no definida (las métricas asumen reparto equiprobable entre ramas).
    branch_probability = Column(Numeric(5, 2), nullable=True)

    process = relationship("Process", back_populates="sequence_flows")

class MacroSequenceFlow(Base):
    __tablename__ = 'macro_sequence_flows'

    id = Column(BigInteger, primary_key=True)
    macroprocess_id = Column(BigInteger, ForeignKey('macroprocesses.id', ondelete='CASCADE'), nullable=False)
    source_ref = Column(String(60), nullable=False)
    target_ref = Column(String(60), nullable=False)
    condition = Column(String(200))

    macroprocess = relationship("Macroprocess", back_populates="macro_sequence_flows")


class OptimizationRun(Base):
    __tablename__ = 'optimization_runs'

    id = Column(BigInteger, primary_key=True)
    process_id = Column(BigInteger, ForeignKey('processes.id', ondelete='CASCADE'), nullable=False, index=True)
    status = Column(ENUM(OptStatus, name='opt_status'), nullable=False, server_default='pending')
    model_used = Column(String(80))
    input_snapshot = Column(JSONB, nullable=False)
    result = Column(JSONB)
    value_added_ratio = Column(Numeric(5, 4))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    process = relationship("Process", back_populates="optimization_runs")


class MacroOptimizationRun(Base):
    __tablename__ = 'macro_optimization_runs'

    id = Column(BigInteger, primary_key=True)
    macroprocess_id = Column(BigInteger, ForeignKey('macroprocesses.id', ondelete='CASCADE'), nullable=False, index=True)
    status = Column(ENUM(OptStatus, name='opt_status'), nullable=False, server_default='pending')
    model_used = Column(String(80))
    input_snapshot = Column(JSONB, nullable=False)
    result = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    macroprocess = relationship("Macroprocess", back_populates="optimization_runs")


class BpmnArtifact(Base):
    __tablename__ = 'bpmn_artifacts'

    id = Column(BigInteger, primary_key=True)
    process_id = Column(BigInteger, ForeignKey('processes.id', ondelete='CASCADE'), nullable=False)
    version = Column(Integer, nullable=False)
    source = Column(ENUM(ArtifactSource, name='artifact_source'), nullable=False, server_default='manual')
    xml_content = Column(Text, nullable=False)
    checksum = Column(String(64))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('process_id', 'version', name='uq_bpmn_artifact_process_version'),
    )

    process = relationship("Process", back_populates="bpmn_artifacts")
