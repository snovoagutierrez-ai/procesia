"""Observaciones del 10/09: historial de cambios y responsabilidad del flujo.

Se pedia saber quien fue el ultimo en entrar, quien hizo el ultimo cambio y
sobre que objeto (para poder resaltarlo), ademas de quien responde por el flujo
y desde donde se conecta.

La IP es dato personal: se comprueba aqui que solo la ve el dueno del proceso.
"""
from tests.conftest import make_task, register_and_login


def _grafo(client, process_id, gateways, flows):
    return client.put(f"/processes/{process_id}/graph",
                      json={"gateways": gateways, "sequence_flows": flows})


def test_abrir_el_flujo_queda_registrado_con_su_autor(auth_client, process):
    auth_client.get(f"/processes/{process['id']}")
    act = auth_client.get(f"/processes/{process['id']}/activity").json()

    assert act["ultima_entrada"] is not None
    assert act["ultima_entrada"]["action"] == "abrir"
    assert act["ultima_entrada"]["author_email"] == "qa@example.com"
    assert act["ultima_entrada"]["is_mine"] is True


def test_las_visitas_seguidas_no_inundan_el_historial(auth_client, process):
    """El GET se dispara en cada carga de pantalla: si se anotaran todas, los
    cambios reales quedarian sepultados."""
    for _ in range(5):
        auth_client.get(f"/processes/{process['id']}")
    act = auth_client.get(f"/processes/{process['id']}/activity").json()
    assert len([e for e in act["entries"] if e["action"] == "abrir"]) == 1


def test_el_ultimo_cambio_dice_que_paso_y_sobre_que_objeto(auth_client, process):
    t = make_task(auth_client, process["id"], "T1", "Revisar documentos")
    act = auth_client.get(f"/processes/{process['id']}/activity").json()

    cambio = act["ultimo_cambio"]
    assert cambio["action"] == "crear"
    assert cambio["target_type"] == "tarea"
    # El identificador estable del nodo: es lo que permite resaltarlo en el diagrama.
    assert cambio["target_bpmn_id"] == t["bpmn_id"]
    assert "Revisar documentos" in cambio["summary"]


def test_entrar_y_cambiar_se_cuentan_por_separado(auth_client, process):
    auth_client.get(f"/processes/{process['id']}")
    make_task(auth_client, process["id"], "T1", "Uno")
    act = auth_client.get(f"/processes/{process['id']}/activity").json()

    assert act["ultima_entrada"]["action"] == "abrir"
    assert act["ultimo_cambio"]["action"] == "crear"


def test_editar_y_borrar_un_paso_quedan_anotados(auth_client, process):
    t = make_task(auth_client, process["id"], "T1", "Uno")
    auth_client.put(f"/processes/{process['id']}/tasks/{t['id']}", json={"name": "Uno revisado"})
    auth_client.delete(f"/processes/{process['id']}/tasks/{t['id']}")

    entries = auth_client.get(f"/processes/{process['id']}/activity").json()["entries"]
    acciones = [e["action"] for e in entries]
    assert acciones[:3] == ["borrar", "editar", "crear"]   # mas reciente primero
    assert "Uno revisado" in entries[1]["summary"]


def test_reorganizar_el_diagrama_no_se_confunde_con_editar_la_ficha(auth_client, process):
    """Arrastrar nodos guarda layout_json en cada movimiento: si eso apareciera
    como «editó la ficha», el historial no distinguiria lo importante."""
    auth_client.put(f"/processes/{process['id']}", json={"layout_json": {"task-1": {"x": 1, "y": 2}}})
    auth_client.put(f"/processes/{process['id']}", json={"objective": "Otro objetivo"})

    entries = auth_client.get(f"/processes/{process['id']}/activity").json()["entries"]
    assert entries[0]["summary"] == "Editó la ficha del proceso"
    assert entries[1]["summary"] == "Reorganizó el diagrama"


def test_tocar_el_diagrama_queda_anotado(auth_client, process):
    make_task(auth_client, process["id"], "T1", "Uno")
    _grafo(auth_client, process["id"], [], [{"bpmn_id": "F1", "source_ref": "start", "target_ref": "T1"}])

    cambio = auth_client.get(f"/processes/{process['id']}/activity").json()["ultimo_cambio"]
    assert cambio["target_type"] == "conexiones"
    assert "conexión" in cambio["summary"]


def test_el_historial_dice_quien_responde_por_el_flujo(auth_client, process):
    act = auth_client.get(f"/processes/{process['id']}/activity").json()
    assert act["owner_email"] == "qa@example.com"
    assert act["soy_el_dueno"] is True


def test_el_dueno_ve_la_direccion_desde_la_que_se_conecto(auth_client, process):
    auth_client.get(f"/processes/{process['id']}")
    act = auth_client.get(f"/processes/{process['id']}/activity").json()
    assert act["ultima_entrada"]["ip_address"], "el dueño debería ver la IP"


def test_un_administrador_responde_por_el_flujo_ajeno(auth_client, db_session, process):
    from app import models

    auth_client.get(f"/processes/{process['id']}")
    make_task(auth_client, process["id"], "T1", "Uno")

    register_and_login(auth_client, email="mirona@example.com")
    mirona = db_session.query(models.User).filter(models.User.email == "mirona@example.com").one()
    mirona.role = models.UserRole.admin
    db_session.commit()

    act = auth_client.get(f"/processes/{process['id']}/activity").json()
    assert act["soy_el_dueno"] is True
    assert act["owner_email"] == "qa@example.com"
    # Y el historial sigue atribuyendo cada movimiento a quien lo hizo.
    assert all(e["is_mine"] is False for e in act["entries"])


def test_una_persona_ajena_no_puede_leer_el_historial(auth_client, process):
    """Hoy solo hay dos roles, `user` y `admin`, y no existe compartir: quien no
    es dueno ni administrador no llega al historial.

    Por eso la ocultacion de la IP en la API es defensiva: cubre el dia que se
    pueda compartir un flujo. Lo que si se puede comprobar hoy es que ningun
    tercero alcanza el dato.
    """
    auth_client.get(f"/processes/{process['id']}")
    register_and_login(auth_client, email="ajena@example.com")

    res = auth_client.get(f"/processes/{process['id']}/activity")
    assert res.status_code in (403, 404), res.text
