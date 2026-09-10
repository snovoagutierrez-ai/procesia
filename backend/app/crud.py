import uuid

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

def direccion_del_cliente(request) -> str | None:
    """IP real de quien hace la peticion.

    Detras del proxy de Render, `request.client.host` es la del proxy y no la de
    la persona: la buena viene en X-Forwarded-For, cuyo PRIMER valor es el
    cliente original. Se lee ese, no el ultimo, que seria el propio proxy.
    """
    if request is None:
        return None
    reenviada = request.headers.get("x-forwarded-for")
    if reenviada:
        return reenviada.split(",")[0].strip()[:45]
    return getattr(getattr(request, "client", None), "host", None)


def registrar_actividad(db: Session, process_id: int, user_id: int | None, action: str,
                        target_type: str = None, target_bpmn_id: str = None,
                        summary: str = None, request=None, commit: bool = True):
    """Anota un movimiento en el historial del proceso.

    Nunca debe tumbar la operacion que la origina: registrar es secundario
    respecto a guardar el trabajo de la persona. Si falla, se descarta.
    """
    try:
        db.add(models.ProcessAudit(
            process_id=process_id,
            user_id=user_id,
            action=action,
            target_type=target_type,
            target_bpmn_id=target_bpmn_id,
            summary=(summary or None) and summary[:300],
            ip_address=direccion_del_cliente(request),
        ))
        if commit:
            db.commit()
    except Exception:
        db.rollback()


MINUTOS_ENTRE_ENTRADAS = 30


def registrar_entrada(db: Session, process_id: int, user_id: int, request=None):
    """Anota que alguien abrio el proceso, agrupando visitas seguidas.

    El GET se dispara en cada carga de la pantalla, asi que anotarlas todas
    llenaria el historial de ruido y taparia los cambios reales. Se guarda una
    entrada por persona cada media hora: basta para responder «quien fue el
    ultimo en entrar», que es lo que se pedia.
    """
    from datetime import datetime, timedelta, timezone

    desde = datetime.now(timezone.utc) - timedelta(minutes=MINUTOS_ENTRE_ENTRADAS)
    reciente = (db.query(models.ProcessAudit)
                  .filter(models.ProcessAudit.process_id == process_id,
                          models.ProcessAudit.user_id == user_id,
                          models.ProcessAudit.action == "abrir",
                          models.ProcessAudit.created_at >= desde)
                  .first())
    if reciente:
        return
    registrar_actividad(db, process_id, user_id, "abrir", "proceso", None, "Abrió el flujo", request)


def historial_del_proceso(db: Session, process_id: int, limite: int = 60):
    return (db.query(models.ProcessAudit)
              .filter(models.ProcessAudit.process_id == process_id)
              .order_by(models.ProcessAudit.created_at.desc(), models.ProcessAudit.id.desc())
              .limit(limite).all())


def get_process_by_code(db: Session, code: str):
    """El codigo es unico en toda la tabla: sirve para avisar antes de chocar."""
    return db.query(models.Process).filter(models.Process.code == code).first()

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
        
    # Se vuelcan todos los campos del esquema en vez de enumerarlos: enumerar es
    # justo lo que hizo que suppliers, customers, monthly_volume y layout_json se
    # perdieran en silencio al crear un proceso con el SIPOC ya relleno.
    db_process = models.Process(
        owner_id=owner_id,
        **process.model_dump(exclude_unset=False),
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

def _nuevo_bpmn_id(prefijo: str) -> str:
    """Identificador BPMN nuevo. Son unicos en toda la tabla, no por proceso."""
    return f"{prefijo}_{uuid.uuid4().hex[:12]}"


def duplicate_process(db: Session, src: models.Process, macroprocess_id: int,
                      code: str, name: str, owner_id: int) -> models.Process:
    """Copia un proceso completo a la carpeta indicada.

    Sirve para reutilizar el esquema de un flujo en otro macroproceso sin
    rehacerlo a mano. Se copia todo lo que define el flujo: pasos, compuertas,
    conexiones (con sus probabilidades y puntos de union), RACI, sistemas y la
    disposicion del diagrama.

    Los `bpmn_id` son unicos en toda la tabla, asi que hay que generarlos de
    nuevo y reescribir con ellos las referencias de las conexiones y las claves
    de `layout_json`. Copiarlos tal cual reventaria la restriccion de unicidad,
    y reescribir a medias dejaria un diagrama desconectado.

    NO se copian las mediciones de tiempo ni los comentarios: pertenecen a la
    ejecucion concreta de aquel proceso, no a su esquema, y arrastrarlos daria
    por medido algo que todavia no se ha ejecutado. Tampoco las versiones
    guardadas: la copia empieza su propio historial.
    """
    copia = models.Process(
        owner_id=owner_id,
        macroprocess_id=macroprocess_id,
        code=code,
        name=name,
        objective=src.objective,
        suppliers=src.suppliers,
        trigger_event=src.trigger_event,
        output_result=src.output_result,
        customers=src.customers,
        monthly_volume=src.monthly_volume,
    )
    db.add(copia)
    db.flush()

    # bpmn_id viejo -> nuevo, para reescribir las conexiones despues.
    ref_nueva: dict[str, str] = {}
    # id numerico de tarea viejo -> nuevo, para las claves del layout.
    tarea_nueva: dict[int, int] = {}

    for actividad in sorted(src.activities, key=lambda a: a.position_order):
        act_copia = models.Activity(
            process_id=copia.id, name=actividad.name, position_order=actividad.position_order,
        )
        db.add(act_copia)
        db.flush()

        for tarea in sorted(actividad.tasks, key=lambda t: t.position_order):
            bpmn_nuevo = _nuevo_bpmn_id("Task")
            ref_nueva[tarea.bpmn_id] = bpmn_nuevo
            t_copia = models.Task(
                activity_id=act_copia.id,
                bpmn_id=bpmn_nuevo,
                name=tarea.name,
                description=tarea.description,
                position_order=tarea.position_order,
                task_type=tarea.task_type,
                value_classification=tarea.value_classification,
                waste_type=tarea.waste_type,
                std_cycle_time_sec=tarea.std_cycle_time_sec,
                std_wait_time_sec=tarea.std_wait_time_sec,
            )
            db.add(t_copia)
            db.flush()
            tarea_nueva[tarea.id] = t_copia.id

            for r in tarea.raci:
                db.add(models.TaskRaci(task_id=t_copia.id, role_id=r.role_id, raci_type=r.raci_type))
            for sis in tarea.systems:
                db.add(models.TaskSystem(task_id=t_copia.id, system_id=sis.system_id,
                                         interaction_type=sis.interaction_type))

    for nodo in src.flow_nodes:
        bpmn_nuevo = _nuevo_bpmn_id("Node")
        ref_nueva[nodo.bpmn_id] = bpmn_nuevo
        db.add(models.FlowNode(process_id=copia.id, bpmn_id=bpmn_nuevo,
                               node_type=nodo.node_type, name=nodo.name))

    for flujo in src.sequence_flows:
        # Los extremos que no son un nodo copiado (los eventos "start"/"end",
        # que viven solo como texto) se dejan tal cual.
        db.add(models.SequenceFlow(
            process_id=copia.id,
            bpmn_id=_nuevo_bpmn_id("Flow"),
            source_ref=ref_nueva.get(flujo.source_ref, flujo.source_ref),
            target_ref=ref_nueva.get(flujo.target_ref, flujo.target_ref),
            name=flujo.name,
            condition_expression=flujo.condition_expression,
            branch_probability=flujo.branch_probability,
            source_handle=flujo.source_handle,
            target_handle=flujo.target_handle,
        ))

    copia.layout_json = _layout_copiado(src.layout_json, tarea_nueva, ref_nueva)

    db.commit()
    db.refresh(copia)
    return copia


def _layout_copiado(layout, tarea_nueva: dict, ref_nueva: dict):
    """Reescribe las claves del layout con los identificadores de la copia.

    Las claves son las del lienzo: `task-<id numerico>` y `gw-<bpmn_id>`. Sin
    esta traduccion la copia saldria con todos los nodos amontonados en el
    origen, porque ninguna posicion guardada le corresponderia.
    """
    if not isinstance(layout, dict):
        return None
    copiado = {}
    for clave, pos in layout.items():
        if clave.startswith("task-"):
            viejo = clave[5:]
            nuevo = tarea_nueva.get(int(viejo)) if viejo.isdigit() else None
            if nuevo is not None:
                copiado[f"task-{nuevo}"] = pos
        elif clave.startswith("gw-"):
            nuevo = ref_nueva.get(clave[3:])
            if nuevo is not None:
                copiado[f"gw-{nuevo}"] = pos
        else:
            copiado[clave] = pos
    return copiado or None


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

def get_role(db: Session, role_id: int, user_id: int = None):
    q = db.query(models.Role).filter(models.Role.id == role_id)
    if user_id:
        q = q.filter(models.Role.owner_id == user_id)
    return q.first()

def get_roles(db: Session, skip: int = 0, limit: int = 100, user_id: int = None):
    q = db.query(models.Role)
    if user_id:
        q = q.filter(models.Role.owner_id == user_id)
    return q.offset(skip).limit(limit).all()

def create_role(db: Session, role: schemas.RoleCreate, owner_id: int = None):
    db_role = models.Role(
        name=role.name,
        area=role.area,
        cost_per_hour=role.cost_per_hour,
        owner_id=owner_id
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

def delete_role(db: Session, role_id: int, user_id: int = None):
    db_role = get_role(db, role_id, user_id)
    if db_role:
        db.delete(db_role)
        db.commit()
        return True
    return False

# ==========================================
# 6. CRUD: Systems
# ==========================================

def get_system(db: Session, system_id: int, user_id: int = None):
    q = db.query(models.System).filter(models.System.id == system_id)
    if user_id:
        q = q.filter(models.System.owner_id == user_id)
    return q.first()

def get_systems(db: Session, skip: int = 0, limit: int = 100, user_id: int = None):
    q = db.query(models.System)
    if user_id:
        q = q.filter(models.System.owner_id == user_id)
    return q.offset(skip).limit(limit).all()

def create_system(db: Session, system: schemas.SystemCreate, owner_id: int = None):
    db_system = models.System(
        name=system.name,
        system_type=system.system_type,
        vendor=system.vendor,
        owner_id=owner_id
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

def delete_system(db: Session, system_id: int, user_id: int = None):
    db_system = get_system(db, system_id, user_id)
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

def _dueno_de_la_tarea(db: Session, task_id: int):
    """Usuario dueno del proceso al que pertenece la tarea.

    Los roles y sistemas que se crean solos a partir del texto RACI necesitan
    dueno: sin el quedaban con owner_id NULL y, como las listas filtran por
    dueno, resultaban invisibles hasta para quien los acababa de crear.
    """
    fila = (
        db.query(models.Process.owner_id)
        .join(models.Activity, models.Activity.process_id == models.Process.id)
        .join(models.Task, models.Task.activity_id == models.Activity.id)
        .filter(models.Task.id == task_id)
        .first()
    )
    return fila[0] if fila else None


def _update_task_raci_direct(db: Session, task_id: int, R: str, A: str, C: str, I: str):
    # Que roles quedan sueltos al rehacer los vinculos: se recogen antes de
    # borrarlos para poder limpiarlos despues (ver _purgar_roles_sueltos).
    antes = {tr.role_id for tr in db.query(models.TaskRaci).filter(models.TaskRaci.task_id == task_id).all()}
    dueno = _dueno_de_la_tarea(db, task_id)

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
            role = (db.query(models.Role)
                      .filter(models.Role.name == name_clean,
                              models.Role.owner_id == dueno)
                      .first())
            if not role:
                role = models.Role(name=name_clean, owner_id=dueno)
                db.add(role)
                db.flush()
            db.add(models.TaskRaci(task_id=task_id, role_id=role.id, raci_type=rtype))

    db.flush()
    _purgar_roles_sueltos(db, antes)


def _purgar_roles_sueltos(db: Session, candidatos):
    """Borra los roles que este cambio dejo sin ninguna tarea.

    El editor guarda solo mientras se escribe, y cada estado intermedio del
    campo RACI creaba un rol: escribir "Sebastian" dejaba "Seba", "Sebas",
    "Sebast"... como filas permanentes. En produccion 199 de 259 roles eran de
    ese tipo. Solo se borran los que nadie usa Y que nunca se enriquecieron
    (sin area ni coste/hora): si alguien les puso datos, se conservan aunque
    queden sueltos, porque ya no son un residuo de tecleo.
    """
    if not candidatos:
        return
    enlazados = {
        rid for (rid,) in db.query(models.TaskRaci.role_id)
        .filter(models.TaskRaci.role_id.in_(candidatos)).distinct().all()
    }
    sueltos = candidatos - enlazados
    if not sueltos:
        return
    (db.query(models.Role)
       .filter(models.Role.id.in_(sueltos),
               models.Role.area.is_(None),
               models.Role.cost_per_hour.is_(None))
       .delete(synchronize_session=False))


def _update_task_systems_direct(db: Session, task_id: int, systems_str: str):
    dueno = _dueno_de_la_tarea(db, task_id)
    # Delete existing
    db.query(models.TaskSystem).filter(models.TaskSystem.task_id == task_id).delete()
    
    if systems_str and systems_str.strip():
        # Split by comma
        sys_names = [s.strip() for s in systems_str.split(',') if s.strip()]
        for sys_name in sys_names:
            # Find or create system
            system = (db.query(models.System)
                        .filter(models.System.name == sys_name,
                                models.System.owner_id == dueno)
                        .first())
            if not system:
                system = models.System(name=sys_name, owner_id=dueno)
                db.add(system)
                db.flush()
            db_ts = models.TaskSystem(task_id=task_id, system_id=system.id)
            db.add(db_ts)

# ==========================================
# 8. Graph (Nodes & Edges) sync for Phase 3
# ==========================================

def repair_stored_flows(db: Session, process_id: int, gateways, sequence_flows) -> bool:
    """Sanea en el sitio las conexiones ya guardadas mal.

    Los procesos creados antes de la validacion arrastran dos defectos: flechas
    que apuntan a la tarea por su id numerico (invisibles para todo lo que
    indexa por bpmn_id, de ahi el "sin entrada" permanente) y etiquetas de
    decision colgando de una tarea. Se corrigen al leer el grafo para que el
    usuario no tenga que rehacer el flujo. Devuelve True si cambio algo.
    """
    tasks = (
        db.query(models.Task)
        .join(models.Activity)
        .filter(models.Activity.process_id == process_id)
        .all()
    )
    ref_by_numeric_id = {str(t.id): t.bpmn_id for t in tasks}
    gateway_refs = {gw.bpmn_id for gw in gateways}
    changed = False

    for sf in sequence_flows:
        canonical_source = ref_by_numeric_id.get(sf.source_ref, sf.source_ref)
        canonical_target = ref_by_numeric_id.get(sf.target_ref, sf.target_ref)
        if canonical_source != sf.source_ref:
            sf.source_ref = canonical_source
            changed = True
        if canonical_target != sf.target_ref:
            sf.target_ref = canonical_target
            changed = True
        if sf.source_ref not in gateway_refs and (
            sf.condition_expression or sf.branch_probability is not None
        ):
            sf.condition_expression = None
            sf.branch_probability = None
            changed = True

    if changed:
        db.commit()
    return changed


def get_graph(db: Session, process_id: int) -> schemas.GraphResponse:
    gateways = db.query(models.FlowNode).filter(
        models.FlowNode.process_id == process_id,
        models.FlowNode.node_type.in_([models.BpmnNodeType.exclusiveGateway, models.BpmnNodeType.parallelGateway, models.BpmnNodeType.inclusiveGateway])
    ).all()
    
    sequence_flows = db.query(models.SequenceFlow).filter(
        models.SequenceFlow.process_id == process_id
    ).all()
    
    repair_stored_flows(db, process_id, gateways, sequence_flows)

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

# Tipos de nodo que pueden originar una decision. Solo desde ellos tiene sentido
# una rama etiquetada (Si/No) con probabilidad.
_GATEWAY_TYPES = {
    models.BpmnNodeType.exclusiveGateway,
    models.BpmnNodeType.parallelGateway,
    models.BpmnNodeType.inclusiveGateway,
}


def normalize_sequence_flows(db: Session, process_id: int, gateways, flows):
    """Normaliza y valida las conexiones antes de persistirlas.

    Tres problemas reales que se colaban hasta la base de datos:

    1. Referencias mezcladas. El canvas construye los nodos como `task-<id>` y
       al soltar una conexion guardaba el id numerico ("42"), mientras el resto
       del sistema (barra lateral, aviso de problemas de flujo y la IA) indexa
       por `bpmn_id` ("Task_qy02"). La flecha se dibujaba pero nadie la
       reconocia: la tarea quedaba marcada "sin entrada" para siempre.
    2. Auto-conexiones. Una compuerta podia conectarse a si misma y aparecia
       como una tercera rama de salida invalida, imposible de borrar sin
       eliminar la compuerta entera.
    3. Ramas de decision naciendo de una tarea. Solo una compuerta decide, asi
       que la etiqueta y la probabilidad se descartan en cualquier otro origen.

    Devuelve (flujos_validos, descartes) donde descartes es una lista de textos
    explicando que se elimino, para poder avisar al cliente.
    """
    tasks = (
        db.query(models.Task)
        .join(models.Activity)
        .filter(models.Activity.process_id == process_id)
        .all()
    )
    ref_by_numeric_id = {str(t.id): t.bpmn_id for t in tasks}
    gateway_refs = {gw.bpmn_id for gw in gateways}

    def canonical(ref):
        ref = (ref or "").strip()
        return ref_by_numeric_id.get(ref, ref)

    result, discarded, seen = [], [], set()
    for sf in flows:
        sf.source_ref = canonical(sf.source_ref)
        sf.target_ref = canonical(sf.target_ref)

        if not sf.source_ref or not sf.target_ref:
            discarded.append("Se descarto una conexion sin origen o sin destino.")
            continue
        if sf.source_ref == sf.target_ref:
            discarded.append(
                f"'{sf.source_ref}' no puede conectarse consigo mismo: se descarto esa rama."
            )
            continue

        pair = (sf.source_ref, sf.target_ref)
        if pair in seen:
            discarded.append(
                f"Ya existia una conexion de '{sf.source_ref}' a '{sf.target_ref}': se descarto la duplicada."
            )
            continue
        seen.add(pair)

        if sf.source_ref not in gateway_refs and (
            sf.condition_expression or sf.branch_probability is not None
        ):
            discarded.append(
                f"'{sf.source_ref}' no es una compuerta: se quito la etiqueta de decision de su salida."
            )
            sf.condition_expression = None
            sf.branch_probability = None

        result.append(sf)

    return result, discarded


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
    # Las compuertas entrantes ya se registraron arriba pero aun no estan en la
    # sesion consultable, por eso se normaliza contra graph_data.gateways.
    incoming_flows, discarded = normalize_sequence_flows(
        db, process_id, graph_data.gateways, graph_data.sequence_flows
    )
    existing_flows = db.query(models.SequenceFlow).filter(models.SequenceFlow.process_id == process_id).all()
    existing_sf_map = {sf.bpmn_id: sf for sf in existing_flows}
    incoming_sf_ids = set()
    
    for sf in incoming_flows:
        incoming_sf_ids.add(sf.bpmn_id)
        if sf.bpmn_id in existing_sf_map:
            existing_sf_map[sf.bpmn_id].source_ref = sf.source_ref
            existing_sf_map[sf.bpmn_id].target_ref = sf.target_ref
            existing_sf_map[sf.bpmn_id].name = sf.name
            existing_sf_map[sf.bpmn_id].condition_expression = sf.condition_expression
            existing_sf_map[sf.bpmn_id].branch_probability = sf.branch_probability
            existing_sf_map[sf.bpmn_id].source_handle = sf.source_handle
            existing_sf_map[sf.bpmn_id].target_handle = sf.target_handle
        else:
            db_sf = models.SequenceFlow(
                process_id=process_id,
                bpmn_id=sf.bpmn_id,
                source_ref=sf.source_ref,
                target_ref=sf.target_ref,
                name=sf.name,
                condition_expression=sf.condition_expression,
                branch_probability=sf.branch_probability,
                source_handle=sf.source_handle,
                target_handle=sf.target_handle
            )
            db.add(db_sf)
            
    # Delete removed sequence flows
    for bpmn_id, sf in existing_sf_map.items():
        if bpmn_id not in incoming_sf_ids:
            db.delete(sf)

    db.commit()
    response = get_graph(db, process_id)
    response.discarded = discarded
    return response


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
