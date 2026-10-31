"""Installed GridflowClient: read-only, TEMP tables work and vanish on reopen."""

from __future__ import annotations

import math

import duckdb
import pytest
from gridflow.serving.client import GridflowClient

from app import rows


def test_installed_client_read_only_temp_and_closure(tmp_path):
    catalogue = tmp_path / "synthetic.duckdb"
    with duckdb.connect(str(catalogue)) as writable:
        writable.execute("CREATE TABLE seed (n INTEGER)")
        writable.execute("INSERT INTO seed VALUES (7)")
    with GridflowClient(str(catalogue)) as client:
        assert callable(client._require_con)
        assert isinstance(client._require_con(), duckdb.DuckDBPyConnection)
        databases = client.query("SELECT * FROM duckdb_databases()").to_dicts()
        assert any(row["readonly"] for row in databases if row["database_name"] == "synthetic")
        rows._DeadlineClient(client, math.inf).create("__rows_contract_0", "SELECT n FROM seed")
        assert client.query("SELECT n FROM temp.main.__rows_contract_0")["n"][0] == 7
        with pytest.raises(duckdb.Error):
            client.query("CREATE TABLE persistent_write (n INTEGER)")
    assert client._con is None
    with GridflowClient(str(catalogue)) as reopened:
        assert (
            reopened.query(
                "SELECT count(*) AS n FROM information_schema.tables "
                "WHERE table_name='__rows_contract_0'"
            )["n"][0]
            == 0
        )
