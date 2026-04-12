from __future__ import annotations

import sqlite3

from flask import g
from sqlalchemy.dialects import sqlite as sqlite_dialect
from sqlalchemy.schema import CreateTable

from constants import DB_PATH
from models import db


SCHEMA_READY = False


def normalize_sql(sql: str) -> str:
    return " ".join(sql.replace('"', "").replace("`", "").split()).strip().lower().rstrip(";")


def quote_identifier(name: str) -> str:
    return f'"{name}"'


def table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def build_create_sql(create_sql: str, original_name: str, target_name: str) -> str:
    variants = (
        f"CREATE TABLE {original_name}",
        f'CREATE TABLE "{original_name}"',
    )
    for variant in variants:
        if variant in create_sql:
            return create_sql.replace(
                variant,
                f"CREATE TABLE {target_name}",
                1,
            ).strip()
    return create_sql.strip()


def get_model_table_definitions() -> list[dict]:
    dialect = sqlite_dialect.dialect()
    return [
        {
            "name": table.name,
            "columns": tuple(column.name for column in table.columns),
            "create_sql": str(CreateTable(table).compile(dialect=dialect)),
        }
        for table in db.metadata.sorted_tables
    ]


def rebuild_table(connection: sqlite3.Connection, table_definition: dict) -> None:
    table_name = table_definition["name"]
    temp_name = f"__{table_name}_new"
    current_columns = [
        row[1] for row in connection.execute(f"PRAGMA table_info({quote_identifier(table_name)})")
    ]
    common_columns = [
        column for column in table_definition["columns"] if column in current_columns
    ]

    connection.execute(f"DROP TABLE IF EXISTS {quote_identifier(temp_name)}")
    connection.execute(
        build_create_sql(table_definition["create_sql"], table_name, temp_name)
    )

    if common_columns:
        column_list = ", ".join(quote_identifier(column) for column in common_columns)
        connection.execute(
            f"""
            INSERT INTO {quote_identifier(temp_name)} ({column_list})
            SELECT {column_list}
            FROM {quote_identifier(table_name)}
            """
        )

    connection.execute(f"DROP TABLE {quote_identifier(table_name)}")
    connection.execute(
        f"ALTER TABLE {quote_identifier(temp_name)} RENAME TO {quote_identifier(table_name)}"
    )


def sync_product_prices_sql(connection: sqlite3.Connection) -> None:
    if not table_exists(connection, "products") or not table_exists(connection, "product_materials"):
        return

    connection.execute(
        """
        UPDATE products
        SET price = COALESCE((
            SELECT round(SUM(pm.quantity * (m.bundle_price / m.bundle_quantity)), 4)
            FROM product_materials AS pm
            JOIN materials AS m ON m.id = pm.material_id
            WHERE pm.product_id = products.id
        ), price)
        """
    )


def ensure_schema() -> None:
    global SCHEMA_READY

    if SCHEMA_READY:
        return

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)

    try:
        connection.execute("PRAGMA foreign_keys = OFF")

        for table_definition in get_model_table_definitions():
            table_name = table_definition["name"]
            existing_table = connection.execute(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
                (table_name,),
            ).fetchone()

            if existing_table is None:
                connection.execute(table_definition["create_sql"].strip())
                continue

            current_sql = existing_table[0] or ""
            if normalize_sql(current_sql) != normalize_sql(table_definition["create_sql"]):
                rebuild_table(connection, table_definition)

        sync_product_prices_sql(connection)
        connection.commit()
        SCHEMA_READY = True
    finally:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.close()


def get_db() -> sqlite3.Connection:
    ensure_schema()
    if "db" not in g:
        connection = sqlite3.connect(DB_PATH)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        g.db = connection
    return g.db


def close_db(_exception: BaseException | None) -> None:
    connection = g.pop("db", None)
    if connection is not None:
        connection.close()


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row is not None else None


def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    cursor = get_db().execute(query, params)
    return [dict(row) for row in cursor.fetchall()]


def fetch_one(query: str, params: tuple = ()) -> dict | None:
    cursor = get_db().execute(query, params)
    return row_to_dict(cursor.fetchone())
