"""Comprueba el esquema nuevo y su reversión en una base desechable."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect


def test_deletion_request_migration_matches_model():
    from app.database import Base
    from app import models
    path = Path(__file__).parents[1] / 'alembic/versions/g7b8c9d0e1f2_add_deletion_requests.py'
    spec = importlib.util.spec_from_file_location('deletion_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine('sqlite://')
    with engine.begin() as connection:
        Base.metadata.create_all(connection)
        models.ProcessDeletionRequest.__table__.drop(connection)
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        schema = inspect(connection)
        columns = schema.get_columns('process_deletion_requests')
        assert {c['name'] for c in columns} == set(models.ProcessDeletionRequest.__table__.columns.keys())
        indexes = {index['name']: index for index in schema.get_indexes('process_deletion_requests')}
        assert indexes['uq_pending_process_deletion']['unique']
        assert str(indexes['uq_pending_process_deletion']['dialect_options']['sqlite_where']) == "status = 'pending'"
        assert all(fk['options']['ondelete'] == 'SET NULL' for fk in schema.get_foreign_keys('process_deletion_requests'))
        migration.downgrade()
        assert 'process_deletion_requests' not in inspect(connection).get_table_names()
    engine.dispose()
