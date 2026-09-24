"""Restauración del flujo, respaldo y auditoría en una sola transacción."""
from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator
from typing import Literal
from sqlalchemy.orm import Session

from app import crud, models, schemas


class Position(BaseModel):
    x: float = Field(allow_inf_nan=False)
    y: float = Field(allow_inf_nan=False)


class RestoreInput(BaseModel):
    reason: Literal["restaurar", "optimizar"] = "restaurar"
    tasks: list[schemas.TaskCreateDirect]
    gateways: list[schemas.FlowNodeSync]
    sequence_flows: list[schemas.SequenceFlowSync]
    layout: dict[str, Position] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_graph(self):
        nodes = [task.bpmn_id for task in self.tasks] + [gw.bpmn_id for gw in self.gateways]
        flows = [flow.bpmn_id for flow in self.sequence_flows]
        if len(set(nodes)) != len(nodes) or len(set(flows)) != len(flows):
            raise ValueError("El respaldo contiene identificadores BPMN duplicados.")
        gateways = {gw.bpmn_id for gw in self.gateways}
        if any(gw.node_type not in crud._GATEWAY_TYPES for gw in self.gateways):
            raise ValueError("El respaldo contiene una compuerta inválida.")
        allowed = set(nodes) | {"start", "end"}
        pairs = set()
        for flow in self.sequence_flows:
            if flow.source_ref not in allowed or flow.target_ref not in allowed:
                raise ValueError("Una conexión del respaldo apunta a un nodo inexistente.")
            pair = (flow.source_ref, flow.target_ref)
            if flow.source_ref == flow.target_ref or pair in pairs:
                raise ValueError("El respaldo contiene conexiones duplicadas o hacia el mismo nodo.")
            if flow.source_ref not in gateways and (flow.condition_expression or flow.branch_probability is not None):
                raise ValueError("Solo una compuerta puede tener ramas de decisión.")
            pairs.add(pair)
        return self


class RestoreOutput(BaseModel):
    tasks: list[schemas.TaskResponse]
    graph: schemas.GraphResponse
    layout_json: dict[str, Position]


def restore_process(db: Session, process_id: int, data: RestoreInput, user, request=None):
    try:
        process = db.query(models.Process).filter_by(id=process_id).with_for_update().first()
        if process is None:
            raise HTTPException(status_code=404, detail="Process not found")
        if user.role != models.UserRole.admin and process.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this process")

        existing = (db.query(models.Task).join(models.Activity)
                    .filter(models.Activity.process_id == process_id)
                    .order_by(models.Task.position_order).all())
        gateways = db.query(models.FlowNode).filter(
            models.FlowNode.process_id == process_id,
            models.FlowNode.node_type.in_(crud._GATEWAY_TYPES),
        ).all()
        flows = db.query(models.SequenceFlow).filter_by(process_id=process_id).all()
        old_ids = {f"task-{task.id}": f"task:{task.bpmn_id}" for task in existing}
        backup = {
            "label": "Antes de aplicar flujo optimizado IA" if data.reason == "optimizar" else "Antes de restaurar versión",
            "tasks": [schemas.TaskResponse.model_validate(task).model_dump(mode="json") for task in existing],
            "gateways": [schemas.FlowNodeResponse.model_validate(gw).model_dump(mode="json") for gw in gateways],
            "sequence_flows": [schemas.SequenceFlowResponse.model_validate(flow).model_dump(mode="json") for flow in flows],
            "layout": {old_ids.get(key, key): value for key, value in (process.layout_json or {}).items()},
        }
        db.add(models.ProcessSnapshot(process_id=process_id, snapshot_json=backup))

        activity = db.query(models.Activity).filter_by(process_id=process_id, name="General").first()
        if activity is None:
            activity = models.Activity(process_id=process_id, name="General", position_order=1)
            db.add(activity)
            db.flush()

        incoming = {task.bpmn_id for task in data.tasks}
        by_bpmn = {task.bpmn_id: task for task in existing}
        for task in existing:
            if task.bpmn_id not in incoming:
                db.delete(task)
        db.flush()

        restored = []
        for task_data in data.tasks:
            task = by_bpmn.get(task_data.bpmn_id)
            if task is None:
                task = crud.create_task_direct(db, activity.id, task_data, commit=False)
            else:
                task.activity_id = activity.id
                crud.update_task_direct(db, task, schemas.TaskUpdateDirect(**task_data.model_dump()), commit=False)
                # Las relaciones cargadas para el respaldo deben releerse tras el reemplazo.
                db.expire(task, ["raci", "systems"])
            restored.append(task)

        graph = crud.sync_graph(db, process_id, schemas.GraphSync(
            gateways=data.gateways, sequence_flows=data.sequence_flows,
        ), commit=False)
        if graph.discarded:
            raise HTTPException(status_code=422, detail="El respaldo contiene conexiones inválidas.")
        new_ids = {f"task:{task.bpmn_id}": f"task-{task.id}" for task in restored}
        process.layout_json = {
            new_ids.get(key, key): pos.model_dump()
            for key, pos in data.layout.items()
            if not key.startswith("task:") or key in new_ids
        }
        db.add(models.ProcessAudit(
            process_id=process_id, user_id=user.id, action=data.reason, target_type="proceso",
            summary="Aplicó un flujo optimizado por IA" if data.reason == "optimizar" else "Restauró una versión del proceso",
            ip_address=crud.direccion_del_cliente(request),
        ))
        db.flush()
        # Validar la respuesta antes del único commit evita confirmar un resultado inválido.
        result = RestoreOutput(tasks=restored, graph=graph, layout_json=process.layout_json)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
