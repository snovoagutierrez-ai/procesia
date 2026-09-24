"""El orden del editor se confirma completo o se rechaza completo."""
from tests.conftest import make_task, register_and_login


def test_reorder_is_atomic_and_keeps_task_fields(auth_client, process):
    pid = process["id"]
    first = make_task(auth_client, pid, "T1", "Primera", position_order=1, responsible="Dueño")
    second = make_task(auth_client, pid, "T2", "Segunda", position_order=2)
    url = f"/processes/{pid}/tasks/order"
    changed = auth_client.put(url, json={"task_ids": [second["id"], first["id"]]})
    assert changed.status_code == 200, changed.text
    tasks = auth_client.get(f"/processes/{pid}/tasks").json()
    assert [(task["id"], task["position_order"]) for task in tasks] == [
        (second["id"], 1), (first["id"], 2)]
    assert tasks[1]["responsible"] == "Dueño"
    assert auth_client.put(url, json={"task_ids": [first["id"]]}).status_code == 422
    assert auth_client.put(url, json={"task_ids": [first["id"], first["id"]]}).status_code == 422
    assert auth_client.put(url, json={"task_ids": [second["id"], 99999]}).status_code == 422
    assert [task["id"] for task in auth_client.get(f"/processes/{pid}/tasks").json()] == [second["id"], first["id"]]


def test_other_user_cannot_reorder(client, process):
    task = make_task(client, process["id"], "T1", "Primera")
    register_and_login(client, email="second@example.com")
    assert client.put(f"/processes/{process['id']}/tasks/order", json={"task_ids": [task["id"]]}).status_code == 403
