"""Observaciones del 10/09: notas sobre el lienzo y glosario de nomenclaturas.

Las notas son apoyo visual y viven FUERA del flujo: no se conectan con nada ni
entran en las metricas. El glosario explica las siglas internas del proceso, que
es lo que bloquea a quien lee un diagrama por primera vez.
"""
from tests.conftest import make_task, register_and_login


# --------------------------------------------------------------------------
# Notas sobre el lienzo
# --------------------------------------------------------------------------

def test_crear_una_nota_la_atribuye_y_la_coloca(auth_client, process):
    res = auth_client.post(f"/processes/{process['id']}/notes", json={
        "kind": "advertencia", "text": "Ojo: este tramo depende de un permiso externo.",
        "pos_x": 120.5, "pos_y": -40,
    })
    assert res.status_code == 201, res.text
    nota = res.json()
    assert nota["kind"] == "advertencia"
    assert nota["author_email"] == "qa@example.com"
    assert nota["pos_x"] == 120.5 and nota["pos_y"] == -40


def test_las_notas_no_forman_parte_del_flujo(auth_client, process):
    """Lo que motivaba la observacion: son apoyo visual, no un paso mas. No
    pueden aparecer entre las tareas ni entre las conexiones del diagrama."""
    make_task(auth_client, process["id"], "T1", "Uno")
    auth_client.post(f"/processes/{process['id']}/notes", json={"text": "Recordatorio"})

    assert len(auth_client.get(f"/processes/{process['id']}/tasks").json()) == 1
    grafo = auth_client.get(f"/processes/{process['id']}/graph").json()
    assert grafo["gateways"] == []
    assert grafo["sequence_flows"] == []


def test_mover_y_editar_una_nota(auth_client, process):
    nota = auth_client.post(f"/processes/{process['id']}/notes",
                            json={"text": "Borrador"}).json()
    res = auth_client.put(f"/processes/{process['id']}/notes/{nota['id']}",
                          json={"text": "Ya revisado", "kind": "importante", "pos_x": 10, "pos_y": 20})
    assert res.status_code == 200, res.text
    assert res.json()["text"] == "Ya revisado"
    assert res.json()["kind"] == "importante"
    assert res.json()["pos_x"] == 10


def test_un_tipo_de_nota_inventado_se_rechaza(auth_client, process):
    res = auth_client.post(f"/processes/{process['id']}/notes",
                           json={"kind": "urgentisimo", "text": "Hola"})
    assert res.status_code == 422, res.text
    assert "advertencia" in res.json()["detail"]


def test_una_nota_vacia_se_rechaza(auth_client, process):
    assert auth_client.post(f"/processes/{process['id']}/notes",
                            json={"text": ""}).status_code == 422


def test_borrar_una_nota(auth_client, process):
    nota = auth_client.post(f"/processes/{process['id']}/notes", json={"text": "Temporal"}).json()
    assert auth_client.delete(f"/processes/{process['id']}/notes/{nota['id']}").status_code == 204
    assert auth_client.get(f"/processes/{process['id']}/notes").json() == []


def test_las_notas_de_un_proceso_ajeno_no_se_ven(auth_client, process):
    auth_client.post(f"/processes/{process['id']}/notes", json={"text": "Interna"})
    register_and_login(auth_client, email="ajena@example.com")
    assert auth_client.get(f"/processes/{process['id']}/notes").status_code in (403, 404)


# --------------------------------------------------------------------------
# Glosario de nomenclaturas
# --------------------------------------------------------------------------

def test_crear_un_termino_con_su_significado_y_referencia(auth_client, process):
    res = auth_client.post(f"/processes/{process['id']}/glossary", json={
        "term": "SIGEPAC", "meaning": "Sistema de gestión de calibraciones",
        "reference": "Manual interno DTS-04",
    })
    assert res.status_code == 201, res.text
    assert res.json()["term"] == "SIGEPAC"
    assert res.json()["reference"] == "Manual interno DTS-04"


def test_el_mismo_termino_dos_veces_se_avisa(auth_client, process):
    """Dos significados distintos para la misma sigla es peor que no tenerla."""
    auth_client.post(f"/processes/{process['id']}/glossary",
                     json={"term": "NP", "meaning": "Nota de pedido"})
    res = auth_client.post(f"/processes/{process['id']}/glossary",
                           json={"term": "  np  ", "meaning": "Otra cosa"})
    assert res.status_code == 409, res.text
    assert "NP" in res.json()["detail"] or "np" in res.json()["detail"]


def test_el_glosario_sale_ordenado(auth_client, process):
    for i, t in enumerate(["ZZZ", "AAA", "MMM"]):
        auth_client.post(f"/processes/{process['id']}/glossary",
                         json={"term": t, "meaning": f"Significado {t}", "position_order": i})
    terminos = auth_client.get(f"/processes/{process['id']}/glossary").json()
    assert [t["term"] for t in terminos] == ["ZZZ", "AAA", "MMM"]


def test_editar_y_borrar_un_termino(auth_client, process):
    t = auth_client.post(f"/processes/{process['id']}/glossary",
                         json={"term": "TOC", "meaning": "Teoria de restricciones"}).json()
    res = auth_client.put(f"/processes/{process['id']}/glossary/{t['id']}",
                          json={"meaning": "Teoría de las restricciones (Goldratt)"})
    assert res.status_code == 200
    assert "Goldratt" in res.json()["meaning"]

    assert auth_client.delete(f"/processes/{process['id']}/glossary/{t['id']}").status_code == 204
    assert auth_client.get(f"/processes/{process['id']}/glossary").json() == []


def test_el_glosario_de_un_proceso_ajeno_no_se_ve(auth_client, process):
    auth_client.post(f"/processes/{process['id']}/glossary",
                     json={"term": "X", "meaning": "Interno"})
    register_and_login(auth_client, email="ajena2@example.com")
    assert auth_client.get(f"/processes/{process['id']}/glossary").status_code in (403, 404)


def test_notas_y_glosario_se_van_con_el_proceso(auth_client, db_session, process):
    """ON DELETE CASCADE: borrar el proceso no puede dejar filas huerfanas.

    Se cuentan las filas en la base, no el codigo de respuesta: tras borrar el
    proceso el endpoint devolveria 404 igualmente, con cascada o sin ella.
    """
    from app import models

    auth_client.post(f"/processes/{process['id']}/notes", json={"text": "Se va con el proceso"})
    auth_client.post(f"/processes/{process['id']}/glossary",
                     json={"term": "TMP", "meaning": "Temporal"})
    assert db_session.query(models.ProcessNote).count() == 1
    assert db_session.query(models.GlossaryTerm).count() == 1

    assert auth_client.delete(f"/processes/{process['id']}").status_code == 204
    db_session.expire_all()
    assert db_session.query(models.ProcessNote).count() == 0
    assert db_session.query(models.GlossaryTerm).count() == 0
