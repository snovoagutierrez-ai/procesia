"""Siembra el sandbox con un proceso de ejemplo, via la API.

Sirve para revisar la interfaz sin depender de datos reales: crea una cuenta
desechable y un proceso con compuerta, ramas etiquetadas y —a proposito— una
tarea sin entrada, para poder comprobar el marcado del nodo con problemas.

Uso (con backend/scripts/dev_sandbox.py levantado en el puerto 8001):
    backend/.venv/Scripts/python.exe backend/scripts/seed_sandbox.py
"""
import json
import sys
import time
import urllib.error
import urllib.request
from http.cookiejar import CookieJar

BASE = "http://127.0.0.1:8001"
CUENTA = {"email": "sandbox@local.test", "password": "SandboxDePrueba123"}

_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))


def llamar(metodo, ruta, cuerpo=None, formulario=False):
    if formulario:
        datos = "&".join(f"{k}={v}" for k, v in cuerpo.items()).encode()
        cabeceras = {"Content-Type": "application/x-www-form-urlencoded"}
    else:
        datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
        cabeceras = {"Content-Type": "application/json"}
    req = urllib.request.Request(BASE + ruta, data=datos, headers=cabeceras, method=metodo)
    try:
        with _opener.open(req) as r:
            texto = r.read().decode()
            return json.loads(texto) if texto else None
    except urllib.error.HTTPError as e:
        detalle = e.read().decode()
        if e.code == 400 and ("registrado" in detalle.lower() or "already registered" in detalle.lower()):
            return None  # la cuenta ya existia
        raise SystemExit(f"{metodo} {ruta} -> {e.code}: {detalle[:300]}")


def main():
    llamar("POST", "/auth/register", CUENTA)
    llamar("POST", "/auth/login", {"username": CUENTA["email"], "password": CUENTA["password"]}, formulario=True)

    # Codigo unico por ejecucion: asi la siembra se puede repetir sobre la
    # misma base sin chocar con el macroproceso de la vez anterior.
    sello = time.strftime("%H%M%S")
    macro = llamar("POST", "/macroprocesses", {"code": f"DEMO{sello}", "name": "Operaciones"})
    proc = llamar("POST", "/processes", {
        "macroprocess_id": macro["id"], "code": f"DEMO{sello}-01", "name": "Evaluación crediticia",
        "objective": "Aprobar o rechazar una solicitud de crédito",
        "trigger_event": "Se recibe la solicitud", "output_result": "Cliente aprobado",
        "suppliers": "Cliente", "customers": "Área comercial",
    })
    pid = proc["id"]

    tareas = [
        ("T1", "Revisar documentos", "user", "NNVA", None, 300, 3600),
        ("T2", "Consultar buró", "service", "NNVA", None, 120, 0),
        ("T3", "Aprobar crédito", "user", "VA", None, 600, 1800),
        ("T4", "Corregir documentos", "manual", "NVA", "defects", 900, 0),
    ]
    for i, (bid, nombre, tipo, valor, waste, ciclo, espera) in enumerate(tareas):
        llamar("POST", f"/processes/{pid}/tasks", {
            "bpmn_id": f"{sello}_{bid}", "name": nombre, "position_order": i + 1, "task_type": tipo,
            "value_classification": valor, "waste_type": waste,
            "std_cycle_time_sec": ciclo, "std_wait_time_sec": espera,
        })

    # T4 queda deliberadamente sin entrada: asi se puede ver el nodo marcado.
    llamar("PUT", f"/processes/{pid}/graph", {
        "gateways": [{"bpmn_id": f"{sello}_GW", "node_type": "exclusiveGateway", "name": "¿Documentación completa?"},
                     {"bpmn_id": f"{sello}_GP", "node_type": "parallelGateway", "name": "Revisiones en paralelo"}],
        "sequence_flows": [
            {"bpmn_id": f"{sello}_F1", "source_ref": "start", "target_ref": f"{sello}_T1"},
            {"bpmn_id": f"{sello}_F2", "source_ref": f"{sello}_T1", "target_ref": f"{sello}_GW"},
            {"bpmn_id": f"{sello}_F3", "source_ref": f"{sello}_GW", "target_ref": f"{sello}_T2", "condition_expression": "Sí", "branch_probability": 70},
            {"bpmn_id": f"{sello}_F4", "source_ref": f"{sello}_GW", "target_ref": f"{sello}_T3", "condition_expression": "No", "branch_probability": 30},
            {"bpmn_id": f"{sello}_F5", "source_ref": f"{sello}_T2", "target_ref": f"{sello}_T3"},
            {"bpmn_id": f"{sello}_F6", "source_ref": f"{sello}_T3", "target_ref": "end"},
            {"bpmn_id": f"{sello}_F7", "source_ref": f"{sello}_T4", "target_ref": "end"},
        ],
    })

    print(f"proceso {pid} listo | cuenta: {CUENTA['email']} / {CUENTA['password']}")
    print("T4 'Corregir documentos' queda sin entrada a proposito (nodo marcado).")


if __name__ == "__main__":
    sys.exit(main())
