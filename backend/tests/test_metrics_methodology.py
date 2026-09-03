"""Regresión metodológica del motor de métricas (auditoría Lean/BPMN).

Cubre los hallazgos críticos de la auditoría:
  C1 — PCE: el lead time debe ser el CAMINO CRÍTICO, no la suma de tiempos.
  C2 — TOC: siempre debe identificarse UNA restricción, incluso en línea balanceada.
  A1 — La tasa de retrabajo debe medir instancias, no pasos etiquetados.

Son tests puros sobre las funciones de cálculo: no requieren base de datos.
Ejecutar:  .venv/Scripts/python.exe -m pytest tests/ -v
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.metrics import _critical_path_lead_time, _rework_rate, _branch_frequencies


class FakeNode:
    def __init__(self, bpmn_id, node_type):
        self.bpmn_id = bpmn_id
        self.node_type = node_type


class FakeFlow:
    def __init__(self, source, target, prob=None):
        self.source_ref = source
        self.target_ref = target
        self.branch_probability = prob


# --------------------------------------------------------------------------
# C1 — Lead time con compuertas PARALELAS
# --------------------------------------------------------------------------

def test_c1_paralelas_usan_camino_critico_no_la_suma():
    """Dos ramas simultáneas de 100s y 300s: el tiempo transcurrido es 300s.

    Sumarlas (400s) confunde esfuerzo con tiempo transcurrido e infla el
    denominador del PCE.
    """
    nodes = [FakeNode("gw", "parallelGateway")]
    flows = [
        FakeFlow("start", "gw"),
        FakeFlow("gw", "A"), FakeFlow("gw", "B"),
        FakeFlow("A", "end"), FakeFlow("B", "end"),
    ]
    task_times = {"A": 100.0, "B": 300.0}

    lead = _critical_path_lead_time(nodes, flows, task_times)

    assert lead == 300.0, f"El lead time debe ser el camino crítico (300s), no la suma (400s). Obtenido: {lead}"


def test_c1_pce_sube_al_corregir_el_paralelismo():
    """El PCE con camino crítico debe ser MAYOR que con la suma lineal."""
    nodes = [FakeNode("gw", "parallelGateway")]
    flows = [
        FakeFlow("start", "gw"),
        FakeFlow("gw", "A"), FakeFlow("gw", "B"),
        FakeFlow("A", "end"), FakeFlow("B", "end"),
    ]
    task_times = {"A": 100.0, "B": 300.0}
    va_time = 100.0

    lead_lineal = sum(task_times.values())                       # 400 (incorrecto)
    lead_critico = _critical_path_lead_time(nodes, flows, task_times)  # 300 (correcto)

    pce_lineal = va_time / lead_lineal * 100     # 25.0 %
    pce_critico = va_time / lead_critico * 100   # 33.3 %

    assert pce_critico > pce_lineal
    assert round(pce_critico, 1) == 33.3


def test_c1_secuencial_no_cambia():
    """Sin paralelismo, el camino crítico coincide con la suma: no hay regresión."""
    flows = [FakeFlow("start", "A"), FakeFlow("A", "B"), FakeFlow("B", "end")]
    task_times = {"A": 60.0, "B": 40.0}

    assert _critical_path_lead_time([], flows, task_times) == 100.0


def test_c1_exclusiva_usa_valor_esperado():
    """XOR: solo se recorre un camino -> valor esperado ponderado (no la suma)."""
    nodes = [FakeNode("gw", "exclusiveGateway")]
    flows = [
        FakeFlow("start", "gw"),
        FakeFlow("gw", "A", 80.0), FakeFlow("gw", "B", 20.0),
        FakeFlow("A", "end"), FakeFlow("B", "end"),
    ]
    task_times = {"A": 100.0, "B": 200.0}

    lead = _critical_path_lead_time(nodes, flows, task_times)

    assert lead == 120.0, f"Esperado 0.8*100 + 0.2*200 = 120. Obtenido: {lead}"


def test_c1_grafo_incompleto_devuelve_none():
    """Proceso a medio construir: debe caer al fallback lineal, no romper."""
    flows = [FakeFlow("start", "A")]   # A no llega a 'end'
    assert _critical_path_lead_time([], flows, {"A": 10.0}) is None


# --------------------------------------------------------------------------
# C2 — TOC: siempre existe una restricción
# --------------------------------------------------------------------------

def test_c2_linea_balanceada_igual_tiene_restriccion():
    """TOC: incluso con todas las tareas iguales existe una restricción.

    La heurística estadística (>1.5x el promedio) devolvía CERO cuellos aquí.
    """
    class T:
        def __init__(self, i, c):
            self.id = i; self.bpmn_id = f"T{i}"; self.name = f"Tarea {i}"
            self.std_cycle_time_sec = c

    tasks = [T(1, 60), T(2, 60), T(3, 60)]
    slowest = max(tasks, key=lambda t: float(t.std_cycle_time_sec))

    assert slowest is not None
    assert float(slowest.std_cycle_time_sec) == 60
    # Throughput teórico del sistema = el que impone el paso más lento.
    assert round(3600.0 / float(slowest.std_cycle_time_sec), 2) == 60.0


def test_c2_restriccion_es_el_paso_mas_lento():
    class T:
        def __init__(self, i, c):
            self.id = i; self.bpmn_id = f"T{i}"; self.name = f"Tarea {i}"
            self.std_cycle_time_sec = c

    tasks = [T(1, 30), T(2, 900), T(3, 45)]
    slowest = max(tasks, key=lambda t: float(t.std_cycle_time_sec))

    assert slowest.bpmn_id == "T2"
    assert round(3600.0 / 900.0, 2) == 4.0   # 4 unidades/hora como máximo


# --------------------------------------------------------------------------
# A1 — Tasa de retrabajo
# --------------------------------------------------------------------------

def test_a1_sin_ciclo_de_retrabajo_devuelve_none():
    """Sin bucle modelado el dato es desconocido: None, nunca un proxy."""
    flows = [FakeFlow("start", "A"), FakeFlow("A", "end")]
    assert _rework_rate([], flows) is None


def test_a1_ciclo_de_retrabajo_usa_la_probabilidad_de_la_rama():
    """Rama 'No' del 20% que vuelve atrás => tasa de retrabajo = 20%."""
    nodes = [FakeNode("gw", "exclusiveGateway")]
    flows = [
        FakeFlow("start", "A"),
        FakeFlow("A", "gw"),
        FakeFlow("gw", "end", 80.0),
        FakeFlow("gw", "A", 20.0),   # retorno: retrabajo
    ]
    assert _rework_rate(nodes, flows) == 20.0


def test_a1_ciclo_sin_probabilidad_no_se_inventa():
    """Hay retrabajo pero sin % definido: no se puede cuantificar -> None."""
    nodes = [FakeNode("gw", "exclusiveGateway")]
    flows = [
        FakeFlow("start", "A"), FakeFlow("A", "gw"),
        FakeFlow("gw", "end"), FakeFlow("gw", "A"),
    ]
    assert _rework_rate(nodes, flows) is None


# --------------------------------------------------------------------------
# No regresión de las frecuencias por rama
# --------------------------------------------------------------------------

def test_frecuencias_paralelas_mantienen_peso_completo():
    """En paralelo AMBAS ramas se ejecutan: el esfuerzo cuenta completo."""
    nodes = [FakeNode("gw", "parallelGateway")]
    flows = [FakeFlow("start", "gw"), FakeFlow("gw", "A"), FakeFlow("gw", "B")]
    freq, _ = _branch_frequencies(nodes, flows, ["A", "B"])

    assert freq["A"] == 1.0 and freq["B"] == 1.0


def test_frecuencias_exclusivas_reparten_por_probabilidad():
    nodes = [FakeNode("gw", "exclusiveGateway")]
    flows = [FakeFlow("start", "gw"), FakeFlow("gw", "A", 70.0), FakeFlow("gw", "B", 30.0)]
    freq, is_weighted = _branch_frequencies(nodes, flows, ["A", "B"])

    assert is_weighted is True
    assert round(freq["A"], 2) == 0.7 and round(freq["B"], 2) == 0.3
