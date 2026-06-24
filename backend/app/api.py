from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta
import os

from app import crud, schemas, models, gemini, bpmn, mermaid_export, auth
from app.database import get_db
from app.limiter import limiter
from fastapi import Request

router = APIRouter()

def verify_process_access(db: Session, process_id: int, current_user: models.User):
    process = crud.get_process(db, process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if process.owner_id != current_user.id and current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to access this process")
    return process

def verify_macroprocess_access(db: Session, macroprocess_id: int, current_user: models.User):
    macro = crud.get_macroprocess(db, macroprocess_id)
    if not macro:
        raise HTTPException(status_code=404, detail="Macroprocess not found")
    if macro.owner_id != current_user.id and current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to access this macroprocess")
    return macro

# ==========================================
# 0. Auth Endpoints
# ==========================================

@router.post("/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(email=user.email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/auth/login")
@limiter.limit("5/minute")
def login(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    is_production = os.environ.get("ENV", "development").lower() == "production" or os.environ.get("RENDER") == "true"
    
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    return {"message": "Logged in successfully", "role": user.role.value}


@router.post("/auth/logout")
def logout(response: Response):
    is_production = os.environ.get("ENV", "development").lower() == "production" or os.environ.get("RENDER") == "true"
    response.delete_cookie(key="access_token", httponly=True, secure=is_production, samesite="lax")
    return {"message": "Logged out successfully"}

@router.get("/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


# ==========================================
# 1. Macroprocesses Endpoints
# ==========================================

@router.get("/macroprocesses", response_model=List[schemas.MacroprocessResponse])
def read_macroprocesses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    user_id = None if current_user.role == models.UserRole.admin else current_user.id
    return crud.get_macroprocesses(db, skip=skip, limit=limit, user_id=user_id)

@router.get("/macroprocesses/{id}", response_model=schemas.MacroprocessResponse)
def read_macroprocess(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return verify_macroprocess_access(db, id, current_user)

@router.post("/macroprocesses", response_model=schemas.MacroprocessResponse, status_code=status.HTTP_201_CREATED)
def create_macroprocess(macroprocess: schemas.MacroprocessCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.create_macroprocess(db, macroprocess, owner_id=current_user.id)

@router.put("/macroprocesses/{id}", response_model=schemas.MacroprocessResponse)
def update_macroprocess(id: int, macroprocess: schemas.MacroprocessUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_macro = verify_macroprocess_access(db, id, current_user)
    return crud.update_macroprocess(db, db_macro, macroprocess)

@router.delete("/macroprocesses/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_macroprocess(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_macroprocess_access(db, id, current_user)
    crud.delete_macroprocess(db, id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/macroprocesses/{id}/graph", response_model=schemas.MacroGraphSync)
def get_macro_graph(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_macroprocess_access(db, id, current_user)
    return crud.get_macro_graph(db, id)

@router.put("/macroprocesses/{id}/graph", response_model=schemas.MacroGraphSync)
def sync_macro_graph(id: int, graph_data: schemas.MacroGraphSync, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_macroprocess_access(db, id, current_user)
    return crud.sync_macro_graph(db, id, graph_data)

@router.post("/macroprocesses/{id}/optimize")
def optimize_macroprocess(request: Request, id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_macroprocess_access(db, id, current_user)
    try:
        db_run = gemini.run_macro_optimization(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

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
# 2. Processes Endpoints
# ==========================================

@router.get("/processes", response_model=List[schemas.ProcessResponse])
def read_processes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    user_id = None if current_user.role == models.UserRole.admin else current_user.id
    return crud.get_processes(db, skip=skip, limit=limit, user_id=user_id)

@router.get("/processes/{id}", response_model=schemas.ProcessResponse)
def read_process(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return verify_process_access(db, id, current_user)

@router.post("/processes", response_model=schemas.ProcessResponse, status_code=status.HTTP_201_CREATED)
def create_process(process: schemas.ProcessCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # verify user has access to macroprocess
    verify_macroprocess_access(db, process.macroprocess_id, current_user)
    return crud.create_process(db, process, owner_id=current_user.id)

@router.put("/processes/{id}", response_model=schemas.ProcessResponse)
def update_process(id: int, process: schemas.ProcessUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_process = verify_process_access(db, id, current_user)
    if process.macroprocess_id is not None:
        verify_macroprocess_access(db, process.macroprocess_id, current_user)
    return crud.update_process(db, db_process, process)

@router.delete("/processes/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_process(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_process_access(db, id, current_user)
    crud.delete_process(db, id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/processes/{id}/metrics", response_model=schemas.ProcessMetricsResponse)
def get_process_metrics(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_process_access(db, id, current_user)
    from app.metrics import calculate_process_metrics
    try:
        return calculate_process_metrics(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ==========================================
# 3. Activities Endpoints
# ==========================================

@router.get("/activities", response_model=List[schemas.ActivityResponse])
def read_activities(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Hard to filter globally, returning all is not great, but usually they are fetched via process
    if current_user.role == models.UserRole.admin:
        return crud.get_activities(db, skip=skip, limit=limit)
    else:
        # User only gets their activities
        return db.query(models.Activity).join(models.Process).filter(models.Process.owner_id == current_user.id).offset(skip).limit(limit).all()

@router.get("/activities/{id}", response_model=schemas.ActivityResponse)
def read_activity(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_act = crud.get_activity(db, id)
    if not db_act:
        raise HTTPException(status_code=404, detail="Activity not found")
    verify_process_access(db, db_act.process_id, current_user)
    return db_act

@router.post("/activities", response_model=schemas.ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(activity: schemas.ActivityCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_process_access(db, activity.process_id, current_user)
    return crud.create_activity(db, activity)

@router.put("/activities/{id}", response_model=schemas.ActivityResponse)
def update_activity(id: int, activity: schemas.ActivityUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_activity = crud.get_activity(db, id)
    if not db_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    verify_process_access(db, db_activity.process_id, current_user)
    if activity.process_id is not None:
        verify_process_access(db, activity.process_id, current_user)
    return crud.update_activity(db, db_activity, activity)

@router.delete("/activities/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_activity = crud.get_activity(db, id)
    if not db_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    verify_process_access(db, db_activity.process_id, current_user)
    crud.delete_activity(db, id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 4. Tasks Endpoints
# ==========================================

@router.get("/tasks", response_model=List[schemas.TaskResponse])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == models.UserRole.admin:
        return crud.get_tasks(db, skip=skip, limit=limit)
    else:
        return db.query(models.Task).join(models.Activity).join(models.Process).filter(models.Process.owner_id == current_user.id).offset(skip).limit(limit).all()

@router.get("/tasks/{id}", response_model=schemas.TaskResponse)
def read_task(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = crud.get_task(db, id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_process_access(db, db_task.activity.process_id, current_user)
    return db_task

@router.post("/tasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    act = crud.get_activity(db, task.activity_id)
    if not act:
        raise HTTPException(status_code=400, detail="Activity not found")
    verify_process_access(db, act.process_id, current_user)
    return crud.create_task(db, task)

@router.put("/tasks/{id}", response_model=schemas.TaskResponse)
def update_task(id: int, task: schemas.TaskUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = crud.get_task(db, id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_process_access(db, db_task.activity.process_id, current_user)
    if task.activity_id is not None:
        act = crud.get_activity(db, task.activity_id)
        if not act:
            raise HTTPException(status_code=400, detail="Activity not found")
        verify_process_access(db, act.process_id, current_user)
    return crud.update_task(db, db_task, task)

@router.delete("/tasks/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = crud.get_task(db, id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_process_access(db, db_task.activity.process_id, current_user)
    crud.delete_task(db, id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 5. Roles & Systems Endpoints (Global Catalogs)
# ==========================================
# The prompt specified: "Roles y Systems quedan compartidos entre todos los usuarios"
# We will protect them with authentication, but no owner_id check.

@router.get("/roles", response_model=List[schemas.RoleResponse])
def read_roles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_roles(db, skip=skip, limit=limit)

@router.get("/roles/{id}", response_model=schemas.RoleResponse)
def read_role(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_role = crud.get_role(db, id)
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    return db_role

@router.post("/roles", response_model=schemas.RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.create_role(db, role)

@router.put("/roles/{id}", response_model=schemas.RoleResponse)
def update_role(id: int, role: schemas.RoleUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_role = crud.get_role(db, id)
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    return crud.update_role(db, db_role, role)

@router.delete("/roles/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not crud.delete_role(db, id):
        raise HTTPException(status_code=404, detail="Role not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/systems", response_model=List[schemas.SystemResponse])
def read_systems(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_systems(db, skip=skip, limit=limit)

@router.get("/systems/{id}", response_model=schemas.SystemResponse)
def read_system(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_system = crud.get_system(db, id)
    if not db_system:
        raise HTTPException(status_code=404, detail="System not found")
    return db_system

@router.post("/systems", response_model=schemas.SystemResponse, status_code=status.HTTP_201_CREATED)
def create_system(system: schemas.SystemCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.create_system(db, system)

@router.put("/systems/{id}", response_model=schemas.SystemResponse)
def update_system(id: int, system: schemas.SystemUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_system = crud.get_system(db, id)
    if not db_system:
        raise HTTPException(status_code=404, detail="System not found")
    return crud.update_system(db, db_system, system)

@router.delete("/systems/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_system(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not crud.delete_system(db, id):
        raise HTTPException(status_code=404, detail="System not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ==========================================
# 7. Task RACI & Systems (Junction tables)
# ==========================================
# They require modifying a task, so we check process ownership.

@router.get("/task-racis", response_model=List[schemas.TaskRaciResponse])
def read_task_racis(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == models.UserRole.admin:
        return crud.get_task_racis(db, skip=skip, limit=limit)
    else:
        return db.query(models.TaskRaci).join(models.Task).join(models.Activity).join(models.Process).filter(
            models.Process.owner_id == current_user.id
        ).offset(skip).limit(limit).all()

@router.post("/task-racis", response_model=schemas.TaskRaciResponse, status_code=status.HTTP_201_CREATED)
def create_task_raci(task_raci: schemas.TaskRaciCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    t = crud.get_task(db, task_raci.task_id)
    if not t: raise HTTPException(status_code=404, detail="Task not found")
    verify_process_access(db, t.activity.process_id, current_user)
    return crud.create_task_raci(db, task_raci)

@router.delete("/task-racis/{task_id}/{role_id}/{raci_type}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_raci(task_id: int, role_id: int, raci_type: models.RaciType, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    t = crud.get_task(db, task_id)
    if not t: raise HTTPException(status_code=404, detail="Task not found")
    verify_process_access(db, t.activity.process_id, current_user)
    if not crud.delete_task_raci(db, task_id, role_id, raci_type):
        raise HTTPException(status_code=404, detail="Task RACI record not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/task-systems", response_model=List[schemas.TaskSystemResponse])
def read_task_systems(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == models.UserRole.admin:
        return crud.get_task_systems(db, skip=skip, limit=limit)
    else:
        return db.query(models.TaskSystem).join(models.Task).join(models.Activity).join(models.Process).filter(
            models.Process.owner_id == current_user.id
        ).offset(skip).limit(limit).all()

@router.post("/task-systems", response_model=schemas.TaskSystemResponse, status_code=status.HTTP_201_CREATED)
def create_task_system(task_system: schemas.TaskSystemCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    t = crud.get_task(db, task_system.task_id)
    if not t: raise HTTPException(status_code=404, detail="Task not found")
    verify_process_access(db, t.activity.process_id, current_user)
    return crud.create_task_system(db, task_system)

@router.delete("/task-systems/{task_id}/{system_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_system(task_id: int, system_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    t = crud.get_task(db, task_id)
    if not t: raise HTTPException(status_code=404, detail="Task not found")
    verify_process_access(db, t.activity.process_id, current_user)
    if not crud.delete_task_system(db, task_id, system_id):
        raise HTTPException(status_code=404, detail="Task System record not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 9. IA Process Optimization Endpoint
# ==========================================

@router.post("/processes/{id}/optimize")
@limiter.limit("2/minute")
def optimize_process(request: Request, id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_process_access(db, id, current_user)
    try:
        db_run = gemini.run_optimization(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    # Note: Exceptions are caught globally by our middleware in main.py to prevent leak

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
def get_process_bpmn(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_process_access(db, id, current_user)
    try:
        xml_bytes = bpmn.generate_and_save_bpmn(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return Response(content=xml_bytes, media_type="application/bpmn+xml")

@router.get("/processes/{id}/mermaid")
def get_process_mermaid(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_process_access(db, id, current_user)
    try:
        mermaid_text = mermaid_export.generate_mermaid(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return Response(content=mermaid_text, media_type="text/plain")

# ==========================================
# 11. Process Tasks Direct Endpoints (Transparent Activity mapping)
# ==========================================

@router.get("/processes/{process_id}/tasks", response_model=List[schemas.TaskResponse])
def read_process_tasks(process_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_process_access(db, process_id, current_user)
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
def create_process_task(process_id: int, task: schemas.TaskCreateDirect, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_process_access(db, process_id, current_user)
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
def update_process_task(process_id: int, task_id: int, task: schemas.TaskUpdateDirect, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_process_access(db, process_id, current_user)
    db_task = crud.get_task(db, task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    if db_task.activity.process_id != process_id:
        raise HTTPException(status_code=400, detail="Task does not belong to this process")

    return crud.update_task_direct(db, db_task, task)

@router.delete("/processes/{process_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_process_task(process_id: int, task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    verify_process_access(db, process_id, current_user)
    db_task = crud.get_task(db, task_id)
    if not db_task or db_task.activity.process_id != process_id:
        raise HTTPException(status_code=404, detail="Task not found")
        
    crud.delete_task(db, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==========================================
# 8. Graph (Nodes & Edges) Endpoints
# ==========================================

@router.get("/processes/{id}/graph", response_model=schemas.GraphResponse)
def read_graph(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Check ownership
    process = db.query(models.Process).filter(models.Process.id == id).first()
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if current_user.role != models.UserRole.admin and process.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this process")
        
    return crud.get_graph(db=db, process_id=id)

@router.put("/processes/{id}/graph", response_model=schemas.GraphResponse)
def sync_graph(id: int, graph_data: schemas.GraphSync, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Check ownership
    process = db.query(models.Process).filter(models.Process.id == id).first()
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    if current_user.role != models.UserRole.admin and process.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this process")
        
    return crud.sync_graph(db=db, process_id=id, graph_data=graph_data)

