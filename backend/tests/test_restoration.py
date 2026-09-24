import pytest

from app import crud, models
from tests.conftest import make_task, register_and_login


def payload():
    return {
        "tasks": [{"bpmn_id": "restored", "name": "Restaurada", "position_order": 1,
                   "value_classification": "VA", "responsible": "Analista", "systems": "ERP"}],
        "gateways": [{"bpmn_id": "decision", "node_type": "exclusiveGateway", "name": "¿OK?"}],
        "sequence_flows": [
            {"bpmn_id": "f1", "source_ref": "start", "target_ref": "restored"},
            {"bpmn_id": "f2", "source_ref": "restored", "target_ref": "decision"},
            {"bpmn_id": "f3", "source_ref": "decision", "target_ref": "end",
             "condition_expression": "Sí", "branch_probability": 100, "source_handle": "bottom"},
        ],
        "layout": {"task:restored": {"x": 150, "y": 80}, "gw-decision": {"x": 300, "y": 80}},
    }


def test_restore_preserves_complete_flow_and_backup(auth_client, process, db_session):
    pid = process["id"]
    old = make_task(auth_client, pid, "old", "Anterior", responsible="Dueño")
    response = auth_client.post(f"/processes/{pid}/restore", json=payload())
    assert response.status_code == 200, response.text
    result = response.json()
    task = result["tasks"][0]
    assert task["responsible"] == "Analista"
    assert task["systems"] == "ERP"
    assert result["layout_json"][f"task-{task['id']}"] == {"x": 150, "y": 80}
    assert result["graph"]["sequence_flows"][-1]["branch_probability"] == 100
    assert result["graph"]["sequence_flows"][-1]["source_handle"] == "bottom"
    assert auth_client.get(f"/processes/{pid}/tasks").json()[0]["name"] == "Restaurada"
    backup = auth_client.get(f"/processes/{pid}/snapshots").json()[0]["snapshot_json"]
    assert backup["tasks"][0]["bpmn_id"] == old["bpmn_id"]
    assert backup["tasks"][0]["responsible"] == "Dueño"
    assert db_session.query(models.ProcessAudit).filter_by(process_id=pid, action="restaurar").count() == 1
    assert auth_client.delete(f"/processes/{pid}").status_code == 403


def test_failure_after_task_changes_rolls_back_everything(auth_client, process, db_session, monkeypatch):
    pid = process["id"]
    task = make_task(auth_client, pid, "old", "No perder", responsible="Original", systems="Actual")
    from fastapi import HTTPException

    def fail(*args, **kwargs):
        raise HTTPException(status_code=503, detail="Fallo simulado tras modificar tareas")

    monkeypatch.setattr(crud, "sync_graph", fail)
    assert auth_client.post(f"/processes/{pid}/restore", json=payload()).status_code == 503
    tasks = auth_client.get(f"/processes/{pid}/tasks").json()
    assert len(tasks) == 1
    assert tasks[0]["id"] == task["id"]
    assert tasks[0]["name"] == "No perder"
    assert tasks[0]["responsible"] == "Original"
    assert tasks[0]["systems"] == "Actual"
    assert auth_client.get(f"/processes/{pid}/snapshots").json() == []
    assert db_session.query(models.ProcessAudit).filter_by(action="restaurar").count() == 0
    assert db_session.query(models.Role).filter_by(name="Analista").count() == 0


def test_restore_existing_task_retains_measurements(auth_client, process):
    pid = process["id"]
    task = make_task(auth_client, pid, "restored", "Antes", responsible="Original")
    assert auth_client.post(f"/processes/{pid}/tasks/{task['id']}/measurements",
                            json={"observed_cycle_sec": 30}).status_code == 201
    result = auth_client.post(f"/processes/{pid}/restore", json=payload())
    assert result.status_code == 200, result.text
    assert result.json()["tasks"][0]["id"] == task["id"]
    assert result.json()["tasks"][0]["responsible"] == "Analista"
    assert len(auth_client.get(f"/processes/{pid}/tasks/{task['id']}/measurements").json()) == 1


def test_optimized_flow_is_atomic_and_recorded_as_optimization(auth_client, process, db_session, monkeypatch):
    pid = process["id"]
    make_task(auth_client, pid, "old", "Proceso anterior")
    data = payload()
    data["reason"] = "optimizar"
    result = auth_client.post(f"/processes/{pid}/restore", json=data)
    assert result.status_code == 200, result.text
    assert auth_client.get(f"/processes/{pid}/tasks").json()[0]["bpmn_id"] == "restored"
    assert db_session.query(models.ProcessAudit).filter_by(process_id=pid, action="optimizar").count() == 1
    assert "optimizado" in auth_client.get(f"/processes/{pid}/snapshots").json()[0]["snapshot_json"]["label"]

    from app import crud
    from fastapi import HTTPException
    def fail(*args, **kwargs):
        raise HTTPException(status_code=503, detail="Fallo durante optimización")
    monkeypatch.setattr(crud, "sync_graph", fail)
    failed = auth_client.post(f"/processes/{pid}/restore", json={**data, "tasks": [
        {"bpmn_id": "another", "name": "Intermedio", "position_order": 1, "value_classification": "VA"}
    ], "sequence_flows": [], "gateways": []})
    assert failed.status_code == 503
    assert auth_client.get(f"/processes/{pid}/tasks").json()[0]["bpmn_id"] == "restored"
    assert db_session.query(models.ProcessAudit).filter_by(process_id=pid, action="optimizar").count() == 1


def test_failure_after_graph_changes_rolls_back(auth_client, process, monkeypatch):
    from app import restoration
    from fastapi import HTTPException
    pid = process["id"]
    make_task(auth_client, pid, "old", "Original")
    original = {"gateways": [], "sequence_flows": [
        {"bpmn_id": "original-flow", "source_ref": "start", "target_ref": "old"}
    ]}
    assert auth_client.put(f"/processes/{pid}/graph", json=original).status_code == 200

    def fail(**kwargs):
        raise HTTPException(status_code=503, detail="Fallo tras escribir el grafo")

    monkeypatch.setattr(restoration, "RestoreOutput", fail)
    assert auth_client.post(f"/processes/{pid}/restore", json=payload()).status_code == 503
    assert auth_client.get(f"/processes/{pid}/tasks").json()[0]["bpmn_id"] == "old"
    graph = auth_client.get(f"/processes/{pid}/graph").json()
    assert graph["gateways"] == []
    assert [flow["bpmn_id"] for flow in graph["sequence_flows"]] == ["original-flow"]
    assert auth_client.get(f"/processes/{pid}/snapshots").json() == []


@pytest.mark.parametrize("invalid", ["missing_node", "duplicate_id", "negative_time", "missing_tasks"])
def test_invalid_snapshot_does_not_change_process(auth_client, process, invalid):
    pid = process["id"]
    make_task(auth_client, pid, "old", "Anterior")
    data = payload()
    if invalid == "missing_node":
        data["sequence_flows"][0]["target_ref"] = "missing"
    elif invalid == "duplicate_id":
        data["tasks"].append(data["tasks"][0].copy())
    elif invalid == "negative_time":
        data["tasks"][0]["std_cycle_time_sec"] = -1
    else:
        del data["tasks"]
    assert auth_client.post(f"/processes/{pid}/restore", json=data).status_code == 422
    assert auth_client.get(f"/processes/{pid}/tasks").json()[0]["name"] == "Anterior"
    assert auth_client.get(f"/processes/{pid}/snapshots").json() == []


@pytest.mark.parametrize("admin", [False, True])
def test_restore_other_users_process(client, process, db_session, admin):
    register_and_login(client, email="second@example.com")
    if admin:
        user = db_session.query(models.User).filter_by(email="second@example.com").one()
        user.role = models.UserRole.admin
        db_session.commit()
    result = client.post(f"/processes/{process['id']}/restore", json=payload())
    assert result.status_code == (200 if admin else 403), result.text
