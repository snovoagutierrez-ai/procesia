"""Capa de IA: lo que se le manda, lo que se acepta de vuelta y como falla.

No se llama a Gemini: se prueban las funciones deterministas que rodean la
llamada, que es donde estaban los defectos reportados (segundos crudos en el
texto, nodos bien conectados acusados de "sin entrada", respuestas cortadas
tratadas como JSON invalido).
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.gemini import (  # noqa: E402
    IncompleteAnswer,
    detect_flow_issues,
    extract_response_text,
    human_duration,
)


# --------------------------------------------------------------------------
# human_duration: la IA citaba "300 segundos", unidad que no existe en pantalla
# --------------------------------------------------------------------------

@pytest.mark.parametrize("segundos,esperado", [
    (0, "0s"),
    (45, "45s"),
    (60, "1m"),
    (300, "5m"),
    (90, "1m 30s"),
    (3600, "1h"),
    (4800, "1h 20m"),
])
def test_duracion_legible(segundos, esperado):
    assert human_duration(segundos) == esperado


@pytest.mark.parametrize("valor", [None, "", "no es un numero", [], {}])
def test_duracion_con_basura_no_revienta(valor):
    assert human_duration(valor) == "0s"


def test_duracion_acepta_decimales_y_texto_numerico():
    assert human_duration("300") == "5m"
    assert human_duration(299.6) == "5m"


# --------------------------------------------------------------------------
# extract_response_text: distinguir "cortada" de "mal formada"
# --------------------------------------------------------------------------

class FakeCandidate:
    def __init__(self, finish_reason):
        self.finish_reason = finish_reason


class FakeResponse:
    def __init__(self, text=None, finish_reason=None):
        self.text = text
        self.candidates = [FakeCandidate(finish_reason)] if finish_reason else []


def test_una_respuesta_con_texto_se_devuelve_tal_cual():
    assert extract_response_text(FakeResponse(text='{"ok": true}')) == '{"ok": true}'


def test_el_corte_por_longitud_se_identifica_como_tal():
    with pytest.raises(IncompleteAnswer) as err:
        extract_response_text(FakeResponse(text=None, finish_reason="MAX_TOKENS"))
    assert "longitud" in str(err.value).lower()


def test_el_bloqueo_por_seguridad_se_identifica_como_tal():
    with pytest.raises(IncompleteAnswer) as err:
        extract_response_text(FakeResponse(text="", finish_reason="SAFETY"))
    assert "bloque" in str(err.value).lower()


def test_una_respuesta_vacia_sin_motivo_tambien_avisa():
    with pytest.raises(IncompleteAnswer):
        extract_response_text(FakeResponse(text=None))


def test_una_respuesta_sin_candidates_no_revienta():
    class Rara:
        text = None
    with pytest.raises(IncompleteAnswer):
        extract_response_text(Rara())


# --------------------------------------------------------------------------
# detect_flow_issues: lo que la IA usa para decir donde esta roto el flujo
# --------------------------------------------------------------------------

def _tarea(bpmn_id, nombre="Paso"):
    return {"bpmn_id": bpmn_id, "name": nombre}


def _compuerta(bpmn_id, node_type="exclusiveGateway", nombre="¿?"):
    return {"bpmn_id": bpmn_id, "node_type": node_type, "name": nombre}


def _flujo(src, tgt, cond=None, prob=None):
    return {"source_ref": src, "target_ref": tgt,
            "condition_expression": cond, "branch_probability": prob, "name": None}


def _tipos(issues):
    return {i["issue"] for i in issues}


def test_un_flujo_bien_armado_no_reporta_problemas_de_nodo():
    issues = detect_flow_issues(
        [_tarea("T1"), _tarea("T2")],
        [],
        [_flujo("start", "T1"), _flujo("T1", "T2"), _flujo("T2", "end")],
    )
    assert _tipos(issues) & {"isolated", "dead_end", "unreachable"} == set()


def test_una_tarea_suelta_se_reporta_como_aislada():
    issues = detect_flow_issues([_tarea("T1"), _tarea("T2")], [],
                                [_flujo("start", "T1"), _flujo("T1", "end")])
    aislados = [i for i in issues if i["issue"] == "isolated"]
    assert [i["node_bpmn_id"] for i in aislados] == ["T2"]


def test_una_tarea_sin_salida_es_callejon_sin_salida():
    issues = detect_flow_issues([_tarea("T1")], [], [_flujo("start", "T1")])
    assert "dead_end" in _tipos(issues)


def test_una_tarea_sin_entrada_es_inalcanzable():
    issues = detect_flow_issues([_tarea("T1")], [], [_flujo("T1", "end")])
    assert "unreachable" in _tipos(issues)


def test_una_compuerta_con_una_sola_salida_no_ramifica():
    issues = detect_flow_issues(
        [_tarea("T1")], [_compuerta("GW")],
        [_flujo("start", "T1"), _flujo("T1", "GW"), _flujo("GW", "end")],
    )
    assert "gateway_not_branching" in _tipos(issues)


def test_las_ramas_sin_etiqueta_se_reportan():
    issues = detect_flow_issues(
        [_tarea("T1"), _tarea("T2")], [_compuerta("GW")],
        [_flujo("start", "GW"), _flujo("GW", "T1"), _flujo("GW", "T2")],
    )
    assert "unlabeled_branches" in _tipos(issues)


def test_las_probabilidades_que_no_suman_100_se_reportan():
    issues = detect_flow_issues(
        [_tarea("T1"), _tarea("T2")], [_compuerta("GW")],
        [_flujo("start", "GW"),
         _flujo("GW", "T1", "Sí", 50), _flujo("GW", "T2", "No", 30)],
    )
    assert "probabilities_not_100" in _tipos(issues)


def test_las_probabilidades_que_suman_100_no_se_reportan():
    issues = detect_flow_issues(
        [_tarea("T1"), _tarea("T2")], [_compuerta("GW")],
        [_flujo("start", "GW"),
         _flujo("GW", "T1", "Sí", 80), _flujo("GW", "T2", "No", 20)],
    )
    assert "probabilities_not_100" not in _tipos(issues)


def test_un_proceso_sin_tareas_no_reporta_nada():
    assert detect_flow_issues([], [], []) == []


# --------------------------------------------------------------------------
# El snapshot que recibe la IA
# --------------------------------------------------------------------------

def test_el_snapshot_traduce_las_referencias_numericas(auth_client, process, db_session):
    """La IA acusaba de "sin entrada" a nodos conectados porque el flujo apuntaba
    a la tarea por su id numerico y detect_flow_issues indexa por bpmn_id."""
    from app import models
    from app.gemini import build_process_snapshot
    from tests.conftest import make_task

    t1 = make_task(auth_client, process["id"], "T1", "Uno")
    auth_client.put(f"/processes/{process['id']}/graph", json={"gateways": [], "sequence_flows": [
        {"bpmn_id": "F1", "source_ref": "start", "target_ref": "T1"},
        {"bpmn_id": "F2", "source_ref": "T1", "target_ref": "end"},
    ]})

    # Se recrea a mano el estado heredado: la conexion apunta al id numerico.
    # Escribir por la API no sirve, porque la API ya lo normaliza.
    flujo = db_session.query(models.SequenceFlow).filter_by(bpmn_id="F1").one()
    flujo.target_ref = str(t1["id"])
    db_session.commit()

    snap = build_process_snapshot(db_session, process["id"])
    refs = {f["target_ref"] for f in snap["sequence_flows"]}
    assert str(t1["id"]) not in refs, "el id numerico debio traducirse"
    assert "T1" in refs
    # Y por tanto la tarea ya no figura como inalcanzable.
    assert not any(i["issue"] == "unreachable" for i in snap["flow_issues"])


def test_el_snapshot_incluye_los_tiempos_ya_formateados(auth_client, process, db_session):
    from app.gemini import build_process_snapshot
    from tests.conftest import make_task

    make_task(auth_client, process["id"], "T1", "Uno", std_cycle_time_sec=300)
    snap = build_process_snapshot(db_session, process["id"])
    tarea = snap["activities"][0]["tasks"][0]
    assert tarea["cycle_time_display"] == "5m"
    assert tarea["std_cycle_time_sec"] == 300.0


def test_el_snapshot_trae_los_problemas_de_flujo(auth_client, process, db_session):
    from app.gemini import build_process_snapshot
    from tests.conftest import make_task

    make_task(auth_client, process["id"], "T1", "Suelta")
    snap = build_process_snapshot(db_session, process["id"])
    assert "flow_issues" in snap
    assert any(i["issue"] == "isolated" for i in snap["flow_issues"])
