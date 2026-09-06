"""Recorrido completo del editor: crear, conectar, medir y exportar.

Reproduce lo que hace cada boton de la interfaz contra la API real, incluidos
los casos que en produccion dejaron datos invalidos.
"""
from tests.conftest import make_task


# --------------------------------------------------------------------------
# Macroprocesos y procesos
# --------------------------------------------------------------------------

def test_crear_proceso_crea_su_actividad_por_defecto(auth_client, process):
    """Sin la actividad "General" no se puede colgar ninguna tarea."""
    res = auth_client.post(f"/processes/{process['id']}/tasks", json={
        "bpmn_id": "T1", "name": "Paso", "position_order": 1, "task_type": "user",
        "value_classification": "VA", "std_cycle_time_sec": 60, "std_wait_time_sec": 0,
    })
    assert res.status_code == 201, res.text


def test_crear_proceso_en_macroproceso_inexistente_falla(auth_client):
    res = auth_client.post("/processes", json={
        "macroprocess_id": 999999, "code": "X", "name": "Huerfano"
    })
    assert res.status_code in (400, 403, 404)


def test_editar_proceso_persiste_el_sipoc(auth_client, process):
    res = auth_client.put(f"/processes/{process['id']}", json={
        "suppliers": "Cliente", "customers": "Área comercial"
    })
    assert res.status_code == 200, res.text
    leido = auth_client.get(f"/processes/{process['id']}").json()
    assert leido["suppliers"] == "Cliente"
    assert leido["customers"] == "Área comercial"


def test_borrar_proceso_arrastra_sus_tareas(auth_client, process):
    make_task(auth_client, process["id"], "T1", "Paso")
    assert auth_client.delete(f"/processes/{process['id']}").status_code == 204
    assert auth_client.get(f"/processes/{process['id']}").status_code in (403, 404)


# --------------------------------------------------------------------------
# Tareas
# --------------------------------------------------------------------------

def test_una_tarea_nva_exige_tipo_de_desperdicio(auth_client, process):
    """Regla Lean: NVA sin waste_type deja la metrica DOWNTIME incompleta."""
    res = auth_client.post(f"/processes/{process['id']}/tasks", json={
        "bpmn_id": "T1", "name": "Reproceso", "position_order": 1, "task_type": "manual",
        "value_classification": "NVA", "std_cycle_time_sec": 60, "std_wait_time_sec": 0,
    })
    # 422: lo rechaza el validador de Pydantic, antes de tocar la base.
    assert res.status_code == 422


def test_una_tarea_nva_con_desperdicio_se_acepta(auth_client, process):
    res = auth_client.post(f"/processes/{process['id']}/tasks", json={
        "bpmn_id": "T1", "name": "Reproceso", "position_order": 1, "task_type": "manual",
        "value_classification": "NVA", "waste_type": "defects",
        "std_cycle_time_sec": 60, "std_wait_time_sec": 0,
    })
    assert res.status_code == 201, res.text


def test_editar_tarea_devuelve_los_valores_nuevos(auth_client, process):
    t = make_task(auth_client, process["id"], "T1", "Paso")
    res = auth_client.put(f"/processes/{process['id']}/tasks/{t['id']}", json={
        "name": "Paso renombrado", "std_cycle_time_sec": 900
    })
    assert res.status_code == 200, res.text
    assert res.json()["name"] == "Paso renombrado"
    assert float(res.json()["std_cycle_time_sec"]) == 900


def test_borrar_tarea_la_saca_del_listado(auth_client, process):
    t = make_task(auth_client, process["id"], "T1", "Paso")
    assert auth_client.delete(f"/processes/{process['id']}/tasks/{t['id']}").status_code == 204
    assert auth_client.get(f"/processes/{process['id']}/tasks").json() == []


def test_no_se_puede_tocar_una_tarea_de_otro_proceso(auth_client, process):
    t = make_task(auth_client, process["id"], "T1", "Paso")
    otro = auth_client.post("/processes", json={
        "macroprocess_id": process["macroprocess_id"], "code": "P-2", "name": "Otro"
    }).json()
    res = auth_client.put(f"/processes/{otro['id']}/tasks/{t['id']}", json={"name": "Robada"})
    # 400 en vez de 404, pero lo importante es que no se aplica el cambio.
    assert res.status_code in (400, 403, 404)
    assert auth_client.get(f"/processes/{process['id']}/tasks").json()[0]["name"] == "Paso"


# --------------------------------------------------------------------------
# Grafo: aqui vivian los defectos reportados en produccion
# --------------------------------------------------------------------------

def _grafo(client, process_id, gateways, flows):
    return client.put(f"/processes/{process_id}/graph",
                      json={"gateways": gateways, "sequence_flows": flows})


def test_guardar_y_leer_un_grafo_simple(auth_client, process):
    make_task(auth_client, process["id"], "T1", "Uno")
    make_task(auth_client, process["id"], "T2", "Dos")
    res = _grafo(auth_client, process["id"], [], [
        {"bpmn_id": "F1", "source_ref": "start", "target_ref": "T1"},
        {"bpmn_id": "F2", "source_ref": "T1", "target_ref": "T2"},
        {"bpmn_id": "F3", "source_ref": "T2", "target_ref": "end"},
    ])
    assert res.status_code == 200, res.text
    leido = auth_client.get(f"/processes/{process['id']}/graph").json()
    assert len(leido["sequence_flows"]) == 3
    assert leido["discarded"] == []


def test_la_referencia_numerica_se_traduce_a_bpmn_id(auth_client, process):
    """Regresion del "sin entrada" permanente: el canvas guardaba el id numerico
    de la tarea y ningun chequeo reconocia esa conexion."""
    t1 = make_task(auth_client, process["id"], "T1", "Uno")
    _grafo(auth_client, process["id"], [], [
        {"bpmn_id": "F1", "source_ref": "start", "target_ref": str(t1["id"])},
    ])
    leido = auth_client.get(f"/processes/{process['id']}/graph").json()
    assert leido["sequence_flows"][0]["target_ref"] == "T1"


def test_una_compuerta_no_puede_conectarse_consigo_misma(auth_client, process):
    make_task(auth_client, process["id"], "T1", "Uno")
    res = _grafo(auth_client, process["id"],
                 [{"bpmn_id": "GW", "node_type": "exclusiveGateway", "name": "¿Aprobado?"}],
                 [{"bpmn_id": "F1", "source_ref": "GW", "target_ref": "GW"}])
    assert res.status_code == 200, res.text
    assert res.json()["sequence_flows"] == []
    assert len(res.json()["discarded"]) == 1


def test_una_tarea_no_puede_originar_una_rama_de_decision(auth_client, process):
    """Solo las compuertas deciden: la conexion se conserva, la etiqueta no."""
    make_task(auth_client, process["id"], "T1", "Uno")
    make_task(auth_client, process["id"], "T2", "Dos")
    res = _grafo(auth_client, process["id"], [], [
        {"bpmn_id": "F1", "source_ref": "T1", "target_ref": "T2",
         "condition_expression": "No", "branch_probability": 20},
    ])
    flujo = res.json()["sequence_flows"][0]
    assert flujo["condition_expression"] is None
    assert flujo["branch_probability"] is None
    assert len(res.json()["discarded"]) == 1


def test_las_ramas_de_una_compuerta_conservan_etiqueta_y_probabilidad(auth_client, process):
    make_task(auth_client, process["id"], "T1", "Uno")
    make_task(auth_client, process["id"], "T2", "Dos")
    res = _grafo(auth_client, process["id"],
                 [{"bpmn_id": "GW", "node_type": "exclusiveGateway", "name": "¿Aprobado?"}],
                 [{"bpmn_id": "F1", "source_ref": "GW", "target_ref": "T1",
                   "condition_expression": "Sí", "branch_probability": 80},
                  {"bpmn_id": "F2", "source_ref": "GW", "target_ref": "T2",
                   "condition_expression": "No", "branch_probability": 20}])
    flujos = {f["bpmn_id"]: f for f in res.json()["sequence_flows"]}
    assert flujos["F1"]["condition_expression"] == "Sí"
    assert float(flujos["F1"]["branch_probability"]) == 80
    assert res.json()["discarded"] == []


def test_guardar_el_grafo_reemplaza_lo_anterior(auth_client, process):
    make_task(auth_client, process["id"], "T1", "Uno")
    _grafo(auth_client, process["id"], [], [{"bpmn_id": "F1", "source_ref": "start", "target_ref": "T1"}])
    res = _grafo(auth_client, process["id"], [], [])
    assert res.json()["sequence_flows"] == []


def test_una_probabilidad_fuera_de_rango_se_rechaza(auth_client, process):
    make_task(auth_client, process["id"], "T1", "Uno")
    res = _grafo(auth_client, process["id"],
                 [{"bpmn_id": "GW", "node_type": "exclusiveGateway", "name": "¿?"}],
                 [{"bpmn_id": "F1", "source_ref": "GW", "target_ref": "T1",
                   "branch_probability": 150}])
    assert res.status_code == 422


# --------------------------------------------------------------------------
# Metricas
# --------------------------------------------------------------------------

def test_metricas_de_un_proceso_vacio_no_revientan(auth_client, process):
    res = auth_client.get(f"/processes/{process['id']}/metrics")
    assert res.status_code == 200, res.text
    assert res.json()["lead_time_sec"] == 0


def test_el_pce_refleja_la_proporcion_de_valor_agregado(auth_client, process):
    make_task(auth_client, process["id"], "T1", "Agrega valor",
              value_classification="VA", std_cycle_time_sec=100)
    make_task(auth_client, process["id"], "T2", "Desperdicio",
              value_classification="NVA", waste_type="waiting", std_cycle_time_sec=300)
    _grafo(auth_client, process["id"], [], [
        {"bpmn_id": "F1", "source_ref": "start", "target_ref": "T1"},
        {"bpmn_id": "F2", "source_ref": "T1", "target_ref": "T2"},
        {"bpmn_id": "F3", "source_ref": "T2", "target_ref": "end"},
    ])
    m = auth_client.get(f"/processes/{process['id']}/metrics").json()
    assert round(m["pce_percentage"]) == 25  # 100 de 400
    assert m["pce_percentage"] <= 100


def test_la_restriccion_es_el_paso_mas_lento(auth_client, process):
    make_task(auth_client, process["id"], "T1", "Rapido", std_cycle_time_sec=60)
    make_task(auth_client, process["id"], "T2", "Lento", std_cycle_time_sec=600)
    m = auth_client.get(f"/processes/{process['id']}/metrics").json()
    assert m["constraint"] is not None
    assert m["constraint"]["name"] == "Lento"


def test_las_tareas_en_paralelo_no_suman_su_tiempo(auth_client, process):
    """El lead time por camino critico es la rama mas larga, no la suma."""
    make_task(auth_client, process["id"], "A", "Rama larga", std_cycle_time_sec=300)
    make_task(auth_client, process["id"], "B", "Rama corta", std_cycle_time_sec=100)
    _grafo(auth_client, process["id"],
           [{"bpmn_id": "GW", "node_type": "parallelGateway", "name": "Paralelo"}],
           [{"bpmn_id": "F0", "source_ref": "start", "target_ref": "GW"},
            {"bpmn_id": "F1", "source_ref": "GW", "target_ref": "A"},
            {"bpmn_id": "F2", "source_ref": "GW", "target_ref": "B"},
            {"bpmn_id": "F3", "source_ref": "A", "target_ref": "end"},
            {"bpmn_id": "F4", "source_ref": "B", "target_ref": "end"}])
    m = auth_client.get(f"/processes/{process['id']}/metrics").json()
    assert m["lead_time_is_critical_path"] is True
    assert m["lead_time_sec"] == 300


# --------------------------------------------------------------------------
# Exportaciones
# --------------------------------------------------------------------------

def test_exportar_bpmn_devuelve_xml_valido(auth_client, process):
    import xml.etree.ElementTree as ET
    make_task(auth_client, process["id"], "T1", "Uno")
    res = auth_client.get(f"/processes/{process['id']}/bpmn")
    assert res.status_code == 200, res.text
    ET.fromstring(res.text)  # revienta si no es XML bien formado


def test_exportar_mermaid_devuelve_un_diagrama(auth_client, process):
    make_task(auth_client, process["id"], "T1", "Uno")
    res = auth_client.get(f"/processes/{process['id']}/mermaid")
    assert res.status_code == 200, res.text
    assert "graph" in res.text.lower() or "flowchart" in res.text.lower()


def test_un_bpmn_id_repetido_responde_409_y_no_500(auth_client, process):
    """`tasks.bpmn_id` es unico en toda la tabla, no por proceso: el choque es
    alcanzable entre cuentas distintas. Antes salia como error 500 opaco."""
    make_task(auth_client, process["id"], "T_repetido", "Original")
    otro = auth_client.post("/processes", json={
        "macroprocess_id": process["macroprocess_id"], "code": "P-3", "name": "Otro"
    }).json()
    res = auth_client.post(f"/processes/{otro['id']}/tasks", json={
        "bpmn_id": "T_repetido", "name": "Choque", "position_order": 1,
        "task_type": "user", "value_classification": "VA",
        "std_cycle_time_sec": 60, "std_wait_time_sec": 0,
    })
    assert res.status_code == 409, res.text
    assert "conflicto" in res.json()["detail"].lower()
