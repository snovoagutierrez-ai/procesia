"""Presupuesto de consultas de los caminos calientes.

El sintoma reportado en campo fue "despues de un tiempo de uso la pagina tarda
en cargar". La causa tipica en SQLAlchemy es el N+1: recorrer relaciones
perezosas dentro de un bucle. Estos tests cuentan las consultas reales para que
un cambio inocente no reintroduzca el problema sin que nadie se entere.

Los limites son holgados a proposito: fijan el ORDEN DE MAGNITUD (constante,
no proporcional al numero de tareas), no un numero exacto.
"""
from contextlib import contextmanager

from sqlalchemy import event

from tests.conftest import make_task


@contextmanager
def contar_consultas(session):
    consultas = []
    engine = session.get_bind()

    def _registrar(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            consultas.append(statement)

    event.listen(engine, "before_cursor_execute", _registrar)
    try:
        yield consultas
    finally:
        event.remove(engine, "before_cursor_execute", _registrar)


def _proceso_con_tareas(client, process_id, n, prefijo="T"):
    """n tareas, cada una con su rol y su sistema asignados."""
    for i in range(n):
        t = make_task(client, process_id, f"{prefijo}{i}", f"Paso {i}", position_order=i + 1)
        rol = client.post("/roles", json={"name": f"Rol {i}", "cost_per_hour": 1000}).json()
        sistema = client.post("/systems", json={"name": f"Sistema {i}"}).json()
        client.post("/task-racis", json={"task_id": t["id"], "role_id": rol["id"], "raci_type": "R"})
        client.post("/task-systems", json={"task_id": t["id"], "system_id": sistema["id"],
                                           "interaction_type": "read"})


def test_el_snapshot_no_consulta_por_tarea(auth_client, process, db_session):
    """Regresion del N+1: el RACI y los sistemas se consultaban dentro del bucle
    de tareas, asi que el coste crecia con el tamano del proceso."""
    from app.gemini import build_process_snapshot

    _proceso_con_tareas(auth_client, process["id"], 8)

    db_session.expire_all()
    with contar_consultas(db_session) as consultas:
        snapshot = build_process_snapshot(db_session, process["id"])

    assert len(snapshot["activities"][0]["tasks"]) == 8
    assert len(consultas) <= 12, (
        f"{len(consultas)} consultas para 8 tareas: parece un N+1.\n"
        + "\n".join(consultas[:15])
    )


def test_el_snapshot_no_escala_con_el_numero_de_tareas(auth_client, process, db_session):
    """La prueba de fuego: el doble de tareas no debe costar el doble de viajes."""
    from app.gemini import build_process_snapshot

    _proceso_con_tareas(auth_client, process["id"], 4, "A")
    db_session.expire_all()
    with contar_consultas(db_session) as pocas:
        build_process_snapshot(db_session, process["id"])

    _proceso_con_tareas(auth_client, process["id"], 12, "B")
    db_session.expire_all()
    with contar_consultas(db_session) as muchas:
        build_process_snapshot(db_session, process["id"])

    assert len(muchas) <= len(pocas) + 2, (
        f"4 tareas -> {len(pocas)} consultas, 16 tareas -> {len(muchas)}: "
        "el coste crece con el numero de tareas."
    )


def test_las_metricas_no_consultan_por_tarea(auth_client, process, db_session):
    from app.metrics import calculate_process_metrics

    _proceso_con_tareas(auth_client, process["id"], 8)
    db_session.expire_all()
    with contar_consultas(db_session) as consultas:
        calculate_process_metrics(db_session, process["id"])

    assert len(consultas) <= 12, (
        f"{len(consultas)} consultas para 8 tareas: parece un N+1.\n"
        + "\n".join(consultas[:15])
    )
