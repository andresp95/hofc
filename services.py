from __future__ import annotations

import sqlite3
from collections import defaultdict
from datetime import datetime

from constants import ALLOWED_PAYMENT_METHODS, ALLOWED_PRODUCT_CATEGORIES, ALLOWED_UNITS
from db import fetch_all, fetch_one, get_db
from errors import ValidationError


def parse_number(
    value: object,
    field_name: str,
    *,
    minimum: float | None = None,
    strictly_positive: bool = False,
) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{field_name}: valor inválido.") from exc

    if strictly_positive and number <= 0:
        raise ValidationError(f"{field_name}: debe ser mayor a 0.")
    if minimum is not None and number < minimum:
        raise ValidationError(f"{field_name}: no puede ser menor a {minimum}.")

    return round(number, 4)


def parse_text(value: object, field_name: str, *, required: bool = False) -> str:
    text = "" if value is None else str(value).strip()
    if required and not text:
        raise ValidationError(f"{field_name}: este campo es obligatorio.")
    return text


def parse_identifier(value: object) -> int | None:
    if value in (None, "", 0, "0"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError("Identificador inválido.") from exc


def validate_date(value: str, field_name: str, *, required: bool) -> str:
    if not value:
        if required:
            raise ValidationError(f"{field_name}: este campo es obligatorio.")
        return ""

    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ValidationError(f"{field_name}: formato inválido.") from exc
    return value


def parse_flag(value: object) -> int:
    return 1 if str(value or "").strip().lower() in {"1", "true", "si", "sí", "yes"} else 0


def material_unit_price(material: dict) -> float:
    return round(float(material["bundle_price"]) / float(material["bundle_quantity"]), 4)


def parse_material(item: dict) -> dict:
    unit = parse_text(item.get("unit"), "Unidades", required=True)
    if unit not in ALLOWED_UNITS:
        raise ValidationError("Unidades: opción inválida.")

    return {
        "id": parse_identifier(item.get("id")),
        "name": parse_text(item.get("name"), "Nombre", required=True),
        "bundle_quantity": parse_number(
            item.get("bundleQuantity"),
            "Cantidad por Bulto",
            strictly_positive=True,
        ),
        "bundle_price": parse_number(
            item.get("bundlePrice"),
            "Precio por Bulto",
            minimum=0,
        ),
        "unit": unit,
    }


def fetch_material_by_id(material_id: int) -> dict | None:
    return fetch_one(
        """
        SELECT id, name, bundle_quantity, bundle_price, unit
        FROM materials
        WHERE id = ?
        """,
        (material_id,),
    )


def parse_product_component(item: dict) -> dict:
    material_id = parse_identifier(item.get("materialId"))
    if material_id is None:
        raise ValidationError("Material: debés seleccionar un material válido.")

    material = fetch_material_by_id(material_id)
    if material is None:
        raise ValidationError("Material: el material seleccionado no existe.")

    quantity = parse_number(item.get("quantity"), "Cantidad de material", strictly_positive=True)
    unit_price = material_unit_price(material)

    return {
        "material_id": material["id"],
        "material_name": material["name"],
        "unit": material["unit"],
        "quantity": quantity,
        "unit_price": round(unit_price, 4),
        "subtotal": round(quantity * unit_price, 4),
    }


def parse_product(payload: dict) -> dict:
    category = parse_text(payload.get("category"), "Categoria", required=True)
    if category not in ALLOWED_PRODUCT_CATEGORIES:
        raise ValidationError("Categoria: opción inválida.")

    components_payload = payload.get("components") or []
    if not components_payload:
        raise ValidationError("El producto debe tener al menos un material.")

    consolidated_components: dict[int, dict] = {}
    for component in (parse_product_component(item) for item in components_payload):
        material_id = component["material_id"]
        if material_id not in consolidated_components:
            consolidated_components[material_id] = dict(component)
            continue
        consolidated_components[material_id]["quantity"] = round(
            consolidated_components[material_id]["quantity"] + component["quantity"],
            4,
        )
        consolidated_components[material_id]["subtotal"] = round(
            consolidated_components[material_id]["quantity"]
            * consolidated_components[material_id]["unit_price"],
            4,
        )

    return {
        "id": parse_identifier(payload.get("id")),
        "name": parse_text(payload.get("name"), "Nombre", required=True),
        "category": category,
        "notes": parse_text(payload.get("notes"), "Notas"),
        "components": list(consolidated_components.values()),
        "price": round(
            sum(component["subtotal"] for component in consolidated_components.values()),
            4,
        ),
    }


def fetch_product_with_price(where_clause: str, params: tuple) -> dict | None:
    return fetch_one(
        f"""
        SELECT
            p.id,
            p.name,
            p.category,
            p.notes,
            CASE
                WHEN COUNT(pm.id) = 0 THEN round(p.price, 4)
                ELSE round(SUM(pm.quantity * (m.bundle_price / m.bundle_quantity)), 4)
            END AS price
        FROM products AS p
        LEFT JOIN product_materials AS pm ON pm.product_id = p.id
        LEFT JOIN materials AS m ON m.id = pm.material_id
        WHERE {where_clause}
        GROUP BY p.id, p.name, p.category, p.notes, p.price
        """,
        params,
    )


def fetch_product_by_id(product_id: int) -> dict | None:
    return fetch_product_with_price("p.id = ?", (product_id,))


def fetch_product_by_name(name: str) -> dict | None:
    return fetch_product_with_price("lower(p.name) = lower(?)", (name,))


def parse_order_item(item: dict, multiplier: float) -> dict:
    product_id = parse_identifier(item.get("productId"))
    product_name = parse_text(item.get("productName"), "Producto", required=product_id is None)
    quantity = parse_number(item.get("quantity"), "Cantidad", strictly_positive=True)

    product = fetch_product_by_id(product_id) if product_id is not None else fetch_product_by_name(product_name)
    if product is None:
        raise ValidationError(
            f"Producto inválido: '{product_name or product_id}'. Solo se permiten productos cargados."
        )

    return {
        "product_id": product["id"],
        "product_name": product["name"],
        "unit_price": round(float(product["price"]) * multiplier, 2),
        "quantity": quantity,
    }


def parse_order(payload: dict) -> dict:
    payment_method = parse_text(
        payload.get("paymentMethod"),
        "Medio de Pago",
        required=True,
    )
    if payment_method not in ALLOWED_PAYMENT_METHODS:
        raise ValidationError("Medio de Pago: opción inválida.")

    multiplier = parse_number(payload.get("multiplier", 2.15), "Multiplicador", strictly_positive=True)
    uses_custom_total = parse_flag(payload.get("usesCustomTotal"))
    custom_total = (
        round(parse_number(payload.get("customTotal", 0), "Total personalizado", minimum=0), 2)
        if uses_custom_total
        else None
    )

    prepared = parse_flag(payload.get("prepared"))
    delivered = parse_flag(payload.get("delivered"))

    items_payload = payload.get("items") or []
    if not items_payload:
        raise ValidationError("Debe agregar al menos un producto al pedido.")

    parsed_items = [parse_order_item(item, multiplier) for item in items_payload]

    consolidated_items: dict[int, dict] = {}
    for item in parsed_items:
        product_id = item["product_id"]
        if product_id not in consolidated_items:
            consolidated_items[product_id] = dict(item)
            continue
        consolidated_items[product_id]["quantity"] = round(
            consolidated_items[product_id]["quantity"] + item["quantity"],
            4,
        )

    return {
        "order_date": validate_date(
            parse_text(payload.get("date"), "Fecha", required=True),
            "Fecha",
            required=True,
        ),
        "client": parse_text(payload.get("client"), "Cliente", required=True),
        "contact": parse_text(payload.get("contact"), "Contacto"),
        "price_multiplier": multiplier,
        "custom_total": custom_total,
        "paid_amount": round(
            parse_number(payload.get("paidAmount", 0), "Seña / Abonado", minimum=0),
            2,
        ),
        "payment_method": payment_method,
        "prepared": prepared,
        "delivered": delivered,
        "delivery_date": validate_date(
            parse_text(payload.get("deliveryDate"), "Fecha de entrega"),
            "Fecha de entrega",
            required=False,
        ),
        "notes": parse_text(payload.get("notes"), "Notas"),
        "items": list(consolidated_items.values()),
    }


def sync_product_prices(connection: sqlite3.Connection, product_ids: set[int] | None = None) -> None:
    where_clause = ""
    params: tuple = ()
    if product_ids:
        placeholders = ",".join("?" for _ in product_ids)
        where_clause = f"WHERE id IN ({placeholders})"
        params = tuple(sorted(product_ids))

    connection.execute(
        f"""
        UPDATE products
        SET price = COALESCE((
            SELECT round(SUM(pm.quantity * (m.bundle_price / m.bundle_quantity)), 4)
            FROM product_materials AS pm
            JOIN materials AS m ON m.id = pm.material_id
            WHERE pm.product_id = products.id
        ), price)
        {where_clause}
        """,
        params,
    )


def fetch_materials() -> list[dict]:
    materials = fetch_all(
        """
        SELECT id, name, bundle_quantity, bundle_price, unit
        FROM materials
        ORDER BY id ASC
        """
    )
    return [
        {
            "id": material["id"],
            "name": material["name"],
            "bundleQuantity": round(float(material["bundle_quantity"]), 4),
            "bundlePrice": round(float(material["bundle_price"]), 2),
            "unit": material["unit"],
            "unitPrice": round(
                float(material["bundle_price"]) / float(material["bundle_quantity"]),
                2,
            ),
        }
        for material in materials
    ]


def replace_materials(items: list[dict]) -> None:
    connection = get_db()
    existing_rows = fetch_all("SELECT id, name FROM materials")
    existing_ids = {row["id"] for row in existing_rows}
    existing_names = {row["id"]: row["name"] for row in existing_rows}
    kept_ids: set[int] = set()

    with connection:
        for item in items:
            if item["id"] is None:
                cursor = connection.execute(
                    """
                    INSERT INTO materials (name, bundle_quantity, bundle_price, unit)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        item["name"],
                        item["bundle_quantity"],
                        item["bundle_price"],
                        item["unit"],
                    ),
                )
                kept_ids.add(int(cursor.lastrowid))
                continue

            cursor = connection.execute(
                """
                UPDATE materials
                SET name = ?, bundle_quantity = ?, bundle_price = ?, unit = ?
                WHERE id = ?
                """,
                (
                    item["name"],
                    item["bundle_quantity"],
                    item["bundle_price"],
                    item["unit"],
                    item["id"],
                ),
            )
            if cursor.rowcount == 0:
                raise ValidationError("No se encontró uno de los materiales a actualizar.")
            kept_ids.add(item["id"])

        removed_ids = existing_ids - kept_ids
        if removed_ids:
            placeholders = ",".join("?" for _ in removed_ids)
            used_rows = fetch_all(
                f"""
                SELECT DISTINCT pm.material_id
                FROM product_materials AS pm
                WHERE pm.material_id IN ({placeholders})
                """,
                tuple(removed_ids),
            )
            if used_rows:
                used_names = [
                    existing_names[row["material_id"]]
                    for row in used_rows
                    if row["material_id"] in existing_names
                ]
                raise ValidationError(
                    "No se pueden eliminar materiales usados en productos: "
                    + ", ".join(sorted(used_names))
                )

            connection.executemany(
                "DELETE FROM materials WHERE id = ?",
                [(material_id,) for material_id in removed_ids],
            )

        sync_product_prices(connection)


def save_product(product_id: int | None, payload: dict) -> int:
    connection = get_db()

    try:
        with connection:
            if product_id is None:
                cursor = connection.execute(
                    "INSERT INTO products (name, price, category, notes) VALUES (?, ?, ?, ?)",
                    (
                        payload["name"],
                        payload["price"],
                        payload["category"],
                        payload["notes"],
                    ),
                )
                product_id = int(cursor.lastrowid)
            else:
                cursor = connection.execute(
                    "UPDATE products SET name = ?, category = ?, notes = ? WHERE id = ?",
                    (
                        payload["name"],
                        payload["category"],
                        payload["notes"],
                        product_id,
                    ),
                )
                if cursor.rowcount == 0:
                    raise ValidationError("No se encontró el producto a actualizar.")
                connection.execute("DELETE FROM product_materials WHERE product_id = ?", (product_id,))

            connection.executemany(
                """
                INSERT INTO product_materials (product_id, material_id, quantity)
                VALUES (?, ?, ?)
                """,
                [
                    (product_id, component["material_id"], component["quantity"])
                    for component in payload["components"]
                ],
            )
            sync_product_prices(connection, {int(product_id)})
    except sqlite3.IntegrityError as exc:
        raise ValidationError("Ya existe un producto con ese nombre.") from exc

    return int(product_id)


def delete_product(product_id: int) -> None:
    connection = get_db()
    product = fetch_one("SELECT id, name FROM products WHERE id = ?", (product_id,))
    if product is None:
        raise ValidationError("No se encontró el producto a eliminar.")

    used_rows = fetch_all(
        "SELECT DISTINCT order_id FROM order_items WHERE product_id = ?",
        (product_id,),
    )
    if used_rows:
        raise ValidationError(
            f"No se puede eliminar el producto '{product['name']}' porque ya está usado en pedidos."
        )

    with connection:
        connection.execute("DELETE FROM products WHERE id = ?", (product_id,))


def save_order(order_id: int | None, payload: dict) -> int:
    connection = get_db()

    with connection:
        if order_id is None:
            cursor = connection.execute(
                """
                INSERT INTO orders (
                    order_date, client, contact, price_multiplier, custom_total, paid_amount,
                    payment_method, prepared, delivered, delivery_date, notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["order_date"],
                    payload["client"],
                    payload["contact"],
                    payload["price_multiplier"],
                    payload["custom_total"],
                    payload["paid_amount"],
                    payload["payment_method"],
                    payload["prepared"],
                    payload["delivered"],
                    payload["delivery_date"],
                    payload["notes"],
                ),
            )
            order_id = cursor.lastrowid
        else:
            cursor = connection.execute(
                """
                UPDATE orders
                SET order_date = ?, client = ?, contact = ?, price_multiplier = ?, custom_total = ?,
                    paid_amount = ?, payment_method = ?, prepared = ?, delivered = ?, delivery_date = ?,
                    notes = ?
                WHERE id = ?
                """,
                (
                    payload["order_date"],
                    payload["client"],
                    payload["contact"],
                    payload["price_multiplier"],
                    payload["custom_total"],
                    payload["paid_amount"],
                    payload["payment_method"],
                    payload["prepared"],
                    payload["delivered"],
                    payload["delivery_date"],
                    payload["notes"],
                    order_id,
                ),
            )
            if cursor.rowcount == 0:
                raise ValidationError("No se encontró el pedido a actualizar.")
            connection.execute("DELETE FROM order_items WHERE order_id = ?", (order_id,))

        connection.executemany(
            """
            INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    order_id,
                    item["product_id"],
                    item["product_name"],
                    item["unit_price"],
                    item["quantity"],
                )
                for item in payload["items"]
            ],
        )

    return int(order_id)


def delete_order(order_id: int) -> None:
    connection = get_db()
    with connection:
        cursor = connection.execute("DELETE FROM orders WHERE id = ?", (order_id,))
        if cursor.rowcount == 0:
            raise ValidationError("No se encontró el pedido a eliminar.")


def update_orders_status(order_ids: list[int], status: str) -> None:
    normalized_ids = sorted({int(order_id) for order_id in order_ids if order_id})
    if not normalized_ids:
        raise ValidationError("Seleccioná al menos un pedido.")

    if status not in {"prepared", "delivered"}:
        raise ValidationError("Estado masivo inválido.")

    placeholders = ",".join("?" for _ in normalized_ids)
    connection = get_db()

    if status == "prepared":
        params = (1, 0, *normalized_ids)
    else:
        params = (1, 1, *normalized_ids)

    with connection:
        cursor = connection.execute(
            f"""
            UPDATE orders
            SET prepared = ?, delivered = ?
            WHERE id IN ({placeholders})
            """,
            params,
        )
        if cursor.rowcount == 0:
            raise ValidationError("No se encontraron pedidos para actualizar.")


def fetch_products() -> list[dict]:
    products = fetch_all(
        """
        SELECT
            p.id,
            p.name,
            p.category,
            p.notes,
            CASE
                WHEN COUNT(pm.id) = 0 THEN round(p.price, 4)
                ELSE round(SUM(pm.quantity * (m.bundle_price / m.bundle_quantity)), 4)
            END AS price
        FROM products AS p
        LEFT JOIN product_materials AS pm ON pm.product_id = p.id
        LEFT JOIN materials AS m ON m.id = pm.material_id
        GROUP BY p.id, p.name, p.category, p.notes, p.price
        ORDER BY p.name COLLATE NOCASE ASC
        """
    )
    material_rows = fetch_all(
        """
        SELECT
            pm.id,
            pm.product_id,
            pm.material_id,
            pm.quantity,
            m.name AS material_name,
            m.unit,
            round(m.bundle_price / m.bundle_quantity, 4) AS unit_price
        FROM product_materials AS pm
        JOIN materials AS m ON m.id = pm.material_id
        ORDER BY pm.product_id, m.name COLLATE NOCASE ASC
        """
    )

    materials_by_product: dict[int, list[dict]] = defaultdict(list)
    for row in material_rows:
        quantity = round(float(row["quantity"]), 4)
        unit_price = round(float(row["unit_price"]), 4)
        materials_by_product[row["product_id"]].append(
            {
                "id": row["id"],
                "materialId": row["material_id"],
                "materialName": row["material_name"],
                "unit": row["unit"],
                "quantity": quantity,
                "unitPrice": unit_price,
                "subtotal": round(quantity * unit_price, 4),
            }
        )

    response: list[dict] = []
    for product in products:
        materials = materials_by_product[product["id"]]
        response.append(
            {
                "id": product["id"],
                "name": product["name"],
                "category": product["category"],
                "notes": product["notes"],
                "price": round(float(product["price"]), 2),
                "materials": materials,
            }
        )

    return response


def fetch_orders() -> list[dict]:
    orders = fetch_all(
        """
        SELECT
            id,
            order_date,
            client,
            contact,
            price_multiplier,
            custom_total,
            paid_amount,
            payment_method,
            prepared,
            delivered,
            delivery_date,
            notes
        FROM orders
        ORDER BY order_date DESC, id DESC
        """
    )
    items_rows = fetch_all(
        """
        SELECT
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.product_name,
            oi.unit_price,
            oi.quantity,
            p.name AS current_product_name
        FROM order_items AS oi
        LEFT JOIN products AS p ON p.id = oi.product_id
        ORDER BY oi.order_id, oi.id
        """
    )

    items_by_order: dict[int, list[dict]] = defaultdict(list)
    for item in items_rows:
        product_name = item["current_product_name"] or item["product_name"]
        quantity = round(float(item["quantity"]), 4)
        unit_price = round(float(item["unit_price"]), 2)
        items_by_order[item["order_id"]].append(
            {
                "id": item["id"],
                "productId": item["product_id"],
                "productName": product_name,
                "quantity": quantity,
                "unitPrice": unit_price,
                "subtotal": round(quantity * unit_price, 2),
            }
        )

    result: list[dict] = []
    for order in orders:
        items = items_by_order[order["id"]]
        automatic_total = round(sum(item["subtotal"] for item in items), 2)
        multiplier = round(float(order["price_multiplier"]), 4)
        uses_custom_total = order["custom_total"] is not None
        custom_total = round(float(order["custom_total"]), 2) if uses_custom_total else 0
        total = custom_total if uses_custom_total else automatic_total
        cost_total = round(automatic_total / multiplier, 2) if multiplier > 0 else 0
        paid_amount = round(float(order["paid_amount"]), 2)
        balance = round(total - paid_amount, 2)

        if bool(order["delivered"]):
            status_tags = ["Entregado"]
        elif bool(order["prepared"]):
            status_tags = ["Preparado"]
        else:
            status_tags = ["Pendiente"]

        result.append(
            {
                "id": order["id"],
                "date": order["order_date"],
                "client": order["client"],
                "contact": order["contact"],
                "multiplier": multiplier,
                "usesCustomTotal": uses_custom_total,
                "customTotal": custom_total,
                "paidAmount": paid_amount,
                "paymentMethod": order["payment_method"],
                "prepared": bool(order["prepared"]),
                "delivered": bool(order["delivered"]),
                "deliveryDate": order["delivery_date"],
                "notes": order["notes"],
                "items": items,
                "automaticTotal": automatic_total,
                "costTotal": cost_total,
                "total": total,
                "balance": balance,
                "statusTags": status_tags,
            }
        )

    return result
