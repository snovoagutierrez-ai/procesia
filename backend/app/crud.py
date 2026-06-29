from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app import models, schemas

# ==========================================
# 1. CRUD: Macroprocesses
# ==========================================

def get_macroprocess(db: Session, macroprocess_id: int):
    return db.query(models.Macroprocess).filter(models.Macroprocess.id == macroprocess_id).first()

def get_macroprocesses(db: Session, skip: int = 0, limit: int = 100, user_id: int = None):
    q = db.query(models.Macroprocess)
    if user_id:
        q = q.filter(models.Macroprocess.owner_id == user_id)
    return q.offset(skip).limit(limit).all()

def create_macroprocess(db: Session, macroprocess: schemas.MacroprocessCreate, owner_id: int):
    db_macro = models.Macroprocess(
        owner_id=owner_id,
        code=macroprocess.code,
        name=macroprocess.name,
        owner_area=macroprocess.owner_area
    )
    db.add(db_macro)
    db.commit()
    db.refresh(db_macro)
    return db_macro

def update_macroprocess(db: Session, db_macro: models.Macroprocess, macroprocess_in: schemas.MacroprocessUpdate):
    update_data = macroprocess_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_macro, field, value)
    db.commit()
    db.refresh(db_macro)
    return db_macro

def delete_macroprocess(db: Session, macroprocess_id: int):
    db_macro = get_macroprocess(db, macroprocess_id)
    if db_macro:
        db.delete(db_macro)
        db.commit()
        return True
    return False

# ==========================================
# 2. CRUD: Processes
# ==========================================

def get_process(db: Session, process_id: int):
    return db.query(models.Process).filter(models.Process.id == process_id).first()

def get_processes(db: Session, skip: int = 0, limit: int = 100, user_id: int = None):
    q = db.query(models.Process)
    if user_id:
        q = q.filter(models.Process.owner_id == user_id)
    return q.offset(skip).limit(limit).all()

def create_process(db: Session, process: schemas.ProcessCreate, owner_id: int):
    # Verify macroprocess exists
    macro = get_macroprocess(db, process.macroprocess_id)
    if not macro:
        raise HTTPException(status_code=400, detail="Macroprocess not found")
        
    db_process = models.Process(
        owner_id=owner_id,
        macroprocess_id=process.macroprocess_id,
        code=process.code,
        name=process.name,
        objective=process.objective,
        trigger_event=process.trigger_event,
        output_result=process.output_result
    )
    db.add(db_process)
    db.flush()

    # Automatically create default activity associated with it
    default_activity = models.Activity(
        process_id=db_process.id,
        name="General",
        position_order=1
    )
    db.add(default_activity)

    db.commit()
    db.refresh(db_process)
    return db_process

def update_process(db: Session, db_process: models.Process, process_in: schemas.ProcessUpdate):
    if process_in.macroprocess_id is not None:
        macro = get_macroprocess(db, process_in.macroprocess_id)
        if not macro:
            raise HTTPException(status_code=400, detail="Macroprocess not found")
            
    update_data = process_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_process, field, value)
    db.commit()
    db.refresh(db_process)
    return db_process

def delete_process(db: Session, process_id: int):
    db_process = get_process(db, process_id)
    if db_process:
        db.delete(db_process)
        db.commit()
        return True
    return False

# ==========================================
# 3. CRUD: Activities
# ==========================================

def get_activity(db: Session, activity_id: int):
    return db.query(models.Activity).filter(models.Activity.id == activity_id).first()

def get_activities(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Activity).offset(skip).limit(limit).all()

def create_activity(db: Session, activity: schemas.ActivityCreate):
    proc = get_process(db, activity.process_id)
    if not proc:
        raise HTTPException(status_code=400, detail="Process not found")
        
    db_activity = models.Activity(
        process_id=activity.process_id,
        name=activity.name,
        position_order=activity.position_order
    )
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity

def update_activity(db: Session, db_activity: models.Activity, activity_in: schemas.ActivityUpdate):
    if activity_in.process_id is not None:
        proc = get_process(db, activity_in.process_id)
        if not proc:
            raise HTTPException(status_code=400, detail="Process not found")
            
    update_data = activity_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_activity, field, value)
    db.commit()
    db.refresh(db_activity)
    return db_activity

def delete_activity(db: Session, activity_id: int):
    db_activity = get_activity(db, activity_id)
    if db_activity:
        db.delete(db_activity)
        db.commit()
        return True
    return False

# ==========================================
# 4. CRUD: Tasks (with Nested RACI & Systems)
# ==========================================

def get_task(db: Session, task_id: int):
    return db.query(models.Task).filter(models.Task.id == task_id).first()

def get_tasks(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Task).offset(skip).limit(limit).all()

def create_task(db: Session, task_in: schemas.TaskCreate):
    # Check activity exists
    act = get_activity(db, task_in.activity_id)
    if not act:
        raise HTTPException(status_code=400, detail="Activity not found")
        
    # Only pure waste (NVA) tasks require a waste_type classification
    if task_in.value_classification == models.ValueClass.NVA and task_in.waste_type is None:
        raise HTTPException(
            status_code=400,
            detail="NVA tasks must have a waste_type specified"
        )

    # Core data fields (excluding nested tables)
    db_task = models.Task(
        activity_id=task_in.activity_id,
        bpmn_id=task_in.bpmn_id,
        name=task_in.name,
        description=task_in.description,
        position_order=task_in.position_order,
        task_type=task_in.task_type,
        value_classification=task_in.value_classification,
        waste_type=task_in.waste_type,
        std_cycle_time_sec=task_in.std_cycle_time_sec,
        std_wait_time_sec=task_in.std_wait_time_sec
    )
    db.add(db_task)
    db.flush()  # to get the task ID

    # Create nested RACI assignments
    if task_in.raci:
        for r_nested in task_in.raci:
            # Verify role exists
            role = get_role(db, r_nested.role_id)
            if not role:
                raise HTTPException(status_code=400, detail=f"Role with id {r_nested.role_id} not found")
            db_raci = models.TaskRaci(
                task_id=db_task.id,
                role_id=r_nested.role_id,
                raci_type=r_nested.raci_type
            )
            db.add(db_raci)

    # Create nested Systems assignments
    if task_in.systems:
        for s_nested in task_in.systems:
            # Verify system exists
            system = get_system(db, s_nested.system_id)
            if not system:
                raise HTTPException(status_code=400, detail=f"System with id {s_nested.system_id} not found")
            db_system = models.TaskSystem(
                task_id=db_task.id,
                system_id=s_nested.system_id,
                interaction_type=s_nested.interaction_type
            )
            db.add(db_system)

    db.commit()
    db.refresh(db_task)
    return db_task

def update_task(db: Session, db_task: models.Task, task_in: schemas.TaskUpdate):
    if task_in.activity_id is not None:
        act = get_activity(db, task_in.activity_id)
        if not act:
            raise HTTPException(status_code=400, detail="Activity not found")

    # Only pure waste (NVA) tasks require a waste_type classification
    val_class = task_in.value_classification if task_in.value_classification is not None else db_task.value_classification
    w_type = task_in.waste_type if task_in.waste_type is not None else db_task.waste_type
    if val_class == models.ValueClass.NVA and w_type is None:
        raise HTTPException(
            status_code=400,
            detail="NVA tasks must have a waste_type specified"
        )

    # Update core Task fields
    update_data = task_in.model_dump(exclude_unset=True, exclude={'raci', 'systems'})
    for field, value in update_data.items():
        setattr(db_task, field, value)

    # Update nested RACI if provided (replace all)
    if task_in.raci is not None:
        # Delete existing RACI assignments
        db.query(models.TaskRaci).filter(models.TaskRaci.task_id == db_task.id).delete()
        for r_nested in task_in.raci:
            # Verify role exists
            role = get_role(db, r_nested.role_id)
            if not role:
                raise HTTPException(status_code=400, detail=f"Role with id {r_nested.role_id} not found")
            db_raci = models.TaskRaci(
                task_id=db_task.id,
                role_id=r_nested.role_id,
                raci_type=r_nested.raci_type
            )
            db.add(db_raci)

    # Update nested Systems if provided (replace all)
    if task_in.systems is not None:
        # Delete existing System assignments
        db.query(models.TaskSystem).filter(models.TaskSystem.task_id == db_task.id).delete()
        for s_nested in task_in.systems:
            # Verify system exists
            system = get_system(db, s_nested.system_id)
            if not system:
                raise HTTPException(status_code=400, detail=f"System with id {s_nested.system_id} not found")
            db_system = models.TaskSystem(
                task_id=db_task.id,
                system_id=s_nested.system_id,
                interaction_type=s_nested.interaction_type
            )
            db.add(db_system)

    db.commit()
    db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: int):
    db_task = get_task(db, task_id)
    if db_task:
        db.delete(db_task)
        db.commit()
        return True
    return False

# ==========================================
# 5. CRUD: Roles
# ==========================================

def get_role(db: Session, role_id: int):
    return db.query(models.Role).filter(models.Role.id == role_id).first()

def get_roles(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Role).offset(skip).limit(limit).all()

def create_role(db: Session, role: schemas.RoleCreate):
    db_role = models.Role(
        name=role.name,
        area=role.area,
        cost_per_hour=role.cost_per_hour
    )
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

def update_role(db: Session, db_role: models.Role, role_in: schemas.RoleUpdate):
    update_data = role_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_role, field, value)
    db.commit()
    db.refresh(db_role)
    return db_role

def delete_role(db: Session, role_id: int):
    db_role = get_role(db, role_id)
    if db_role:
        db.delete(db_role)
        db.commit()
        return True
    return False

# ==========================================
# 6. CRUD: Systems
# ==========================================

def get_system(db: Session, system_id: int):
    return db.query(models.System).filter(models.System.id == system_id).first()

def get_systems(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.System).offset(skip).limit(limit).all()

def create_system(db: Session, system: schemas.SystemCreate):
    db_system = models.System(
        name=system.name,
        system_type=system.system_type,
        vendor=system.vendor
    )
    db.add(db_system)
    db.commit()
    db.refresh(db_system)
    return db_system

def update_system(db: Session, db_system: models.System, system_in: schemas.SystemUpdate):
    update_data = system_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_system, field, value)
    db.commit()
    db.refresh(db_system)
    return db_system

def delete_system(db: Session, system_id: int):
    db_system = get_system(db, system_id)
    if db_system:
        db.delete(db_system)
        db.commit()
        return True
    return False

# ==========================================
# 7. CRUD: Task RACI
# ==========================================

def get_task_racis(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.TaskRaci).offset(skip).limit(limit).all()

def create_task_raci(db: Session, task_raci: schemas.TaskRaciCreate):
    # Verify task exists
    t = get_task(db, task_raci.task_id)
    if not t:
        raise HTTPException(status_code=400, detail="Task not found")
    
    # Verify role exists
    r = get_role(db, task_raci.role_id)
    if not r:
        raise HTTPException(status_code=400, detail="Role not found")
        
    db_traci = models.TaskRaci(
        task_id=task_raci.task_id,
        role_id=task_raci.role_id,
        raci_type=task_raci.raci_type
    )
    db.add(db_traci)
    db.commit()
    return db_traci

def delete_task_raci(db: Session, task_id: int, role_id: int, raci_type: models.RaciType):
    db_traci = db.query(models.TaskRaci).filter(
        models.TaskRaci.task_id == task_id,
        models.TaskRaci.role_id == role_id,
        models.TaskRaci.raci_type == raci_type
    ).first()
    if db_traci:
        db.delete(db_traci)
        db.commit()
        return True
    return False

# ==========================================
# 8. CRUD: Task Systems
# ==========================================

def get_task_systems(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.TaskSystem).offset(skip).limit(limit).all()

def create_task_system(db: Session, task_system: schemas.TaskSystemCreate):
    # Verify task exists
    t = get_task(db, task_system.task_id)
    if not t:
        raise HTTPException(status_code=400, detail="Task not found")
        
    # Verify system exists
    s = get_system(db, task_system.system_id)
    if not s:
        raise HTTPException(status_code=400, detail="System not found")

    db_tsystem = models.TaskSystem(
        task_id=task_system.task_id,
        system_id=task_system.system_id,
        interaction_type=task_system.interaction_type
    )
    db.add(db_tsystem)
    db.commit()
    return db_tsystem

def delete_task_system(db: Session, task_id: int, system_id: int):
    db_tsystem = db.query(models.TaskSystem).filter(
        models.TaskSystem.task_id == task_id,
        models.TaskSystem.system_id == system_id
    ).first()
    if db_tsystem:
        db.delete(db_tsystem)
        db.commit()
        return True
    return False

# ==========================================
# 9. CRUD Direct Tasks (Helpers for Frontend flat structure)
# ==========================================

def create_task_direct(db: Session, activity_id: int, task_in: schemas.TaskCreateDirect):
    # Enforce CHECK constraint
    if task_in.value_classification == models.ValueClass.NVA and task_in.waste_type is None:
        raise HTTPException(
            status_code=400,
            detail="If task is pure waste (NVA), a waste_type must be specified"
        )

    db_task = models.Task(
        activity_id=activity_id,
        bpmn_id=task_in.bpmn_id,
        name=task_in.name,
        description=task_in.description,
        position_order=task_in.position_order,
        task_type=task_in.task_type,
        value_classification=task_in.value_classification,
        waste_type=task_in.waste_type,
        std_cycle_time_sec=task_in.std_cycle_time_sec,
        std_wait_time_sec=task_in.std_wait_time_sec
    )
    db.add(db_task)
    db.flush()

    # Update RACI
    _update_task_raci_direct(db, db_task.id, task_in.responsible, task_in.accountable, task_in.consulted, task_in.informed)

    # Update Systems
    _update_task_systems_direct(db, db_task.id, task_in.systems)

    db.commit()
    db.refresh(db_task)
    return db_task

def update_task_direct(db: Session, db_task: models.Task, task_in: schemas.TaskUpdateDirect):
    # Only pure waste (NVA) tasks require a waste_type classification
    val_class = task_in.value_classification if task_in.value_classification is not None else db_task.value_classification
    w_type = task_in.waste_type if task_in.waste_type is not None else db_task.waste_type
    if val_class == models.ValueClass.NVA and w_type is None:
        raise HTTPException(
            status_code=400,
            detail="NVA tasks must have a waste_type specified"
        )

    # Update task fields
    update_data = task_in.model_dump(exclude_unset=True, exclude={'responsible', 'accountable', 'consulted', 'informed', 'systems'})
    for field, value in update_data.items():
        setattr(db_task, field, value)

    # Update RACI if provided (either of the fields was set)
    raci_fields = {'responsible', 'accountable', 'consulted', 'informed'}
    sent_fields = task_in.model_dump(exclude_unset=True).keys()
    if any(rf in sent_fields for rf in raci_fields):
        # Agrega los roles actuales por letra (puede haber varios en C/I) → texto con comas,
        # para preservar las letras no enviadas en una actualización parcial.
        existing_lists: dict[str, list] = {rt: [] for rt in ('R', 'A', 'C', 'I')}
        for r in db_task.raci:
            role = db.query(models.Role).filter(models.Role.id == r.role_id).first()
            if role:
                existing_lists[r.raci_type.value].append(role.name)
        existing = {k: (", ".join(v) if v else None) for k, v in existing_lists.items()}
        resp = task_in.responsible if task_in.responsible is not None else existing['R']
        acc  = task_in.accountable if task_in.accountable is not None else existing['A']
        cons = task_in.consulted   if task_in.consulted   is not None else existing['C']
        inf  = task_in.informed    if task_in.informed    is not None else existing['I']
        _update_task_raci_direct(db, db_task.id, resp, acc, cons, inf)

    # Update Systems if provided
    if 'systems' in sent_fields:
        _update_task_systems_direct(db, db_task.id, task_in.systems)

    db.commit()
    db.refresh(db_task)
    return db_task

def _update_task_raci_direct(db: Session, task_id: int, R: str, A: str, C: str, I: str):
    # Delete existing
    db.query(models.TaskRaci).filter(models.TaskRaci.task_id == task_id).delete()
    
    # Cada letra acepta múltiples roles separados por coma (típico en Consulted/Informed).
    # La PK (task_id, role_id, raci_type) impide duplicar el mismo rol en la misma letra.
    raci_map = {'R': R, 'A': A, 'C': C, 'I': I}
    for rtype, raw in raci_map.items():
        if not raw or not raw.strip():
            continue
        seen = set()
        for part in raw.split(','):
            name_clean = part.strip().title()
            if not name_clean or name_clean in seen:
                continue
            seen.add(name_clean)
            role = db.query(models.Role).filter(models.Role.name == name_clean).first()
            if not role:
                role = models.Role(name=name_clean)
                db.add(role)
                db.flush()
            db.add(models.TaskRaci(task_id=task_id, role_id=role.id, raci_type=rtype))

def _update_task_systems_direct(db: Session, task_id: int, systems_str: str):
    # Delete existing
    db.query(models.TaskSystem).filter(models.TaskSystem.task_id == task_id).delete()
    
    if systems_str and systems_str.strip():
        # Split by comma
        sys_names = [s.strip() for s in systems_str.split(',') if s.strip()]
        for sys_name in sys_names:
            # Find or create system
            system = db.query(models.System).filter(models.System.name == sys_name).first()
            if not system:
                system = models.System(name=sys_name)
                db.add(system)
                db.flush()
            db_ts = models.TaskSystem(task_id=task_id, system_id=system.id)
            db.add(db_ts)

# ==========================================
# 8. Graph (Nodes & Edges) sync for Phase 3
# ==========================================

def get_graph(db: Session, process_id: int) -> schemas.GraphResponse:
    gateways = db.query(models.FlowNode).filter(
        models.FlowNode.process_id == process_id,
        models.FlowNode.node_type.in_([models.BpmnNodeType.exclusiveGateway, models.BpmnNodeType.parallelGateway, models.BpmnNodeType.inclusiveGateway])
    ).all()
    
    sequence_flows = db.query(models.SequenceFlow).filter(
        models.SequenceFlow.process_id == process_id
    ).all()
    
    return schemas.GraphResponse(
        gateways=gateways,
        sequence_flows=sequence_flows
    )

def get_macro_graph(db: Session, macroprocess_id: int) -> schemas.MacroGraphSync:
    flows = db.query(models.MacroSequenceFlow).filter(models.MacroSequenceFlow.macroprocess_id == macroprocess_id).all()
    return schemas.MacroGraphSync.model_validate({"sequence_flows": flows})

def sync_macro_graph(db: Session, macroprocess_id: int, graph_data: schemas.MacroGraphSync) -> schemas.MacroGraphSync:
    db.query(models.MacroSequenceFlow).filter(models.MacroSequenceFlow.macroprocess_id == macroprocess_id).delete(synchronize_session=False)
    
    new_flows = []
    for f in graph_data.sequence_flows:
        flow = models.MacroSequenceFlow(
            macroprocess_id=macroprocess_id,
            source_ref=f.source_ref,
            target_ref=f.target_ref,
            condition=f.condition
        )
        new_flows.append(flow)
    
    db.add_all(new_flows)
    db.commit()
    
    return get_macro_graph(db, macroprocess_id)

def sync_graph(db: Session, process_id: int, graph_data: schemas.GraphSync) -> schemas.GraphResponse:
    # 1. Upsert Gateways
    existing_gateways = db.query(models.FlowNode).filter(
        models.FlowNode.process_id == process_id,
        models.FlowNode.node_type.in_([models.BpmnNodeType.exclusiveGateway, models.BpmnNodeType.parallelGateway, models.BpmnNodeType.inclusiveGateway])
    ).all()
    
    existing_gw_map = {gw.bpmn_id: gw for gw in existing_gateways}
    incoming_gw_ids = set()
    
    for gw in graph_data.gateways:
        incoming_gw_ids.add(gw.bpmn_id)
        if gw.bpmn_id in existing_gw_map:
            # Update existing
            existing_gw_map[gw.bpmn_id].name = gw.name
            existing_gw_map[gw.bpmn_id].node_type = gw.node_type
        else:
            # Insert new
            db_gw = models.FlowNode(
                process_id=process_id,
                bpmn_id=gw.bpmn_id,
                node_type=gw.node_type,
                name=gw.name
            )
            db.add(db_gw)
            
    # Delete removed gateways
    for bpmn_id, gw in existing_gw_map.items():
        if bpmn_id not in incoming_gw_ids:
            db.delete(gw)

    # 2. Upsert Sequence Flows
    existing_flows = db.query(models.SequenceFlow).filter(models.SequenceFlow.process_id == process_id).all()
    existing_sf_map = {sf.bpmn_id: sf for sf in existing_flows}
    incoming_sf_ids = set()
    
    for sf in graph_data.sequence_flows:
        incoming_sf_ids.add(sf.bpmn_id)
        if sf.bpmn_id in existing_sf_map:
            existing_sf_map[sf.bpmn_id].source_ref = sf.source_ref
            existing_sf_map[sf.bpmn_id].target_ref = sf.target_ref
            existing_sf_map[sf.bpmn_id].name = sf.name
            existing_sf_map[sf.bpmn_id].condition_expression = sf.condition_expression
        else:
            db_sf = models.SequenceFlow(
                process_id=process_id,
                bpmn_id=sf.bpmn_id,
                source_ref=sf.source_ref,
                target_ref=sf.target_ref,
                name=sf.name,
                condition_expression=sf.condition_expression
            )
            db.add(db_sf)
            
    # Delete removed sequence flows
    for bpmn_id, sf in existing_sf_map.items():
        if bpmn_id not in incoming_sf_ids:
            db.delete(sf)

    db.commit()
    return get_graph(db, process_id)


# ==========================================
# 11. Time Measurements (#8 — tiempos observados)
# ==========================================

def create_time_measurement(db: Session, task_id: int, m_in: schemas.TimeMeasurementInput):
    db_m = models.TimeMeasurement(
        task_id=task_id,
        observed_cycle_sec=m_in.observed_cycle_sec,
        observed_wait_sec=m_in.observed_wait_sec,
        case_ref=m_in.case_ref,
    )
    db.add(db_m)
    db.commit()
    db.refresh(db_m)
    return db_m

def get_task_measurements(db: Session, task_id: int):
    return (
        db.query(models.TimeMeasurement)
        .filter(models.TimeMeasurement.task_id == task_id)
        .order_by(models.TimeMeasurement.observed_at.desc())
        .all()
    )

def delete_time_measurement(db: Session, measurement_id: int):
    m = db.query(models.TimeMeasurement).filter(models.TimeMeasurement.id == measurement_id).first()
    if not m:
        return False
    db.delete(m)
    db.commit()
    return True
