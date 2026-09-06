"""Infraestructura compartida para los tests de integracion de la API.

El proyecto solo tenia tests puros sobre funciones de calculo: ningun endpoint
estaba cubierto, asi que un cambio en `api.py` o `crud.py` podia romper un boton
entero sin que nada avisara. Aqui se levanta la aplicacion real contra una base
SQLite desechable, para poder ejercitar los endpoints de verdad.

Los modelos usan tipos propios de PostgreSQL (ENUM nativo, JSONB, BIGSERIAL) que
SQLite no entiende. En vez de tocar los modelos de produccion para hacerlos
testeables, se traducen esos tipos solo durante los tests.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# La configuracion se lee al importar `app.config`, asi que las variables tienen
# que existir antes de cualquier import de la aplicacion.
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")

from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.dialects.postgresql import JSONB  # noqa: E402
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from sqlalchemy.sql.sqltypes import BigInteger  # noqa: E402


# --- Traduccion de tipos PostgreSQL -> SQLite -------------------------------
@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(PG_ENUM, "sqlite")
def _compile_enum_sqlite(type_, compiler, **kw):
    # SQLite no tiene ENUM nativo; el valor viaja como texto.
    return "VARCHAR(50)"


@compiles(BigInteger, "sqlite")
def _compile_bigint_sqlite(type_, compiler, **kw):
    # Solo INTEGER PRIMARY KEY autoincrementa en SQLite; BIGINT no.
    return "INTEGER"


from app import models  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture()
def db_session():
    """Base nueva y vacia por test: ninguno depende del estado que dejo otro."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite ignora las claves foraneas si no se activan explicitamente, y sin
    # ellas los ON DELETE CASCADE del esquema no se probarian de verdad.
    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session):
    """Cliente HTTP contra la aplicacion real, con la base del test."""
    def _get_db_override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db_override
    # El limitador de peticiones haria fallar los tests que llaman varias veces
    # al mismo endpoint; no es lo que se esta probando aqui.
    app.state.limiter.enabled = False
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    app.state.limiter.enabled = True


def register_and_login(client, email="qa@example.com", password="ClaveDePrueba123"):
    """Deja al cliente autenticado y devuelve el usuario creado."""
    res = client.post("/auth/register", json={"email": email, "password": password})
    assert res.status_code in (200, 201), res.text
    res = client.post("/auth/login", data={"username": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture()
def auth_client(client):
    register_and_login(client)
    return client


@pytest.fixture()
def process(auth_client):
    """Un proceso vacio listo para usar, con su macroproceso."""
    macro = auth_client.post("/macroprocesses", json={"code": "MAC-1", "name": "Operaciones"})
    assert macro.status_code in (200, 201), macro.text
    proc = auth_client.post("/processes", json={
        "macroprocess_id": macro.json()["id"],
        "code": "PROC-1",
        "name": "Alta de cliente",
        "objective": "Dar de alta un cliente",
        "trigger_event": "Solicitud recibida",
        "output_result": "Cuenta activada",
    })
    assert proc.status_code in (200, 201), proc.text
    return proc.json()


def make_task(client, process_id, bpmn_id, name, **kwargs):
    payload = {
        "bpmn_id": bpmn_id,
        "name": name,
        "position_order": 1,
        "task_type": "user",
        "value_classification": "VA",
        "std_cycle_time_sec": 300,
        "std_wait_time_sec": 0,
    }
    payload.update(kwargs)
    res = client.post(f"/processes/{process_id}/tasks", json=payload)
    assert res.status_code in (200, 201), res.text
    return res.json()
