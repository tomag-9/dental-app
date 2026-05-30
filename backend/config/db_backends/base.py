from django.db.backends.postgresql.base import DatabaseWrapper as PgDatabaseWrapper
from django.db.backends.postgresql.creation import (
    DatabaseCreation as PgDatabaseCreation,
)


class DatabaseCreation(PgDatabaseCreation):
    def _destroy_test_db(self, test_database_name, verbosity):
        # Terminate all other sessions before dropping so that concurrent
        # connections (e.g. from a parallel test worker or a leftover pool
        # connection) don't block the DROP DATABASE call.
        with self._nodb_cursor() as cursor:
            cursor.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = %s AND pid <> pg_backend_pid()",
                [test_database_name],
            )
        super()._destroy_test_db(test_database_name, verbosity)


class DatabaseWrapper(PgDatabaseWrapper):
    creation_class = DatabaseCreation
