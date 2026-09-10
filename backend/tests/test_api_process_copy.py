"""Observacion del 10/09: mover un flujo de carpeta y copiar su esquema.

Mover ya lo permitia la API (PUT /processes/{id} con macroprocess_id); lo que
faltaba era copiar. Copiar no es trivial aqui porque los `bpmn_id` y el `code`
son unicos en TODA la tabla, no por proceso: hay que regenerarlos y reescribir
con ellos las conexiones y las claves del layout. Estos tests fijan justo eso.
"""
import pytest

from tests.conftest import make_task, register_and_login


def _grafo(client, process_id, gateways, flows):
    return client.put(f"/processes/{process_id}/graph",
                      json={"gateways": gateways, "sequence_flows": flows})


@pytest.fixture()
def proceso_con_flujo(auth_client, process):
    """Un proceso con dos pasos, una compuerta y sus conexiones."""
    t1 = make_task(auth_client, process["id"], "T1", "Revisar", std_cycle_time_sec=300)
    t2 = make_task(auth_client, process["id"], "T2", "Aprobar", position_order=2,
                   std_cycle_time_sec=600, std_wait_time_sec=120)
    res = _grafo(auth_client, process["id"],
                 [{"bpmn_id": "GW", "node_type": "exclusiveGateway", "name": "¿Completa?"}],
                 [{"bpmn_id": "F1", "source_ref": "start", "target_ref": "T1"},
                  {"bpmn_id": "F2", "source_ref": "T1", "target_ref": "GW"},
                  {"bpmn_id": "F3", "source_ref": "GW", "target_ref": "T2",
                   "condition_expression": "Sí", "branch_probability": 70},
                  {"bpmn_id": "F4", "source_ref": "T2", "target_ref": "end"}])
    assert res.status_code == 200, res.text
    auth_client.put(f"/processes/{process['id']}",
                    json={"layout_json": {f"task-{t1['id']}": {"x": 10, "y": 20},
                                          f"task-{t2['id']}": {"x": 300, "y": 20},
                                          "gw-GW": {"x": 150, "y": 20}}})
    return {"proceso": process, "t1": t1, "t2": t2}


# --------------------------------------------------------------------------
# Mover de carpeta
# --------------------------------------------------------------------------

def test_mover_un_flujo_a_otra_carpeta_conserva_sus_pasos(auth_client, proceso_con_flujo):
    proc = proceso_con_flujo["proceso"]
    otra = auth_client.post("/macroprocesses", json={"code": "MAC-2", "name": "Finanzas"}).json()

    res = auth_client.put(f"/processes/{proc['id']}", json={"macroprocess_id": otra["id"]})
    assert res.status_code == 200, res.text
    assert res.json()["macroprocess_id"] == otra["id"]

    # Lo que motivaba la observacion: mover no puede perder ni borrar datos.
    assert len(auth_client.get(f"/processes/{proc['id']}/tasks").json()) == 2
    assert len(auth_client.get(f"/processes/{proc['id']}/graph").json()["sequence_flows"]) == 4


def _carpeta_de_otra_persona(client, codigo):
    """Crea una carpeta con OTRO usuario y deja la sesion como estaba.

    El cliente de test es uno solo: autenticarse de nuevo reemplaza la sesion.
    Si no se vuelve al usuario original, el rechazo vendria de no poder tocar el
    proceso y el test pasaria sin comprobar lo que dice comprobar.
    """
    register_and_login(client, email=f"ajena-{codigo}@example.com")
    ajena = client.post("/macroprocesses", json={"code": codigo, "name": "Ajena"}).json()
    res = client.post("/auth/login", data={"username": "qa@example.com",
                                           "password": "ClaveDePrueba123"})
    assert res.status_code == 200, res.text
    return ajena


def test_no_se_puede_mover_a_la_carpeta_de_otra_persona(auth_client, proceso_con_flujo):
    proc = proceso_con_flujo["proceso"]
    ajena = _carpeta_de_otra_persona(auth_client, "MAC-X")

    # El dueno del proceso sigue siendo quien pide el cambio: lo que se rechaza
    # es la carpeta de destino, no el acceso al proceso.
    assert auth_client.get(f"/processes/{proc['id']}").status_code == 200
    res = auth_client.put(f"/processes/{proc['id']}", json={"macroprocess_id": ajena["id"]})
    assert res.status_code in (403, 404), res.text


# --------------------------------------------------------------------------
# Copiar el esquema
# --------------------------------------------------------------------------

def test_copiar_reproduce_pasos_compuertas_y_conexiones(auth_client, proceso_con_flujo):
    proc = proceso_con_flujo["proceso"]
    otra = auth_client.post("/macroprocesses", json={"code": "MAC-2", "name": "Finanzas"}).json()

    res = auth_client.post(f"/processes/{proc['id']}/duplicate",
                           json={"macroprocess_id": otra["id"], "code": "PROC-2", "name": "Alta bis"})
    assert res.status_code == 201, res.text
    copia = res.json()
    assert copia["id"] != proc["id"]
    assert copia["macroprocess_id"] == otra["id"]
    assert copia["name"] == "Alta bis"
    # El SIPOC y los datos de cabecera viajan con la copia.
    assert copia["trigger_event"] == proc["trigger_event"]

    tareas = auth_client.get(f"/processes/{copia['id']}/tasks").json()
    assert sorted(t["name"] for t in tareas) == ["Aprobar", "Revisar"]
    assert {float(t["std_cycle_time_sec"]) for t in tareas} == {300.0, 600.0}

    grafo = auth_client.get(f"/processes/{copia['id']}/graph").json()
    assert len(grafo["gateways"]) == 1
    assert len(grafo["sequence_flows"]) == 4
    assert grafo["discarded"] == []


def test_la_copia_usa_identificadores_propios_y_el_original_no_se_toca(auth_client, proceso_con_flujo):
    """Reusar los bpmn_id reventaria la unicidad; reescribirlos a medias dejaria
    la copia desconectada. Se comprueban las dos mitades."""
    proc = proceso_con_flujo["proceso"]
    copia = auth_client.post(f"/processes/{proc['id']}/duplicate",
                             json={"code": "PROC-2"}).json()

    originales = {t["bpmn_id"] for t in auth_client.get(f"/processes/{proc['id']}/tasks").json()}
    nuevos = {t["bpmn_id"] for t in auth_client.get(f"/processes/{copia['id']}/tasks").json()}
    assert originales.isdisjoint(nuevos)

    # Y aun asi el flujo de la copia esta completo: ninguna conexion quedo suelta.
    grafo = auth_client.get(f"/processes/{copia['id']}/graph").json()
    conocidos = nuevos | {g["bpmn_id"] for g in grafo["gateways"]} | {"start", "end"}
    for f in grafo["sequence_flows"]:
        assert f["source_ref"] in conocidos, f
        assert f["target_ref"] in conocidos, f

    # El original sigue intacto.
    assert len(auth_client.get(f"/processes/{proc['id']}/tasks").json()) == 2
    assert len(auth_client.get(f"/processes/{proc['id']}/graph").json()["sequence_flows"]) == 4


def test_la_copia_conserva_la_probabilidad_de_las_ramas(auth_client, proceso_con_flujo):
    proc = proceso_con_flujo["proceso"]
    copia = auth_client.post(f"/processes/{proc['id']}/duplicate", json={"code": "PROC-2"}).json()
    grafo = auth_client.get(f"/processes/{copia['id']}/graph").json()
    rama = [f for f in grafo["sequence_flows"] if f.get("condition_expression") == "Sí"]
    assert len(rama) == 1
    assert float(rama[0]["branch_probability"]) == 70.0


def test_la_copia_conserva_la_disposicion_del_diagrama(auth_client, proceso_con_flujo):
    """Sin traducir las claves del layout la copia saldria amontonada en el origen."""
    proc = proceso_con_flujo["proceso"]
    copia = auth_client.post(f"/processes/{proc['id']}/duplicate", json={"code": "PROC-2"}).json()

    layout = copia["layout_json"]
    assert layout, "la copia se quedo sin posiciones"
    assert len(layout) == 3
    # Ninguna clave puede seguir apuntando a los nodos del original.
    viejas = {f"task-{proceso_con_flujo['t1']['id']}", f"task-{proceso_con_flujo['t2']['id']}", "gw-GW"}
    assert set(layout).isdisjoint(viejas)
    assert sorted(p["x"] for p in layout.values()) == [10, 150, 300]


def test_copiar_sin_indicar_carpeta_deja_la_copia_donde_estaba(auth_client, proceso_con_flujo):
    proc = proceso_con_flujo["proceso"]
    copia = auth_client.post(f"/processes/{proc['id']}/duplicate", json={}).json()
    assert copia["macroprocess_id"] == proc["macroprocess_id"]
    assert copia["name"].endswith("(copia)")


def test_un_codigo_repetido_se_avisa_en_vez_de_reventar(auth_client, proceso_con_flujo):
    proc = proceso_con_flujo["proceso"]
    res = auth_client.post(f"/processes/{proc['id']}/duplicate", json={"code": proc["code"]})
    assert res.status_code == 409, res.text
    assert "código" in res.json()["detail"]


def test_no_se_puede_copiar_a_la_carpeta_de_otra_persona(auth_client, proceso_con_flujo):
    proc = proceso_con_flujo["proceso"]
    ajena = _carpeta_de_otra_persona(auth_client, "MAC-Y")

    assert auth_client.get(f"/processes/{proc['id']}").status_code == 200
    res = auth_client.post(f"/processes/{proc['id']}/duplicate",
                           json={"macroprocess_id": ajena["id"], "code": "PROC-9"})
    assert res.status_code in (403, 404), res.text
    # Y no puede haber quedado una copia a medias.
    assert not [p for p in auth_client.get("/processes").json() if p["code"] == "PROC-9"]
