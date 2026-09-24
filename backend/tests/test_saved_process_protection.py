"""Una versión guardada protege también contra borrados en cascada."""
import pytest

from app import models
from tests.conftest import register_and_login, make_task


@pytest.mark.parametrize("target", ["processes", "macroprocesses"])
@pytest.mark.parametrize("saved", [False, True])
@pytest.mark.parametrize("admin", [False, True])
def test_delete_saved_process_permissions(auth_client, process, db_session, target, saved, admin):
    process_id = process["id"]
    task = make_task(auth_client, process_id, "protected-task", "Conservar")
    if saved:
        response = auth_client.post(f"/processes/{process_id}/snapshots", json={
            "snapshot_json": {"label": "Versión guardada", "tasks": [task]}
        })
        assert response.status_code == 201
    if admin:
        # Cuenta distinta: el administrador puede gestionar procesos ajenos.
        register_and_login(auth_client, email="admin@example.com")
        user = db_session.query(models.User).filter_by(email="admin@example.com").one()
        user.role = models.UserRole.admin
        db_session.commit()
    target_id = process_id if target == "processes" else process["macroprocess_id"]
    response = auth_client.delete(f"/{target}/{target_id}")
    if saved and not admin:
        assert response.status_code == 403
        assert "administradora" in response.json()["detail"]
        assert auth_client.get(f"/processes/{process_id}").status_code == 200
        assert len(auth_client.get(f"/processes/{process_id}/snapshots").json()) == 1
        assert db_session.query(models.Task).filter_by(id=task["id"]).count() == 1
        assert auth_client.put(f"/processes/{process_id}", json={"name": "Editable"}).status_code == 200
    else:
        assert response.status_code == 204, response.text
        assert db_session.query(models.ProcessSnapshot).filter_by(process_id=process_id).count() == 0
        assert auth_client.get(f"/processes/{process_id}").status_code == 404


@pytest.mark.parametrize("target", ["processes", "macroprocesses"])
def test_other_user_cannot_delete_saved_process(client, process, target):
    assert client.post(f"/processes/{process['id']}/snapshots", json={"snapshot_json": {}}).status_code == 201
    register_and_login(client, email="other@example.com")
    target_id = process["id"] if target == "processes" else process["macroprocess_id"]
    assert client.delete(f"/{target}/{target_id}").status_code == 403


def test_moving_process_preserves_protection(auth_client, process):
    process_id = process["id"]
    assert auth_client.post(f"/processes/{process_id}/snapshots", json={"snapshot_json": {}}).status_code == 201
    destination = auth_client.post("/macroprocesses", json={"code": "DEST", "name": "Destino"}).json()
    assert auth_client.put(f"/processes/{process_id}", json={"macroprocess_id": destination["id"]}).status_code == 200
    assert auth_client.delete(f"/macroprocesses/{process['macroprocess_id']}").status_code == 204
    assert auth_client.delete(f"/macroprocesses/{destination['id']}").status_code == 403
    assert len(auth_client.get(f"/processes/{process_id}/snapshots").json()) == 1
