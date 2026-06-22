from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from typing import List

from app import crud, schemas, models, gemini, bpmn, mermaid_export
from app.database import get_db

router = APIRouter()

# ==========================================
# 1. Macroprocesses Endpoints
# ==========================================

@router.get("/macroprocesses", response_model=List[schemas.MacroprocessResponse])
def read_macroprocesses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_macroprocesses(db, skip=skip, limit=limit)

@router.get("/macroprocesses/{id}", response_model=schemas.MacroprocessResponse)
def read_macroprocess(id: int, db: Session = Depends(get_db)):
    db_macro = crud.get_macroprocess(db, id)
    if not db_macro:
        raise HTTPException(status_code=404, detail="Macroprocess not found")
    return db_macro

@router.post("/macroprocesses", response_model=schemas.MacroprocessResponse, status_code=status.HTTP_201_CREATED)
def create_macroprocess(macroprocess: schemas.MacroprocessCreate, db: Session = Depends(get_db)):
    return crud.create_macroprocess(db, macroprocess)

@router.put("/macroprocesses/{id}", response_model=schemas.MacroprocessResponse)
def update_macroprocess(id: int, macroprocess: schemas.MacroprocessUpdate, db: Session = Depends(get_db)):
    db_macro = crud.get_macroprocess(db, id)
    if not db_macro:
        raise HTTPException(status_code=404, detail="Macroprocess not found")
    return crud.update_macroprocess(db, db_macro, macroprocess)

@router.delete("/macroprocesses/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_macroprocess(id: int, db: Session = Depends(get_db)):
    if not crud.delete_macroprocess(db, id):
        raise HTTPException(status_code=404, detail="Macroprocess not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 2. Processes Endpoints
# ==========================================

@router.get("/processes", response_model=List[schemas.ProcessResponse])
def read_processes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_processes(db, skip=skip, limit=limit)

@router.get("/processes/{id}", response_model=schemas.ProcessResponse)
def read_process(id: int, db: Session = Depends(get_db)):
    db_process = crud.get_process(db, id)
    if not db_process:
        raise HTTPException(status_code=404, detail="Process not found")
    return db_process

@router.post("/processes", response_model=schemas.ProcessResponse, status_code=status.HTTP_201_CREATED)
def create_process(process: schemas.ProcessCreate, db: Session = Depends(get_db)):
    return crud.create_process(db, process)

@router.put("/processes/{id}", response_model=schemas.ProcessResponse)
def update_process(id: int, process: schemas.ProcessUpdate, db: Session = Depends(get_db)):
    db_process = crud.get_process(db, id)
    if not db_process:
        raise HTTPException(status_code=404, detail="Process not found")
    return crud.update_process(db, db_process, process)

@router.delete("/processes/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_process(id: int, db: Session = Depends(get_db)):
    if not crud.delete_process(db, id):
        raise HTTPException(status_code=404, detail="Process not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/processes/{id}/metrics", response_model=schemas.ProcessMetricsResponse)
def get_process_metrics(id: int, db: Session = Depends(get_db)):
    from app.metrics import calculate_process_metrics
    try:
        return calculate_process_metrics(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ==========================================
# 3. Activities Endpoints
# ==========================================

@router.get("/activities", response_model=List[schemas.ActivityResponse])
def read_activities(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_activities(db, skip=skip, limit=limit)

@router.get("/activities/{id}", response_model=schemas.ActivityResponse)
def read_activity(id: int, db: Session = Depends(get_db)):
    db_activity = crud.get_activity(db, id)
    if not db_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return db_activity

@router.post("/activities", response_model=schemas.ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(activity: schemas.ActivityCreate, db: Session = Depends(get_db)):
    return crud.create_activity(db, activity)

@router.put("/activities/{id}", response_model=schemas.ActivityResponse)
def update_activity(id: int, activity: schemas.ActivityUpdate, db: Session = Depends(get_db)):
    db_activity = crud.get_activity(db, id)
    if not db_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return crud.update_activity(db, db_activity, activity)

@router.delete("/activities/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(id: int, db: Session = Depends(get_db)):
    if not crud.delete_activity(db, id):
        raise HTTPException(status_code=404, detail="Activity not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 4. Tasks Endpoints (Nested RACI & Systems)
# ==========================================

@router.get("/tasks", response_model=List[schemas.TaskResponse])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_tasks(db, skip=skip, limit=limit)

@router.get("/tasks/{id}", response_model=schemas.TaskResponse)
def read_task(id: int, db: Session = Depends(get_db)):
    db_task = crud.get_task(db, id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task

@router.post("/tasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db, task)

@router.put("/tasks/{id}", response_model=schemas.TaskResponse)
def update_task(id: int, task: schemas.TaskUpdate, db: Session = Depends(get_db)):
    db_task = crud.get_task(db, id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    return crud.update_task(db, db_task, task)

@router.delete("/tasks/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(id: int, db: Session = Depends(get_db)):
    if not crud.delete_task(db, id):
        raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 5. Roles Endpoints
# ==========================================

@router.get("/roles", response_model=List[schemas.RoleResponse])
def read_roles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_roles(db, skip=skip, limit=limit)

@router.get("/roles/{id}", response_model=schemas.RoleResponse)
def read_role(id: int, db: Session = Depends(get_db)):
    db_role = crud.get_role(db, id)
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    return db_role

@router.post("/roles", response_model=schemas.RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    return crud.create_role(db, role)

@router.put("/roles/{id}", response_model=schemas.RoleResponse)
def update_role(id: int, role: schemas.RoleUpdate, db: Session = Depends(get_db)):
    db_role = crud.get_role(db, id)
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    return crud.update_role(db, db_role, role)

@router.delete("/roles/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(id: int, db: Session = Depends(get_db)):
    if not crud.delete_role(db, id):
        raise HTTPException(status_code=404, detail="Role not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 6. Systems Endpoints
# ==========================================

@router.get("/systems", response_model=List[schemas.SystemResponse])
def read_systems(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_systems(db, skip=skip, limit=limit)

@router.get("/systems/{id}", response_model=schemas.SystemResponse)
def read_system(id: int, db: Session = Depends(get_db)):
    db_system = crud.get_system(db, id)
    if not db_system:
        raise HTTPException(status_code=404, detail="System not found")
    return db_system

@router.post("/systems", response_model=schemas.SystemResponse, status_code=status.HTTP_201_CREATED)
def create_system(system: schemas.SystemCreate, db: Session = Depends(get_db)):
    return crud.create_system(db, system)

@router.put("/systems/{id}", response_model=schemas.SystemResponse)
def update_system(id: int, system: schemas.SystemUpdate, db: Session = Depends(get_db)):
    db_system = crud.get_system(db, id)
    if not db_system:
        raise HTTPException(status_code=404, detail="System not found")
    return crud.update_system(db, db_system, system)

@router.delete("/systems/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_system(id: int, db: Session = Depends(get_db)):
    if not crud.delete_system(db, id):
        raise HTTPException(status_code=404, detail="System not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 7. Task RACI Endpoints
# ==========================================

@router.get("/task-racis", response_model=List[schemas.TaskRaciResponse])
def read_task_racis(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_task_racis(db, skip=skip, limit=limit)

@router.post("/task-racis", response_model=schemas.TaskRaciResponse, status_code=status.HTTP_201_CREATED)
def create_task_raci(task_raci: schemas.TaskRaciCreate, db: Session = Depends(get_db)):
    return crud.create_task_raci(db, task_raci)

@router.delete("/task-racis/{task_id}/{role_id}/{raci_type}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_raci(task_id: int, role_id: int, raci_type: models.RaciType, db: Session = Depends(get_db)):
    if not crud.delete_task_raci(db, task_id, role_id, raci_type):
        raise HTTPException(status_code=404, detail="Task RACI record not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 8. Task Systems Endpoints
# ==========================================

@router.get("/task-systems", response_model=List[schemas.TaskSystemResponse])
def read_task_systems(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_task_systems(db, skip=skip, limit=limit)

@router.post("/task-systems", response_model=schemas.TaskSystemResponse, status_code=status.HTTP_201_CREATED)
def create_task_system(task_system: schemas.TaskSystemCreate, db: Session = Depends(get_db)):
    return crud.create_task_system(db, task_system)

@router.delete("/task-systems/{task_id}/{system_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_system(task_id: int, system_id: int, db: Session = Depends(get_db)):
    if not crud.delete_task_system(db, task_id, system_id):
        raise HTTPException(status_code=404, detail="Task System record not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 9. IA Process Optimization Endpoint
# ==========================================

@router.post("/processes/{id}/optimize")
def optimize_process(id: int, db: Session = Depends(get_db)):
    try:
        db_run = gemini.run_optimization(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error running optimization: {str(e)}")

    if db_run.status == models.OptStatus.failed:
        raise HTTPException(
            status_code=422, 
            detail={
                "message": "Optimization failed to produce a valid JSON model structure.",
                "error": db_run.result
            }
        )
        
    return db_run.result

# ==========================================
# 10. BPMN Generation Endpoint
# ==========================================

@router.get("/processes/{id}/bpmn")
def get_process_bpmn(id: int, db: Session = Depends(get_db)):
    try:
        xml_bytes = bpmn.generate_and_save_bpmn(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error generating BPMN XML: {str(e)}")

    return Response(content=xml_bytes, media_type="application/bpmn+xml")

# ==========================================
# 10b. Mermaid Flowchart Generation Endpoint
# ==========================================

@router.get("/processes/{id}/mermaid")
def get_process_mermaid(id: int, db: Session = Depends(get_db)):
    try:
        mermaid_text = mermaid_export.generate_mermaid(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error generating Mermaid syntax: {str(e)}")

    return Response(content=mermaid_text, media_type="text/plain")

# ==========================================
# 11. Process Tasks Direct Endpoints (Transparent Activity mapping)
# ==========================================

@router.get("/processes/{process_id}/tasks", response_model=List[schemas.TaskResponse])
def read_process_tasks(process_id: int, db: Session = Depends(get_db)):
    db_process = crud.get_process(db, process_id)
    if not db_process:
        raise HTTPException(status_code=404, detail="Process not found")
        
    default_act = db.query(models.Activity).filter(
        models.Activity.process_id == process_id,
        models.Activity.name == "General"
    ).first()
    if not default_act:
        default_act = models.Activity(process_id=process_id, name="General", position_order=1)
        db.add(default_act)
        db.commit()
        db.refresh(default_act)

    tasks = db.query(models.Task).filter(
        models.Task.activity_id == default_act.id
    ).order_by(models.Task.position_order.asc()).all()
    return tasks

@router.post("/processes/{process_id}/tasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_process_task(process_id: int, task: schemas.TaskCreateDirect, db: Session = Depends(get_db)):
    db_process = crud.get_process(db, process_id)
    if not db_process:
        raise HTTPException(status_code=404, detail="Process not found")
        
    default_act = db.query(models.Activity).filter(
        models.Activity.process_id == process_id,
        models.Activity.name == "General"
    ).first()
    if not default_act:
        default_act = models.Activity(process_id=process_id, name="General", position_order=1)
        db.add(default_act)
        db.flush()

    return crud.create_task_direct(db, default_act.id, task)

@router.put("/processes/{process_id}/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_process_task(process_id: int, task_id: int, task: schemas.TaskUpdateDirect, db: Session = Depends(get_db)):
    db_process = crud.get_process(db, process_id)
    if not db_process:
        raise HTTPException(status_code=404, detail="Process not found")
        
    db_task = crud.get_task(db, task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    return crud.update_task_direct(db, db_task, task)

@router.delete("/processes/{process_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_process_task(process_id: int, task_id: int, db: Session = Depends(get_db)):
    db_process = crud.get_process(db, process_id)
    if not db_process:
        raise HTTPException(status_code=404, detail="Process not found")
        
    if not crud.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
