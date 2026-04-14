from __future__ import annotations

import sqlite3

from constants import DB_PATH


def main() -> None:
    print(f"DB_PATH={DB_PATH}")
    if not DB_PATH.exists():
        print("La base no existe todavía.")
        return

    connection = sqlite3.connect(DB_PATH)
    try:
        columns = connection.execute("PRAGMA table_info(orders)").fetchall()
        print("Columnas de orders:")
        for column in columns:
            print(f"- {column[1]} ({column[2]})")

        has_custom_total = any(column[1] == "custom_total" for column in columns)
        print(f"custom_total presente: {'SI' if has_custom_total else 'NO'}")

        if has_custom_total:
            rows = connection.execute(
                """
                SELECT id, client, price_multiplier, custom_total
                FROM orders
                ORDER BY id DESC
                LIMIT 5
                """
            ).fetchall()
            print("Ultimos pedidos:")
            for row in rows:
                print(
                    f"- id={row[0]} client={row[1]!r} multiplier={row[2]} custom_total={row[3]}"
                )
    finally:
        connection.close()


if __name__ == "__main__":
    main()
