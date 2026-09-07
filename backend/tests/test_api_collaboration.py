"""Comentarios, versiones, mediciones y las tablas puente RACI / sistemas."""
import pytest

from tests.conftest import make_task


# --------------------------------------------------------------------------
# Comentarios por nodo
# --------------------------------------------------------------------------

def test_crear_y_listar_comentarios_de_un_nodo(auth_client, process):
    res = auth_client.post(f"/processes/{process['id']}/comments",
                           json={"node_bpmn_id": "T1", "text": "Revisar con Legal"})
    assert res.status_code == 201, res.text
    assert res.json()["is_mine"] is True

    listado = auth_client.get(f"/processes/{process['id']}/comments?node=T1").json()
    assert [c["text"] for c in listado] == ["Revisar con Legal"]


def test_el_filtro_por_nodo_no_mezcla_comentarios(auth_client, process):
    auth_client.post(f"/processes/{process['id']}/comments", json={"node_bpmn_id": "T1", "text": "De T1"})
    auth_client.post(f"/processes/{process['id']}/comments", json={"node_bpmn_id": "T2", "text": "De T2"})
    assert len(auth_client.get(f"/processes/{process['id']}/comments?node=T1").json()) == 1
    assert len(auth_client.get(f"/processes/{process['id']}/comments").json()) == 2


def test_el_autor_puede_editar_su_comentario(auth_client, process):
    c = auth_client.post(f"/processes/{process['id']}/comments",
                         json={"node_bpmn_id": "T1", "text": "Borrador"}).json()
    res = auth_client.put(f"/processes/{process['id']}/comments/{c['id']}",
                          json={"text": "Texto corregido"})
    assert res.status_code == 200, res.text
    assert res.json()["text"] == "Texto corregido"


def test_un_comentario_vacio_se_rechaza(auth_client, process):
    c = auth_client.post(f"/processes/{process['id']}/comments",
                         json={"node_bpmn_id": "T1", "text": "Algo"}).json()
    assert auth_client.put(f"/processes/{process['id']}/comments/{c['id']}",
                           json={"text": ""}).status_code == 422
    assert auth_client.post(f"/processes/{process['id']}/comments",
                            json={"node_bpmn_id": "T1", "text": ""}).status_code == 422


def test_el_autor_puede_borrar_su_comentario(auth_client, process):
    c = auth_client.post(f"/processes/{process['id']}/comments",
                         json={"node_bpmn_id": "T1", "text": "Se va"}).json()
    assert auth_client.delete(f"/processes/{process['id']}/comments/{c['id']}").status_code == 204
    assert auth_client.get(f"/processes/{process['id']}/comments").json() == []


def test_editar_un_comentario_inexistente_da_404(auth_client, process):
    assert auth_client.put(f"/processes/{process['id']}/comments/999999",
                           json={"text": "x"}).status_code == 404


# --------------------------------------------------------------------------
# Versiones (snapshots)
# --------------------------------------------------------------------------

def test_guardar_version_y_recuperarla(auth_client, process):
    snap = {"label": "Antes de tocar nada", "tasks": [{"bpmnId": "T1"}], "gateways": [], "sequence_flows": []}
    res = auth_client.post(f"/processes/{process['id']}/snapshots", json={"snapshot_json": snap})
    assert res.status_code == 201, res.text

    versiones = auth_client.get(f"/processes/{process['id']}/snapshots").json()
    assert len(versiones) == 1
    assert versiones[0]["snapshot_json"]["label"] == "Antes de tocar nada"


def test_las_versiones_llegan_de_la_mas_nueva_a_la_mas_vieja(auth_client, process):
    for etiqueta in ("primera", "segunda", "tercera"):
        auth_client.post(f"/processes/{process['id']}/snapshots",
                         json={"snapshot_json": {"label": etiqueta}})
    etiquetas = [v["snapshot_json"]["label"] for v in
                 auth_client.get(f"/processes/{process['id']}/snapshots").json()]
    assert etiquetas[0] == "tercera"


def test_las_versiones_de_otro_usuario_no_son_accesibles(client, process):
    client.post("/auth/logout")
    client.post("/auth/register", json={"email": "otro@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "otro@example.com", "password": "ClaveDePrueba123"})
    assert client.get(f"/processes/{process['id']}/snapshots").status_code in (403, 404)


# --------------------------------------------------------------------------
# Tiempos observados
# --------------------------------------------------------------------------

def test_registrar_una_medicion_y_listarla(auth_client, process):
    t = make_task(auth_client, process["id"], "T1", "Paso")
    res = auth_client.post(
        f"/processes/{process['id']}/tasks/{t['id']}/measurements",
        json={"observed_cycle_sec": 250, "observed_wait_sec": 30, "case_ref": "Lunes"})
    assert res.status_code == 201, res.text

    listado = auth_client.get(f"/processes/{process['id']}/tasks/{t['id']}/measurements").json()
    assert len(listado) == 1
    assert float(listado[0]["observed_cycle_sec"]) == 250


def test_una_medicion_negativa_se_rechaza(auth_client, process):
    t = make_task(auth_client, process["id"], "T1", "Paso")
    res = auth_client.post(
        f"/processes/{process['id']}/tasks/{t['id']}/measurements",
        json={"observed_cycle_sec": -5})
    assert res.status_code == 422


def test_borrar_una_medicion(auth_client, process):
    t = make_task(auth_client, process["id"], "T1", "Paso")
    m = auth_client.post(
        f"/processes/{process['id']}/tasks/{t['id']}/measurements",
        json={"observed_cycle_sec": 250}).json()
    assert auth_client.delete(
        f"/processes/{process['id']}/tasks/{t['id']}/measurements/{m['id']}").status_code == 204
    assert auth_client.get(
        f"/processes/{process['id']}/tasks/{t['id']}/measurements").json() == []


# --------------------------------------------------------------------------
# RACI y sistemas: no deben poder enlazar recursos de otra cuenta
# --------------------------------------------------------------------------

def test_asignar_un_rol_propio_a_una_tarea(auth_client, process):
    t = make_task(auth_client, process["id"], "T1", "Paso")
    rol = auth_client.post("/roles", json={"name": "Analista"}).json()
    res = auth_client.post("/task-racis", json={
        "task_id": t["id"], "role_id": rol["id"], "raci_type": "R"})
    assert res.status_code == 201, res.text


def test_no_se_puede_enlazar_el_rol_de_otra_cuenta(client, process):
    """Regresion: bastaba con ser dueno de la tarea para enlazar (y leer) el rol
    de otra empresa."""
    from tests.conftest import make_task as mk
    t = mk(client, process["id"], "T1", "Paso")
    client.post("/auth/logout")

    client.post("/auth/register", json={"email": "otro@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "otro@example.com", "password": "ClaveDePrueba123"})
    rol_ajeno = client.post("/roles", json={"name": "Rol de otro", "cost_per_hour": 99999}).json()
    client.post("/auth/logout")

    client.post("/auth/login", data={"username": "qa@example.com", "password": "ClaveDePrueba123"})
    res = client.post("/task-racis", json={
        "task_id": t["id"], "role_id": rol_ajeno["id"], "raci_type": "R"})
    assert res.status_code == 404


def test_no_se_puede_enlazar_el_sistema_de_otra_cuenta(client, process):
    from tests.conftest import make_task as mk
    t = mk(client, process["id"], "T1", "Paso")
    client.post("/auth/logout")

    client.post("/auth/register", json={"email": "otro@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "otro@example.com", "password": "ClaveDePrueba123"})
    sistema_ajeno = client.post("/systems", json={"name": "ERP de otro"}).json()
    client.post("/auth/logout")

    client.post("/auth/login", data={"username": "qa@example.com", "password": "ClaveDePrueba123"})
    res = client.post("/task-systems", json={
        "task_id": t["id"], "system_id": sistema_ajeno["id"], "interaction_type": "read"})
    assert res.status_code == 404


def test_quitar_una_asignacion_raci(auth_client, process):
    t = make_task(auth_client, process["id"], "T1", "Paso")
    rol = auth_client.post("/roles", json={"name": "Analista"}).json()
    auth_client.post("/task-racis", json={"task_id": t["id"], "role_id": rol["id"], "raci_type": "R"})
    res = auth_client.delete(f"/task-racis/{t['id']}/{rol['id']}/R")
    assert res.status_code == 204


# --------------------------------------------------------------------------
# Macroprocesos
# --------------------------------------------------------------------------

def test_el_grafo_del_macroproceso_se_guarda_y_se_lee(auth_client, process):
    mid = process["macroprocess_id"]
    otro = auth_client.post("/processes", json={
        "macroprocess_id": mid, "code": "P-2", "name": "Segundo"}).json()
    res = auth_client.put(f"/macroprocesses/{mid}/graph", json={"sequence_flows": [
        {"source_ref": str(process["id"]), "target_ref": str(otro["id"])}
    ]})
    assert res.status_code == 200, res.text
    assert len(auth_client.get(f"/macroprocesses/{mid}/graph").json()["sequence_flows"]) == 1


def test_borrar_macroproceso_arrastra_sus_procesos(auth_client, process):
    assert auth_client.delete(f"/macroprocesses/{process['macroprocess_id']}").status_code == 204
    assert auth_client.get("/processes").json() == []


@pytest.mark.parametrize("payload", [
    {"code": "", "name": "Sin codigo"},
    {"code": "M", "name": ""},
])
def test_un_macroproceso_sin_datos_obligatorios_se_rechaza(auth_client, payload):
    assert auth_client.post("/macroprocesses", json=payload).status_code == 422


# --------------------------------------------------------------------------
# Roles residuales: el guardado automatico creaba un rol por cada tecleo
# --------------------------------------------------------------------------

def test_escribir_un_nombre_no_deja_roles_a_medias(auth_client, process):
    """Regresion: al escribir "Sebastian" el autoguardado creaba "Seba",
    "Sebas", "Sebast"... y todos quedaban para siempre. En produccion 199 de
    259 roles eran residuos de ese tipo."""
    t = make_task(auth_client, process["id"], "T1", "Paso")

    for parcial in ("Seba", "Sebas", "Sebast", "Sebastian"):
        auth_client.put(f"/processes/{process['id']}/tasks/{t['id']}",
                        json={"responsible": parcial})

    nombres = [r["name"] for r in auth_client.get("/roles").json()]
    assert nombres == ["Sebastian"], f"quedaron roles a medias: {nombres}"


def test_un_rol_con_datos_propios_no_se_borra_aunque_quede_suelto(auth_client, process, db_session):
    """Solo se recogen los residuos de tecleo: si alguien le puso area o
    coste/hora, el rol es intencionado y se conserva aunque quede sin tareas."""
    from app import models

    t = make_task(auth_client, process["id"], "T1", "Paso")
    auth_client.put(f"/processes/{process['id']}/tasks/{t['id']}", json={"responsible": "Analista"})

    # El coste se fija en la base: PUT /roles exige permisos de administrador.
    rol = db_session.query(models.Role).filter(models.Role.name == "Analista").one()
    rol.cost_per_hour = 25000
    db_session.commit()

    # se cambia el responsable: "Analista" queda sin tareas
    auth_client.put(f"/processes/{process['id']}/tasks/{t['id']}", json={"responsible": "Otro"})

    nombres = {r["name"] for r in auth_client.get("/roles").json()}
    assert "Analista" in nombres, "un rol con coste definido no debe borrarse"
    assert "Otro" in nombres


def test_un_rol_que_sigue_en_uso_por_otra_tarea_no_se_borra(auth_client, process):
    t1 = make_task(auth_client, process["id"], "T1", "Uno")
    t2 = make_task(auth_client, process["id"], "T2", "Dos", position_order=2)
    auth_client.put(f"/processes/{process['id']}/tasks/{t1['id']}", json={"responsible": "Ana"})
    auth_client.put(f"/processes/{process['id']}/tasks/{t2['id']}", json={"responsible": "Ana"})

    # t1 cambia de responsable, pero t2 sigue usando "Ana"
    auth_client.put(f"/processes/{process['id']}/tasks/{t1['id']}", json={"responsible": "Luis"})

    nombres = {r["name"] for r in auth_client.get("/roles").json()}
    assert nombres == {"Ana", "Luis"}
