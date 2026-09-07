"""Ensayo de las migraciones pendientes contra la base real, SIN aplicarlas.

Ejecuta la cadena completa dentro de una transaccion y la revierte siempre. Sirve
para descubrir un fallo de SQL antes de desplegar, en vez de descubrirlo cuando
Render ya no puede arrancar: el comando de inicio es
`alembic upgrade head && uvicorn ...`, asi que una migracion rota deja el
servicio entero sin levantar.

Uso:
    backend/.venv/Scripts/python.exe backend/scripts/dry_run_migrations.py "<DATABASE_URL>"

No commitea nunca. Al terminar comprueba que la base quedo como estaba.
"""
import importlib.util
import pathlib
import sys

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text

VERSIONES = pathlib.Path(__file__).resolve().parent.parent / "alembic" / "versions"


def cargar(nombre):
    ruta = next(VERSIONES.glob(f"{nombre}_*.py"))
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def main(url):
    engine = create_engine(url.replace("postgresql://", "postgresql+pg8000://"))

    with engine.connect() as conn:
        actual = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        print(f"revision actual en la base: {actual}")

        pendientes = []
        for m in sorted(VERSIONES.glob("*.py")):
            mod = cargar(m.name.split("_")[0])
            if getattr(mod, "down_revision", None) == actual or pendientes:
                pendientes.append(mod)
                actual = mod.revision
        pendientes.sort(key=lambda m: (m.down_revision or "", m.revision))

        # Reordenar siguiendo la cadena real down_revision -> revision.
        cadena, cursor = [], conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        por_padre = {getattr(m, "down_revision", None): m for m in pendientes}
        while cursor in por_padre:
            m = por_padre[cursor]
            cadena.append(m)
            cursor = m.revision

        if not cadena:
            print("no hay migraciones pendientes")
            return 0
        print("pendientes:", " -> ".join(m.revision for m in cadena))

        # SQLAlchemy 2.0 abre la transaccion sola en el primer execute; basta
        # con no commitear nunca y revertir al final.
        try:
            ctx = MigrationContext.configure(conn)
            with Operations.context(ctx):
                for m in cadena:
                    print(f"  ensayando {m.revision} ...", end=" ")
                    m.upgrade()
                    print("OK")

            # Comprobaciones dentro de la transaccion, antes de revertir.
            for tabla in ("roles", "systems"):
                total = conn.execute(text(f"SELECT count(*) FROM {tabla}")).scalar()
                con_dueno = conn.execute(text(f"SELECT count(*) FROM {tabla} WHERE owner_id IS NOT NULL")).scalar()
                huerfanas = conn.execute(text(f"""
                    SELECT count(*) FROM {tabla} x WHERE x.owner_id IS NULL
                """)).scalar()
                print(f"  {tabla}: {total} filas, {con_dueno} con dueno, {huerfanas} sin atribuir")

            print("\nTODAS LAS MIGRACIONES PASAN.")
        except Exception as e:
            print(f"\nFALLA: {type(e).__name__}: {str(e)[:400]}")
            return 1
        finally:
            conn.rollback()
            print("transaccion revertida: la base queda intacta")

    # Verificacion independiente, con conexion nueva.
    with engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        cols = conn.execute(text("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema='public' AND table_name IN ('roles','systems') AND column_name='owner_id'
        """)).scalar()
        print(f"comprobacion final -> revision: {rev} | columnas owner_id existentes: {cols}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("falta la DATABASE_URL")
    sys.exit(main(sys.argv[1]))
