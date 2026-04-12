from __future__ import annotations

from flask import Flask, jsonify, render_template, request

from constants import ALLOWED_PAYMENT_METHODS, ALLOWED_PRODUCT_CATEGORIES, ALLOWED_UNITS
from errors import ValidationError
from services import (
    delete_order,
    delete_product,
    fetch_materials,
    fetch_orders,
    fetch_products,
    parse_material,
    parse_order,
    parse_product,
    replace_materials,
    save_order,
    save_product,
    update_orders_status,
)


def register_routes(app: Flask) -> None:
    @app.errorhandler(ValidationError)
    def handle_validation_error(error: ValidationError):
        return jsonify({"error": str(error)}), 400

    @app.route("/")
    def index():
        return render_template(
            "index.html",
            config={
                "units": ALLOWED_UNITS,
                "paymentMethods": ALLOWED_PAYMENT_METHODS,
                "productCategories": ALLOWED_PRODUCT_CATEGORIES,
            },
        )

    @app.get("/api/materials")
    def api_get_materials():
        return jsonify(fetch_materials())

    @app.put("/api/materials")
    def api_save_materials():
        payload = request.get_json(silent=True) or {}
        materials = payload.get("materials") or []
        parsed_materials = [parse_material(item) for item in materials]
        replace_materials(parsed_materials)
        return jsonify({"message": "Materiales guardados correctamente."})

    @app.get("/api/products")
    def api_get_products():
        return jsonify(fetch_products())

    @app.post("/api/products")
    def api_create_product():
        payload = request.get_json(silent=True) or {}
        product_id = save_product(None, parse_product(payload))
        return jsonify({"message": "Producto creado correctamente.", "productId": product_id})

    @app.put("/api/products/<int:product_id>")
    def api_update_product(product_id: int):
        payload = request.get_json(silent=True) or {}
        saved_product_id = save_product(product_id, parse_product(payload))
        return jsonify({"message": "Producto actualizado correctamente.", "productId": saved_product_id})

    @app.delete("/api/products/<int:product_id>")
    def api_delete_product(product_id: int):
        delete_product(product_id)
        return jsonify({"message": "Producto eliminado correctamente."})

    @app.get("/api/orders")
    def api_get_orders():
        return jsonify(fetch_orders())

    @app.post("/api/orders")
    def api_create_order():
        payload = request.get_json(silent=True) or {}
        order_id = save_order(None, parse_order(payload))
        return jsonify({"message": "Pedido creado correctamente.", "orderId": order_id})

    @app.put("/api/orders/<int:order_id>")
    def api_update_order(order_id: int):
        payload = request.get_json(silent=True) or {}
        saved_order_id = save_order(order_id, parse_order(payload))
        return jsonify({"message": "Pedido actualizado correctamente.", "orderId": saved_order_id})

    @app.delete("/api/orders/<int:order_id>")
    def api_delete_order(order_id: int):
        delete_order(order_id)
        return jsonify({"message": "Pedido eliminado correctamente."})

    @app.post("/api/orders/bulk-status")
    def api_update_orders_bulk_status():
        payload = request.get_json(silent=True) or {}
        order_ids = payload.get("orderIds") or []
        status = str(payload.get("status") or "").strip().lower()
        update_orders_status(order_ids, status)
        return jsonify({"message": "Pedidos actualizados correctamente."})
