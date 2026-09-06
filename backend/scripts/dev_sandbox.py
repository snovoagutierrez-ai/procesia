"""Levanta la API contra una base desechable, sin tocar produccion.

`backend/.env` apunta a la base de Supabase de produccion, asi que probar la
interfaz en local escribe sobre los datos reales de los usuarios. Este arranque
usa un SQLite propio (backend/sandbox.db, ignorado por git) para poder pulsar
todos los botones sin consecuencias.

Los modelos usan tipos de PostgreSQL que SQLite no entiende (ENUM nativo, JSONB,
BIGSERIAL); se traducen aqui igual que en los tests, sin tocar el codigo de
produccion.

Uso:
    backend/.venv/Scripts/python.exe backend/scripts/dev_sandbox.py
    # y el frontend, aparte:  cd frontend && npm run dev
"""
import os
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

BASE = RAIZ / "sandbox.db"

# Antes de importar la aplicacion: la configuracion se lee al importar.
os.environ["DATABASE_URL"] = f"sqlite:///{BASE.as_posix()}"
os.environ.setdefault("GEMINI_API_KEY", "sandbox-sin-uso")
os.environ.setdefault("JWT_SECRET", "sandbox-jwt-no-usar-en-produccion")
os.environ["ENV"] = "development"

from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM  # noqa: E402
from sqlalchemy.dialects.postgresql import JSONB  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402
from sqlalchemy.sql.sqltypes import BigInteger  # noqa: E402


@compiles(JSONB, "sqlite")
def _jsonb(type_, compiler, **kw):
    return "JSON"


@compiles(PG_ENUM, "sqlite")
def _enum(type_, compiler, **kw):
    return "VARCHAR(50)"


@compiles(BigInteger, "sqlite")
def _bigint(type_, compiler, **kw):
    # Solo INTEGER PRIMARY KEY autoincrementa en SQLite.
    return "INTEGER"


from app import models  # noqa: E402,F401  (registra las tablas en el metadata)
from app.database import Base, engine  # noqa: E402

Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    import uvicorn

    print(f"Base desechable: {BASE}")
    print("Produccion NO se toca. Registra un usuario de prueba cualquiera.")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=False)
