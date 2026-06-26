from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Literal, Any, Dict
from datetime import datetime
from decimal import Decimal
from app.models import ValueClass, WasteType, TaskType, RaciType, BpmnNodeType, OptStatus, ArtifactSource, UserRole

# ==========================================
# 0. Auth & Users Schemas
# ==========================================

class UserCreate(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(char.isdigit() for char in v):
            raise ValueError('La contraseña debe contener al menos un número.')
        if not any(char.isalpha() for char in v):
            raise ValueError('La contraseña debe contener al menos una letra.')
        return v

class UserResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class ChatRequest(BaseModel):
    message: str = Field(..., max_length=500)
    
class TaskAssistantRequest(BaseModel):
    text: str = Field(..., max_length=1000)
    current_name: Optional[str] = None
    current_type: Optional[str] = None
    current_value_class: Optional[str] = None
# ==========================================

class TaskRaciBase(BaseModel):
    raci_type: RaciType

class TaskRaciCreateNested(TaskRaciBase):
    role_id: int

class TaskRaciCreate(TaskRaciCreateNested):
    task_id: int

class TaskRaciResponse(TaskRaciBase):
    task_id: int
    role_id: int
    
    class Config:
        from_attributes = True

class TaskSystemBase(BaseModel):
    interaction_type: Optional[str] = None

class TaskSystemCreateNested(TaskSystemBase):
    system_id: int

class TaskSystemCreate(TaskSystemCreateNested):
    task_id: int

class TaskSystemResponse(TaskSystemBase):
    task_id: int
    system_id: int
    
    class Config:
        from_attributes = True

# ==========================================
# 2. CRUD: Macroprocesses
# ==========================================

class MacroprocessBase(BaseModel):
    code: str = Field(..., max_length=40)
    name: str = Field(..., max_length=200)
    owner_area: Optional[str] = Field(None, max_length=120)

class MacroprocessCreate(MacroprocessBase):
    pass

class MacroprocessUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=40)
    name: Optional[str] = Field(None, max_length=200)
    owner_area: Optional[str] = Field(None, max_length=120)

class MacroprocessResponse(MacroprocessBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================================
# 3. CRUD: Processes
# ==========================================

class ProcessBase(BaseModel):
    macroprocess_id: int
    code: str = Field(..., max_length=40)
    name: str = Field(..., max_length=200)
    objective: Optional[str] = None
    trigger_event: Optional[str] = Field(None, max_length=200)
    output_result: Optional[str] = Field(None, max_length=200)

class ProcessCreate(ProcessBase):
    pass

class ProcessUpdate(BaseModel):
    macroprocess_id: Optional[int] = None
    code: Optional[str] = Field(None, max_length=40)
    name: Optional[str] = Field(None, max_length=200)
    objective: Optional[str] = None
    trigger_event: Optional[str] = Field(None, max_length=200)
    output_result: Optional[str] = Field(None, max_length=200)

class ProcessResponse(ProcessBase):
    id: int

    class Config:
        from_attributes = True

# ==========================================
# 4. CRUD: Activities
# ==========================================

class ActivityBase(BaseModel):
    process_id: int
    name: str = Field(..., max_length=200)
    position_order: int

class ActivityCreate(ActivityBase):
    pass

class ActivityUpdate(BaseModel):
    process_id: Optional[int] = None
    name: Optional[str] = Field(None, max_length=200)
    position_order: Optional[int] = None

class ActivityResponse(ActivityBase):
    id: int

    class Config:
        from_attributes = True

# ==========================================
# 5. CRUD: Tasks
# ==========================================

class TaskBase(BaseModel):
    activity_id: int
    bpmn_id: str = Field(..., max_length=60)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    position_order: int
    task_type: TaskType = TaskType.user
    value_classification: ValueClass
    waste_type: Optional[WasteType] = None
    std_cycle_time_sec: Decimal = Field(default=Decimal('0.00'), ge=0)
    std_wait_time_sec: Decimal = Field(default=Decimal('0.00'), ge=0)

class TaskCreate(TaskBase):
    raci: Optional[List[TaskRaciCreateNested]] = None
    systems: Optional[List[TaskSystemCreateNested]] = None

class TaskCreateDirect(BaseModel):
    bpmn_id: str = Field(..., max_length=60)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    position_order: int
    task_type: TaskType = TaskType.user
    value_classification: ValueClass
    waste_type: Optional[WasteType] = None
    std_cycle_time_sec: Decimal = Field(default=Decimal('0.00'), ge=0)
    std_wait_time_sec: Decimal = Field(default=Decimal('0.00'), ge=0)
    responsible: Optional[str] = None
    accountable: Optional[str] = None
    consulted: Optional[str] = None
    informed: Optional[str] = None
    systems: Optional[str] = None

    @model_validator(mode='after')
    def validate_waste(self):
        if self.value_classification == ValueClass.NVA and not self.waste_type:
            raise ValueError("waste_type is required when value_classification is NVA")
        return self

class TaskUpdate(BaseModel):
    activity_id: Optional[int] = None
    bpmn_id: Optional[str] = Field(None, max_length=60)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    position_order: Optional[int] = None
    task_type: Optional[TaskType] = None
    value_classification: Optional[ValueClass] = None
    waste_type: Optional[WasteType] = None
    std_cycle_time_sec: Optional[Decimal] = Field(None, ge=0)
    std_wait_time_sec: Optional[Decimal] = Field(None, ge=0)
    raci: Optional[List[TaskRaciCreateNested]] = None
    systems: Optional[List[TaskSystemCreateNested]] = None

class TaskUpdateDirect(BaseModel):
    bpmn_id: Optional[str] = Field(None, max_length=60)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    position_order: Optional[int] = None
    task_type: Optional[TaskType] = None
    value_classification: Optional[ValueClass] = None
    waste_type: Optional[WasteType] = None
    std_cycle_time_sec: Optional[Decimal] = Field(None, ge=0)
    std_wait_time_sec: Optional[Decimal] = Field(None, ge=0)
    responsible: Optional[str] = None
    accountable: Optional[str] = None
    consulted: Optional[str] = None
    informed: Optional[str] = None
    systems: Optional[str] = None

    @model_validator(mode='after')
    def validate_waste(self):
        if self.value_classification == ValueClass.NVA and not self.waste_type:
            raise ValueError("waste_type is required when value_classification is NVA")
        return self

class TaskResponse(TaskBase):
    id: int
    responsible: Optional[str] = None
    accountable: Optional[str] = None
    consulted: Optional[str] = None
    informed: Optional[str] = None
    systems: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def extract_relations(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            r_names = {}
            if hasattr(data, 'raci') and data.raci:
                for tr in data.raci:
                    if tr.role:
                        r_names[tr.raci_type.value] = tr.role.name
            
            sys_names = ""
            if hasattr(data, 'systems') and data.systems:
                sys_list = []
                for ts in data.systems:
                    if ts.system:
                        sys_list.append(ts.system.name)
                sys_names = ", ".join(sys_list)

            return {
                "id": data.id,
                "activity_id": data.activity_id,
                "bpmn_id": data.bpmn_id,
                "name": data.name,
                "description": data.description,
                "position_order": data.position_order,
                "task_type": data.task_type,
                "value_classification": data.value_classification,
                "waste_type": data.waste_type,
                "std_cycle_time_sec": data.std_cycle_time_sec,
                "std_wait_time_sec": data.std_wait_time_sec,
                "responsible": r_names.get('R'),
                "accountable": r_names.get('A'),
                "consulted": r_names.get('C'),
                "informed": r_names.get('I'),
                "systems": sys_names
            }
        return data

    class Config:
        from_attributes = True

# We add a model validator to enforce the check constraint in TaskCreate and TaskUpdate
class TaskCreateValidated(TaskCreate):
    @model_validator(mode='after')
    def validate_waste(self):
        if self.value_classification == ValueClass.NVA and not self.waste_type:
            raise ValueError("waste_type is required when value_classification is NVA")
        return self

    model_config = {
        "json_schema_extra": {
            "example": {
                "activity_id": 1,
                "bpmn_id": "Task_1",
                "name": "Ejemplo de tarea",
                "position_order": 1,
                "task_type": "user",
                "value_classification": "VA",
                "waste_type": None,
                "std_cycle_time_sec": 120.0,
                "std_wait_time_sec": 30.0,
                "raci": [{"role_id": 1, "raci_type": "R"}],
                "systems": [{"system_id": 1, "interaction_type": "read"}]
            }
        }
    }

# ==========================================
# 6. CRUD: Roles & Systems (Explicitly requested)
# ==========================================

class RoleBase(BaseModel):
    name: str = Field(..., max_length=120)
    area: Optional[str] = Field(None, max_length=120)
    cost_per_hour: Optional[Decimal] = None

class RoleCreate(RoleBase):
    pass

class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    area: Optional[str] = Field(None, max_length=120)
    cost_per_hour: Optional[Decimal] = None

class RoleResponse(RoleBase):
    id: int

    class Config:
        from_attributes = True


class SystemBase(BaseModel):
    name: str = Field(..., max_length=120)
    system_type: Optional[str] = Field(None, max_length=80)
    vendor: Optional[str] = Field(None, max_length=120)

class SystemCreate(SystemBase):
    pass

class SystemUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    system_type: Optional[str] = Field(None, max_length=80)
    vendor: Optional[str] = Field(None, max_length=120)

class SystemResponse(SystemBase):
    id: int

    class Config:
        from_attributes = True

# ==========================================
# 7. Time Measurements & Other child tables
# ==========================================

class TimeMeasurementBase(BaseModel):
    task_id: int
    observed_cycle_sec: Decimal
    observed_wait_sec: Decimal = Decimal('0.00')
    case_ref: Optional[str] = Field(None, max_length=80)

class TimeMeasurementCreate(TimeMeasurementBase):
    pass

class TimeMeasurementResponse(TimeMeasurementBase):
    id: int
    observed_at: datetime

    class Config:
        from_attributes = True


class FlowNodeBase(BaseModel):
    process_id: int
    bpmn_id: str = Field(..., max_length=60)
    node_type: BpmnNodeType
    name: Optional[str] = Field(None, max_length=200)

class FlowNodeCreate(FlowNodeBase):
    pass

class FlowNodeResponse(FlowNodeBase):
    id: int

    class Config:
        from_attributes = True


class SequenceFlowBase(BaseModel):
    process_id: int
    bpmn_id: str = Field(..., max_length=60)
    source_ref: str = Field(..., max_length=60)
    target_ref: str = Field(..., max_length=60)
    name: Optional[str] = Field(None, max_length=200)
    condition_expression: Optional[str] = None

class SequenceFlowCreate(SequenceFlowBase):
    pass

class SequenceFlowResponse(SequenceFlowBase):
    id: int

    class Config:
        from_attributes = True

class FlowNodeSync(BaseModel):
    bpmn_id: str = Field(..., max_length=60)
    node_type: BpmnNodeType
    name: Optional[str] = Field(None, max_length=200)

class SequenceFlowSync(BaseModel):
    bpmn_id: str = Field(..., max_length=60)
    source_ref: str = Field(..., max_length=60)
    target_ref: str = Field(..., max_length=60)
    name: Optional[str] = Field(None, max_length=200)
    condition_expression: Optional[str] = None

class GraphSync(BaseModel):
    gateways: List[FlowNodeSync]
    sequence_flows: List[SequenceFlowSync]

class MacroSequenceFlowSync(BaseModel):
    id: Optional[str] = None # Allows frontend IDs like sf-1234
    source_ref: str = Field(..., max_length=60)
    target_ref: str = Field(..., max_length=60)
    condition: Optional[str] = Field(None, max_length=200)

    class Config:
        from_attributes = True

class MacroGraphSync(BaseModel):
    sequence_flows: List[MacroSequenceFlowSync]

    class Config:
        from_attributes = True

class GraphResponse(BaseModel):
    gateways: List[FlowNodeResponse]
    sequence_flows: List[SequenceFlowResponse]

# ========= PROCESS SNAPSHOT =========

class ProcessSnapshotCreate(BaseModel):
    snapshot_json: dict

class ProcessSnapshotOut(BaseModel):
    id: int
    process_id: int
    snapshot_json: dict
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================================
# 8. Optimization & Gemini Response Schemas
# ==========================================

class OptimizationSummary(BaseModel):
    total_cycle_time_sec: float
    total_wait_time_sec: float
    value_added_ratio: float
    nva_task_count: int
    handoff_count: int

class Bottleneck(BaseModel):
    node_bpmn_id: str
    node_name: str
    metric: Literal["cycle_time", "wait_time", "rework"]
    value_sec: float
    deviation_factor: float
    severity: Literal["low", "medium", "high", "critical"]
    impact_description: str

class Inefficiency(BaseModel):
    node_bpmn_id: str
    waste_type: Literal[
        "defects", "overproduction", "waiting", "non_utilized_talent",
        "transportation", "inventory", "motion", "excess_processing"
    ]
    description: str
    root_cause: str

class Recommendation(BaseModel):
    id: str
    target_node_bpmn_id: Optional[str]
    action_type: Literal["ELIMINATE", "AUTOMATE", "SIMPLIFY", "MERGE", "PARALLELIZE", "REASSIGN", "STANDARDIZE"]
    description: str
    expected_benefit: str
    estimated_time_saving_pct: float = Field(..., ge=0, le=100)
    implementation_complexity: Literal["low", "medium", "high"]
    priority: int

class OptimizedNode(BaseModel):
    bpmn_id: str
    type: Literal["task", "gateway", "event"]
    subtype: str
    name: str
    cycle_time_sec: float
    wait_time_sec: float
    value_classification: Literal["VA", "NNVA", "NVA"]

class OptimizedFlowConnection(BaseModel):
    bpmn_id: str
    source_ref: str
    target_ref: str
    name: Optional[str]
    condition: Optional[str]

class OptimizedFlow(BaseModel):
    applies: bool
    nodes: List[OptimizedNode]
    flows: List[OptimizedFlowConnection]

class OptimizationResult(BaseModel):
    process_id: str
    analysis_confidence: float = Field(..., ge=0.0, le=1.0)
    summary: OptimizationSummary
    bottlenecks: List[Bottleneck]
    inefficiencies: List[Inefficiency]
    recommendations: List[Recommendation]
    optimized_flow: OptimizedFlow

class OptimizationRunResponse(BaseModel):
    id: int
    process_id: int
    status: OptStatus
    model_used: Optional[str]
    input_snapshot: Dict[str, Any]
    result: Optional[Dict[str, Any]]
    value_added_ratio: Optional[Decimal]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True

# ==========================================
# 9. Metrics Engine (Phase 1)
# ==========================================

class MetricBottleneck(BaseModel):
    task_id: int
    bpmn_id: str
    name: str
    metric_type: Literal["cycle_time", "wait_time"]
    value_sec: float
    deviation_factor: float

class MetricCost(BaseModel):
    total_cost: float
    nva_cost: float

class StructuralMetrics(BaseModel):
    va_count: int
    nnva_count: int
    nva_count: int
    total_tasks: int
    rework_rate_percentage: float
    unique_systems_count: int
    system_jumps: int
    handoffs_count: int

class ProcessMetricsResponse(BaseModel):
    process_id: int
    total_cycle_time_sec: float
    total_wait_time_sec: float
    lead_time_sec: float
    pce_percentage: float
    structural: StructuralMetrics
    bottlenecks: List[MetricBottleneck]
    cost: MetricCost

# ==========================================
# 10. Macro Optimization Results (Pydantic)
# ==========================================

class MacroOptimizationSummary(BaseModel):
    total_macro_lead_time_sec: float
    macro_pce: float
    total_handoffs: int

class MacroBottleneck(BaseModel):
    process_code: str
    process_name: str
    metric: Literal['lead_time', 'cycle_time']
    value_sec: float
    severity: Literal['low', 'medium', 'high', 'critical']
    impact_description: str

class InterfaceWaste(BaseModel):
    from_process_code: str
    to_process_code: str
    waste_type: Literal['waiting', 'rework', 'information_loss', 'motion']
    description: str
    estimated_delay_sec: float

class Redundancy(BaseModel):
    processes_involved: List[str]
    description: str
    consolidation_opportunity: str

class MacroRecommendation(BaseModel):
    id: str
    target_process_codes: List[str]
    action_type: Literal['ELIMINATE', 'AUTOMATE', 'SIMPLIFY', 'MERGE', 'PARALLELIZE', 'REASSIGN', 'STANDARDIZE']
    description: str
    expected_benefit: str
    implementation_complexity: Literal['low', 'medium', 'high']
    priority: int

class MacroOptimizationResult(BaseModel):
    macroprocess_id: str
    analysis_confidence: float = Field(..., ge=0.0, le=1.0)
    summary: MacroOptimizationSummary
    macro_bottlenecks: List[MacroBottleneck] = []
    interface_wastes: List[InterfaceWaste] = []
    redundancies: List[Redundancy] = []
    recommendations: List[MacroRecommendation] = []
    projected_macro_lead_time_sec: float
