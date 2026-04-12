from __future__ import annotations

from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "orders_control.sqlite3"
ALLOWED_UNITS = ("u.", "m2", "ml", "cm2", "g")
ALLOWED_PAYMENT_METHODS = ("Efectivo", "Transferencia")
ALLOWED_PRODUCT_CATEGORIES = (
    "Primaria",
    "Secundaria",
    "Libreria",
    "HouseOfCraft",
    "CordobaStickers",
)
