from __future__ import annotations

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint, UniqueConstraint, text


db = SQLAlchemy()


class Material(db.Model):
    __tablename__ = "materials"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False)
    bundle_quantity = db.Column(db.Float, nullable=False)
    bundle_price = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    product_links = db.relationship("ProductMaterial", back_populates="material")

    __table_args__ = (
        CheckConstraint("bundle_quantity > 0", name="ck_materials_bundle_quantity_positive"),
        CheckConstraint("bundle_price >= 0", name="ck_materials_bundle_price_nonnegative"),
    )


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(180, collation="NOCASE"), unique=True, nullable=False)
    price = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(40), nullable=False, server_default=text("'Primaria'"))
    notes = db.Column(db.Text, nullable=False, server_default=text("''"))
    created_at = db.Column(db.DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    material_links = db.relationship(
        "ProductMaterial",
        back_populates="product",
        cascade="all, delete-orphan",
    )
    order_items = db.relationship("OrderItem", back_populates="product")

    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_products_price_nonnegative"),
    )


class ProductMaterial(db.Model):
    __tablename__ = "product_materials"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    material_id = db.Column(db.Integer, db.ForeignKey("materials.id", ondelete="RESTRICT"), nullable=False)
    quantity = db.Column(db.Float, nullable=False)

    product = db.relationship("Product", back_populates="material_links")
    material = db.relationship("Material", back_populates="product_links")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_product_materials_quantity_positive"),
        UniqueConstraint("product_id", "material_id", name="uq_product_materials_product_material"),
    )


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    order_date = db.Column(db.String(10), nullable=False)
    client = db.Column(db.String(180), nullable=False)
    contact = db.Column(db.String(180), nullable=False, server_default=text("''"))
    price_multiplier = db.Column(db.Float, nullable=False, server_default=text("2.15"))
    custom_total = db.Column(db.Float, nullable=True)
    paid_amount = db.Column(db.Float, nullable=False, server_default=text("0"))
    payment_method = db.Column(db.String(40), nullable=False)
    prepared = db.Column(db.Boolean, nullable=False, server_default=text("0"))
    delivered = db.Column(db.Boolean, nullable=False, server_default=text("0"))
    delivery_date = db.Column(db.String(10), nullable=False, server_default=text("''"))
    notes = db.Column(db.Text, nullable=False, server_default=text("''"))
    created_at = db.Column(db.DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("price_multiplier > 0", name="ck_orders_price_multiplier_positive"),
        CheckConstraint(
            "custom_total IS NULL OR custom_total >= 0",
            name="ck_orders_custom_total_nonnegative",
        ),
        CheckConstraint("paid_amount >= 0", name="ck_orders_paid_amount_nonnegative"),
    )


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="RESTRICT"))
    product_name = db.Column(db.String(180), nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Float, nullable=False)

    order = db.relationship("Order", back_populates="items")
    product = db.relationship("Product", back_populates="order_items")

    __table_args__ = (
        CheckConstraint("unit_price >= 0", name="ck_order_items_unit_price_nonnegative"),
        CheckConstraint("quantity > 0", name="ck_order_items_quantity_positive"),
    )
