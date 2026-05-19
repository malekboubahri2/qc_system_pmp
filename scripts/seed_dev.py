#!/usr/bin/env python3
"""Development seed script — populates the QC database with realistic fixture data.

Idempotent: each entity is looked up by its natural key before inserting;
running the script twice produces no duplicates.

Usage (from repo root):
    PYTHONPATH=server DATABASE_URL=sqlite:///server/qc-dev.db python scripts/seed_dev.py

Or inside the running server container:
    docker compose -f infra/docker-compose.dev.yml exec qc-server \
        python /workspace/scripts/seed_dev.py

Prerequisite: Alembic migrations must have run (tables must exist).
"""
import os
import random
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

# JWT_SECRET is required by app.config even though the seed script never signs
# tokens.  Set a stub so the import succeeds when running outside the container.
os.environ.setdefault("JWT_SECRET", "seed-stub-not-used-for-signing")

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models.defect import DefectLog, DefectType  # noqa: E402
from app.models.device import Device  # noqa: E402
from app.models.feature_flag import FeatureFlag  # noqa: E402
from app.models.operator import Operator  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.user import User  # noqa: E402
from app.security import hash_password, hash_pin  # noqa: E402
from app.constants import (  # noqa: E402
    CATEGORY_KIND_PMP, CATEGORY_KIND_INJECTION,
    OTHER_FALLBACK_LABEL,
)

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

_ADMIN = {"email": "admin@qc.local", "password": "admin123"}

_OPERATORS = [
    {"name": "Mohammed Benali", "pin": "1234"},
    {"name": "Karim Trabelsi",  "pin": "5678"},
    {"name": "Fatima Nasri",    "pin": None},   # supervisor — no PIN
    {"name": "Youssef Chabbi",  "pin": "9012"},
]

# 5 products with French defect catalogs per category.
# Each list may have at most 12 user-defined types (fallback is auto-added by service,
# but here we add types directly in the DB for seeding).
_PRODUCTS: list[dict] = [
    {
        "name": "Capot moteur",
        "ref": "PROD-001",
        "types": {
            CATEGORY_KIND_PMP: [
                "Coulure", "Peau d'orange", "Bullage",
                "Manque de brillance", "Séchage insuf.", "Voile",
            ],
            CATEGORY_KIND_INJECTION: [
                "Rayure surface", "Bosse", "Contamination",
                "Marque d'outil", "Porosité",
            ],
        },
    },
    {
        "name": "Cadre miroir",
        "ref": "PROD-002",
        "types": {
            CATEGORY_KIND_PMP: [
                "Coulure", "Débordement", "Épaisseur insuf.",
                "Zone non couverte", "Brillance irrégulière",
            ],
            CATEGORY_KIND_INJECTION: [
                "Rayure moulage", "Retrait matière", "Ligne de soudure",
                "Flash", "Déformation",
            ],
        },
    },
    {
        "name": "Boîtier cosmétique",
        "ref": "PROD-003",
        "types": {
            CATEGORY_KIND_PMP: [
                "Coulure", "Bullage", "Inclusion", "Voile",
                "Manque de brillance", "Séchage insuf.",
            ],
            CATEGORY_KIND_INJECTION: [
                "Rayure", "Contamination", "Retrait matière",
                "Marque d'éjecteur", "Brûlure",
            ],
        },
    },
    {
        "name": "Poignée de porte",
        "ref": "PROD-004",
        "types": {
            CATEGORY_KIND_PMP: [
                "Coulure", "Peau d'orange", "Zone non couverte",
                "Débordement", "Voile",
            ],
            CATEGORY_KIND_INJECTION: [
                "Rayure", "Porosité", "Déformation",
                "Flash", "Ligne de soudure",
            ],
        },
    },
    {
        "name": "Calandre",
        "ref": "PROD-005",
        "types": {
            CATEGORY_KIND_PMP: [
                "Coulure", "Bullage", "Manque de brillance",
                "Épaisseur insuf.", "Débordement", "Inclusion",
            ],
            CATEGORY_KIND_INJECTION: [
                "Rayure surface", "Retrait matière", "Contamination",
                "Marque d'outil", "Brûlure",
            ],
        },
    },
]

_DEVICES = [
    {"id": "qc-stm32-pilot01", "online": True},
    {"id": "qc-stm32-pilot02", "online": False},
]

_FLAGS = [
    {"name": "offline_queue",      "enabled": True,  "description": "File d'attente hors ligne pour les logs non transmis"},
    {"name": "advanced_analytics", "enabled": False, "description": "Graphiques avancés et export CSV"},
]

LOG_COUNT = 312
LOG_DAYS = 14

# hour weights (index = UTC hour) — biased toward 07:00-17:00 plant time (UTC+1)
_HOUR_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 5, 8, 10, 10, 9, 7, 9, 10, 10, 8, 5, 2, 1, 1, 1, 1, 1]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _rand_ts() -> str:
    """Random UTC timestamp in the last LOG_DAYS days, biased toward business hours."""
    delta = timedelta(seconds=random.uniform(0, LOG_DAYS * 86400))
    base = datetime.now(timezone.utc) - delta
    hour = random.choices(range(24), weights=_HOUR_WEIGHTS)[0]
    return base.replace(
        hour=hour,
        minute=random.randint(0, 59),
        second=random.randint(0, 59),
        microsecond=0,
    ).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Seed functions
# ---------------------------------------------------------------------------


def _seed_user(db) -> None:
    email = _ADMIN["email"]
    if not db.scalar(select(User).where(User.email == email)):
        db.add(User(email=email, password_hash=hash_password(_ADMIN["password"]), role="admin"))
        print(f"  + user {email}  (password: {_ADMIN['password']})")
    else:
        print(f"  ~ user {email} (exists)")


def _seed_operators(db) -> list[Operator]:
    ops: list[Operator] = []
    for data in _OPERATORS:
        op = db.scalar(select(Operator).where(Operator.name == data["name"]))
        if op is None:
            pin_hash = hash_pin(data["pin"]) if data["pin"] else None
            op = Operator(name=data["name"], pin_hash=pin_hash)
            db.add(op)
            print(f"  + operator '{data['name']}'")
        else:
            print(f"  ~ operator '{data['name']}' (exists)")
        ops.append(op)
    db.flush()
    return ops


def _seed_products(db) -> list[tuple[Product, list[DefectType]]]:
    """Returns list of (product, [all_active_defect_types_including_fallbacks])."""
    result = []
    for pdata in _PRODUCTS:
        product = db.scalar(select(Product).where(Product.name == pdata["name"]))
        if product is None:
            product = Product(name=pdata["name"])
            db.add(product)
            db.flush()
            print(f"  + product '{product.name}'")
        else:
            print(f"  ~ product '{product.name}' (exists)")

        all_types: list[DefectType] = []
        for category_kind, labels in pdata["types"].items():
            for order, label in enumerate(labels, start=1):
                dt = db.scalar(
                    select(DefectType).where(
                        DefectType.product_id == product.id,
                        DefectType.category_kind == category_kind,
                        DefectType.label == label,
                        DefectType.is_other_fallback.is_(False),
                    )
                )
                if dt is None:
                    dt = DefectType(
                        product_id=product.id,
                        category_kind=category_kind,
                        label=label,
                        is_other_fallback=False,
                        display_order=order,
                    )
                    db.add(dt)
                    print(f"      + [{category_kind}] '{label}'")
                all_types.append(dt)

            # Ensure fallback exists
            fallback = db.scalar(
                select(DefectType).where(
                    DefectType.product_id == product.id,
                    DefectType.category_kind == category_kind,
                    DefectType.is_other_fallback.is_(True),
                )
            )
            if fallback is None:
                fallback = DefectType(
                    product_id=product.id,
                    category_kind=category_kind,
                    label=OTHER_FALLBACK_LABEL,
                    is_other_fallback=True,
                    display_order=999,
                )
                db.add(fallback)
                print(f"      + [{category_kind}] fallback (auto)")
            all_types.append(fallback)

        db.flush()
        result.append((product, all_types))
    return result


def _seed_devices(db) -> list[Device]:
    devs: list[Device] = []
    for data in _DEVICES:
        dev = db.get(Device, data["id"])
        if dev is None:
            if data["online"]:
                last_seen = (datetime.now(timezone.utc) - timedelta(seconds=25)).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
            else:
                last_seen = (datetime.now(timezone.utc) - timedelta(days=3)).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
            dev = Device(id=data["id"], last_seen=last_seen, config_version=1, operator_version=1)
            db.add(dev)
            status = "online" if data["online"] else "offline"
            print(f"  + device '{data['id']}' ({status})")
        else:
            print(f"  ~ device '{data['id']}' (exists)")
        devs.append(dev)
    db.flush()
    return devs


def _seed_flags(db) -> None:
    for data in _FLAGS:
        existing = db.scalar(select(FeatureFlag).where(FeatureFlag.name == data["name"]))
        if existing is None:
            db.add(FeatureFlag(
                name=data["name"],
                enabled=data["enabled"],
                description=data["description"],
            ))
            print(f"  + flag '{data['name']}' = {data['enabled']}")
        else:
            print(f"  ~ flag '{data['name']}' (exists)")


def _seed_logs(
    db,
    operators: list[Operator],
    devices: list[Device],
    product_types: list[tuple[Product, list[DefectType]]],
) -> None:
    if db.scalar(select(DefectLog.id).limit(1)) is not None:
        print("  ~ logs exist, skipping")
        return
    logs = []
    for _ in range(LOG_COUNT):
        product, types = random.choice(product_types)
        op = random.choice([o for o in operators if o.pin_hash is not None])
        defect_type = random.choice(types)
        ts = _rand_ts()
        note = None
        if defect_type.is_other_fallback:
            note = random.choice([
                "préciser: bord droit", "préciser: coin inférieur",
                "préciser: surface centrale", "préciser: à voir avec chef",
            ])
        logs.append(DefectLog(
            device_id=random.choice(devices).id,
            operator_id=op.id,
            defect_type_id=defect_type.id,
            product_id=product.id,
            note=note,
            logged_at=ts,
            received_at=ts,
        ))
    db.add_all(logs)
    print(f"  + {LOG_COUNT} defect logs over the last {LOG_DAYS} days")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def seed() -> None:
    db = SessionLocal()
    try:
        print("Admin user:")
        _seed_user(db)
        print("Operators:")
        operators = _seed_operators(db)
        print("Products & defect types:")
        product_types = _seed_products(db)
        print("Devices:")
        devices = _seed_devices(db)
        print("Feature flags:")
        _seed_flags(db)
        print("Defect logs:")
        _seed_logs(db, operators, devices, product_types)
        db.commit()
        print("Done.")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
