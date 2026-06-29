from sqlalchemy.orm import Session, selectinload, joinedload
from app import models, schemas
from decimal import Decimal

def calculate_process_metrics(db: Session, process_id: int) -> schemas.ProcessMetricsResponse:
    process = (
        db.query(models.Process)
        .options(
            selectinload(models.Process.activities)
            .selectinload(models.Activity.tasks)
            .selectinload(models.Task.raci)
            .selectinload(models.TaskRaci.role),
            selectinload(models.Process.activities)
            .selectinload(models.Activity.tasks)
            .selectinload(models.Task.systems)
            .selectinload(models.TaskSystem.system),
        )
        .filter(models.Process.id == process_id)
        .first()
    )
    if not process:
        raise ValueError(f"Process {process_id} not found")

    # Fetch tasks in order
    tasks = []
    # Sort activities by position_order, then tasks by position_order
    for activity in sorted(process.activities, key=lambda a: a.position_order):
        for task in sorted(activity.tasks, key=lambda t: t.position_order):
            tasks.append(task)
            
    total_tasks = len(tasks)
    if total_tasks == 0:
        return schemas.ProcessMetricsResponse(
            process_id=process_id,
            total_cycle_time_sec=0.0,
            total_wait_time_sec=0.0,
            lead_time_sec=0.0,
            pce_percentage=0.0,
            structural=schemas.StructuralMetrics(
                va_count=0, nnva_count=0, nva_count=0, total_tasks=0,
                rework_rate_percentage=0.0, unique_systems_count=0,
                system_jumps=0, handoffs_count=0
            ),
            bottlenecks=[],
            cost=schemas.MetricCost(total_cost=0.0, nva_cost=0.0)
        )

    # 1. Base Times
    total_cycle = sum(float(t.std_cycle_time_sec) for t in tasks)
    total_wait = sum(float(t.std_wait_time_sec) for t in tasks)
    lead_time = total_cycle + total_wait

    # 2. PCE
    va_cycle = sum(float(t.std_cycle_time_sec) for t in tasks if t.value_classification == models.ValueClass.VA)
    pce = (va_cycle / lead_time * 100) if lead_time > 0 else 0.0

    # 3. Structural Metrics
    va_count = sum(1 for t in tasks if t.value_classification == models.ValueClass.VA)
    nnva_count = sum(1 for t in tasks if t.value_classification == models.ValueClass.NNVA)
    nva_count = sum(1 for t in tasks if t.value_classification == models.ValueClass.NVA)
    
    rework_count = sum(1 for t in tasks if t.waste_type == models.WasteType.defects)
    rework_rate = (rework_count / total_tasks * 100)
    
    systems_used = set()
    prev_system = None
    system_jumps = 0
    
    prev_executor = None
    handoffs = 0
    
    total_cost = 0.0
    nva_cost = 0.0
    
    # N+1 mitigado con selectinload en el caller — ver eager loading arriba
    for i, t in enumerate(tasks):
        # Systems
        task_sys = [ts.system for ts in t.systems if ts.system]
        for s in task_sys:
            systems_used.add(s.id)
            
        current_sys = task_sys[0].id if task_sys else None
        if i > 0 and current_sys and prev_system and current_sys != prev_system:
            system_jumps += 1
        prev_system = current_sys if current_sys else prev_system
        
        # RACI, Handoffs & Costo
        # El EJECUTOR del trabajo es el Responsible (R). Tanto el costo de mano de
        # obra como los handoffs (traspasos) se miden sobre quien REALIZA la tarea,
        # no sobre el Accountable: el Accountable suele ser constante en todo el
        # proceso (un jefe), lo que sub-reporta handoffs y distorsiona el costo
        # (cobra a tarifa de gerente trabajo ejecutado por personal junior).
        resp_roles = [tr.role for tr in t.raci if tr.raci_type == models.RaciType.R]
        executor_roles = resp_roles
        if not executor_roles:
            # Fallback: Accountable, luego cualquier rol asignado
            executor_roles = [tr.role for tr in t.raci if tr.raci_type == models.RaciType.A]
        if not executor_roles and t.raci:
            executor_roles = [t.raci[0].role]

        current_exec = executor_roles[0].id if executor_roles else None

        if i > 0 and current_exec and prev_executor and current_exec != prev_executor:
            handoffs += 1
        prev_executor = current_exec if current_exec else prev_executor

        # Costo de mano de obra = tiempo de ciclo × tarifa del ejecutor (Responsible)
        if executor_roles and executor_roles[0].cost_per_hour is not None:
            cph = float(executor_roles[0].cost_per_hour)
            task_cost = (float(t.std_cycle_time_sec) / 3600.0) * cph
            total_cost += task_cost
            if t.value_classification == models.ValueClass.NVA:
                nva_cost += task_cost

    # 4. Bottlenecks (TOC)
    avg_cycle = total_cycle / total_tasks
    avg_wait = total_wait / total_tasks
    
    bottlenecks = []
    for t in tasks:
        c_time = float(t.std_cycle_time_sec)
        w_time = float(t.std_wait_time_sec)
        
        if avg_cycle > 0 and c_time > 1.5 * avg_cycle:
            bottlenecks.append(schemas.MetricBottleneck(
                task_id=t.id,
                bpmn_id=t.bpmn_id,
                name=t.name,
                metric_type="cycle_time",
                value_sec=c_time,
                deviation_factor=c_time / avg_cycle
            ))
            
        if avg_wait > 0 and w_time > 1.5 * avg_wait:
            bottlenecks.append(schemas.MetricBottleneck(
                task_id=t.id,
                bpmn_id=t.bpmn_id,
                name=t.name,
                metric_type="wait_time",
                value_sec=w_time,
                deviation_factor=w_time / avg_wait
            ))

    return schemas.ProcessMetricsResponse(
        process_id=process_id,
        total_cycle_time_sec=total_cycle,
        total_wait_time_sec=total_wait,
        lead_time_sec=lead_time,
        pce_percentage=pce,
        structural=schemas.StructuralMetrics(
            va_count=va_count,
            nnva_count=nnva_count,
            nva_count=nva_count,
            total_tasks=total_tasks,
            rework_rate_percentage=rework_rate,
            unique_systems_count=len(systems_used),
            system_jumps=system_jumps,
            handoffs_count=handoffs
        ),
        bottlenecks=bottlenecks,
        cost=schemas.MetricCost(
            total_cost=total_cost,
            nva_cost=nva_cost
        )
    )
