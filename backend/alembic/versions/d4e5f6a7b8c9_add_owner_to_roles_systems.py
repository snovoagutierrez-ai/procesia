"""Aisla roles y sistemas por usuario (multi-tenancy)

Hasta ahora `roles` y `systems` no tenian dueno: cualquier usuario autenticado
listaba, editaba y borraba los roles de todas las empresas, incluido el
`cost_per_hour`. Se agrega `owner_id` y se atribuye cada fila al usuario que
realmente la usa, siguiendo task_raci/task_systems -> tasks -> processes.

Cuando una misma fila la usan varios duenos se duplica una copia por dueno extra
y se reapuntan sus vinculos, para que nadie pierda datos. Las filas huerfanas
(sin ningun vinculo) quedan con owner_id NULL y dejan de listarse.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (tabla, tabla puente, columna FK en el puente, columnas a copiar)
_TARGETS = [
    ("roles", "task_raci", "role_id", ["name", "area", "cost_per_hour"]),
    ("systems", "task_systems", "system_id", ["name", "system_type", "vendor"]),
]


def _split_by_owner(conn, table, bridge, fk, cols):
    """Atribuye cada fila de `table` a un dueno, duplicandola si la comparten."""
    pairs = conn.execute(sa.text(f"""
        SELECT DISTINCT b.{fk} AS row_id, p.owner_id
        FROM {bridge} b
        JOIN tasks t ON t.id = b.task_id
        JOIN processes p ON p.id = t.process_id
        ORDER BY b.{fk}, p.owner_id
    """)).fetchall()

    owners_by_row = {}
    for row_id, owner_id in pairs:
        owners_by_row.setdefault(row_id, []).append(owner_id)

    col_list = ", ".join(cols)
    placeholders = ", ".join(f":{c}" for c in cols)

    for row_id, owners in owners_by_row.items():
        # El primer dueno conserva la fila original.
        conn.execute(sa.text(f"UPDATE {table} SET owner_id = :o WHERE id = :i"),
                     {"o": owners[0], "i": row_id})
        # Los demas reciben una copia propia y sus vinculos se reapuntan.
        for owner_id in owners[1:]:
            src = conn.execute(
                sa.text(f"SELECT {col_list} FROM {table} WHERE id = :i"), {"i": row_id}
            ).mappings().one()
            new_id = conn.execute(
                sa.text(f"INSERT INTO {table} ({col_list}, owner_id) "
                        f"VALUES ({placeholders}, :owner_id) RETURNING id"),
                {**dict(src), "owner_id": owner_id},
            ).scalar_one()
            conn.execute(sa.text(f"""
                UPDATE {bridge} b SET {fk} = :new_id
                FROM tasks t JOIN processes p ON p.id = t.process_id
                WHERE b.task_id = t.id AND b.{fk} = :old_id AND p.owner_id = :owner_id
            """), {"new_id": new_id, "old_id": row_id, "owner_id": owner_id})


def upgrade() -> None:
    op.execute("ALTER TABLE roles ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE systems ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE")

    conn = op.get_bind()
    for table, bridge, fk, cols in _TARGETS:
        _split_by_owner(conn, table, bridge, fk, cols)

    op.execute("CREATE INDEX IF NOT EXISTS ix_roles_owner_id ON roles (owner_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_systems_owner_id ON systems (owner_id)")


def downgrade() -> None:
    # Las copias creadas al separar duenos no se deshacen: eliminarlas romperia
    # los vinculos que ya se reapuntaron a ellas.
    op.execute("DROP INDEX IF EXISTS ix_roles_owner_id")
    op.execute("DROP INDEX IF EXISTS ix_systems_owner_id")
    op.execute("ALTER TABLE roles DROP COLUMN IF EXISTS owner_id")
    op.execute("ALTER TABLE systems DROP COLUMN IF EXISTS owner_id")
