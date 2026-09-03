"""Regresión de integridad del grafo (observaciones de QA de campo).

Cubre los defectos que llegaban hasta la base de datos:
  obs05 — Conexiones guardadas con el id numérico de la tarea en vez de su
          bpmn_id: la flecha se dibujaba pero los chequeos no la veían y el paso
          quedaba "sin entrada" de forma permanente.
  obs06 — Una compuerta podía conectarse a sí misma y generar una tercera rama
          de salida inválida.
  obs08 — Ramas de decisión (etiqueta Sí/No + probabilidad) colgando de una
          tarea, cuando solo una compuerta decide.

Son tests puros sobre la normalización: la sesión de base de datos se simula.
Ejecutar:  .venv/Scripts/python.exe -m pytest tests/ -v
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.crud import normalize_sequence_flows


class FakeTask:
    def __init__(self, task_id, bpmn_id):
        self.id = task_id
        self.bpmn_id = bpmn_id


class FakeGateway:
    def __init__(self, bpmn_id):
        self.bpmn_id = bpmn_id


class FakeFlow:
    def __init__(self, source, target, condition=None, prob=None, bpmn_id="Flow_1"):
        self.bpmn_id = bpmn_id
        self.source_ref = source
        self.target_ref = target
        self.condition_expression = condition
        self.branch_probability = prob


class FakeSession:
    """Devuelve siempre las mismas tareas para la cadena query().join().filter().all()."""

    def __init__(self, tasks):
        self._tasks = tasks

    def query(self, *_):
        return self

    def join(self, *_):
        return self

    def filter(self, *_):
        return self

    def all(self):
        return self._tasks


TASKS = [FakeTask(42, "Task_revisar"), FakeTask(43, "Task_corregir")]
GATEWAYS = [FakeGateway("Gateway_aprob")]


def run(flows):
    return normalize_sequence_flows(FakeSession(TASKS), 1, GATEWAYS, flows)


# --------------------------------------------------------------------------
# obs05 — referencias por id numérico
# --------------------------------------------------------------------------

def test_obs05_id_numerico_se_traduce_a_bpmn_id():
    """La conexión dibujada en el canvas guardaba "43"; debe quedar "Task_corregir"."""
    flows, discarded = run([FakeFlow("Gateway_aprob", "43")])
    assert len(flows) == 1
    assert flows[0].target_ref == "Task_corregir"
    assert discarded == []


def test_obs05_ambos_extremos_se_traducen():
    flows, _ = run([FakeFlow("42", "43")])
    assert (flows[0].source_ref, flows[0].target_ref) == ("Task_revisar", "Task_corregir")


def test_obs05_start_y_end_no_se_tocan():
    flows, _ = run([FakeFlow("start", "42"), FakeFlow("43", "end")])
    assert flows[0].source_ref == "start"
    assert flows[1].target_ref == "end"


# --------------------------------------------------------------------------
# obs06 — auto-conexión y duplicados
# --------------------------------------------------------------------------

def test_obs06_la_compuerta_no_puede_conectarse_consigo_misma():
    flows, discarded = run([FakeFlow("Gateway_aprob", "Gateway_aprob")])
    assert flows == []
    assert len(discarded) == 1


def test_obs06_autoconexion_encubierta_por_el_id_numerico():
    """"42" y "Task_revisar" son el mismo nodo: sigue siendo una auto-conexión."""
    flows, discarded = run([FakeFlow("42", "Task_revisar")])
    assert flows == []
    assert len(discarded) == 1


def test_obs06_conexion_duplicada_se_descarta_una_sola_vez():
    flows, discarded = run([
        FakeFlow("42", "43", bpmn_id="Flow_1"),
        FakeFlow("Task_revisar", "Task_corregir", bpmn_id="Flow_2"),
    ])
    assert len(flows) == 1
    assert len(discarded) == 1


def test_obs06_las_ramas_legitimas_de_una_compuerta_sobreviven():
    flows, discarded = run([
        FakeFlow("Gateway_aprob", "43", "No", 20, bpmn_id="Flow_1"),
        FakeFlow("Gateway_aprob", "end", "Si", 80, bpmn_id="Flow_2"),
    ])
    assert len(flows) == 2
    assert [f.condition_expression for f in flows] == ["No", "Si"]
    assert discarded == []


# --------------------------------------------------------------------------
# obs08 — decisiones naciendo de una tarea
# --------------------------------------------------------------------------

def test_obs08_una_tarea_no_puede_originar_una_rama_de_decision():
    flows, discarded = run([FakeFlow("Task_revisar", "43", "No", 20)])
    assert len(flows) == 1, "la conexión se conserva; solo se quita la etiqueta"
    assert flows[0].condition_expression is None
    assert flows[0].branch_probability is None
    assert len(discarded) == 1


def test_obs08_start_tampoco_decide():
    flows, _ = run([FakeFlow("start", "42", "Si", 100)])
    assert flows[0].condition_expression is None


# --------------------------------------------------------------------------
# Casos límite
# --------------------------------------------------------------------------

def test_conexion_sin_extremos_se_descarta():
    flows, discarded = run([FakeFlow("", "43"), FakeFlow("42", None)])
    assert flows == []
    assert len(discarded) == 2


def test_grafo_vacio_no_rompe():
    assert run([]) == ([], [])
