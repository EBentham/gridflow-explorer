"""Installed GridflowClient and the restricted TEMP adapter contract."""

from __future__ import annotations

import inspect

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
        adapter = rows._temp_operations(client, "__rows_contract_")
        adapter.create("__rows_contract_0", "SELECT n FROM seed")
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


def test_adapter_rejects_unowned_names_and_has_no_general_execute(sources_db):
    adapter = rows._temp_operations(sources_db, "__rows_owned_")
    for name in ("seed", "__rows_other_0", "main.bad", "__rows_owned_0;DROP TABLE seed"):
        with pytest.raises(ValueError):
            adapter.create(name, "SELECT 1")
        with pytest.raises(ValueError):
            adapter.drop(name)
    for selection in (
        "CREATE TABLE persistent_write AS SELECT 1",
        "SELECT 1; CREATE TABLE bad AS SELECT 2",
    ):
        with pytest.raises(ValueError):
            adapter.create("__rows_owned_0", selection)
    assert not hasattr(adapter, "execute")
    assert not hasattr(adapter, "query")
    assert not hasattr(adapter, "get_tables")
    source = inspect.getsource(rows)
    assert source.count("._require_con(") == 1
