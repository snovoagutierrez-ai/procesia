"""Indices en las claves foraneas que se consultan en caliente

PostgreSQL indexa la clave primaria y las columnas UNIQUE, pero NO las claves
foraneas. Faltaban en once columnas, y tres de ellas estan en el camino critico:

  - sequence_flows.process_id y flow_nodes.process_id se filtran cada vez que se
    abre un proceso (get_graph), la operacion mas frecuente de la aplicacion.
  - macroprocesses.owner_id se filtra al cargar el panel principal; su equivalente
    en `processes` si tenia indice, asi que era un olvido, no una decision.

Sin ellos cada lectura recorre la tabla entera: con pocos datos no se nota, y por
eso el sintoma reportado era "despues de un tiempo de uso la pagina tarda".

Todo es idempotente y CONCURRENTLY no se usa a proposito: las tablas son
pequenas y asi la migracion corre dentro de la transaccion de alembic.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (nombre_indice, tabla, columna)
_INDEXES = [
    ("ix_sequence_flows_process_id", "sequence_flows", "process_id"),
    ("ix_flow_nodes_process_id", "flow_nodes", "process_id"),
    ("ix_macroprocesses_owner_id", "macroprocesses", "owner_id"),
    ("ix_time_measurements_task_id", "time_measurements", "task_id"),
    ("ix_task_raci_role_id", "task_raci", "role_id"),
    ("ix_task_systems_system_id", "task_systems", "system_id"),
    ("ix_macro_sequence_flows_macroprocess_id", "macro_sequence_flows", "macroprocess_id"),
    ("ix_bpmn_artifacts_process_id", "bpmn_artifacts", "process_id"),
    ("ix_node_comments_author_id", "node_comments", "author_id"),
]


def upgrade() -> None:
    for name, table, column in _INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({column})")


def downgrade() -> None:
    for name, _table, _column in _INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
