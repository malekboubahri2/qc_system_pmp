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
import hashlib
import os
import random
import secrets
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

# JWT_SECRET is required by app.config even though the seed script never signs
# tokens.  Set a stub so the import succeeds when running outside the container.
os.environ.setdefault("JWT_SECRET", "seed-stub-not-used-for-signing")

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models.defect import DefectCategory, DefectLog, DefectType  # noqa: E402
from app.models.device import Device  # noqa: E402
from app.models.feature_flag import FeatureFlag  # noqa: E402
from app.models.operator import Operator  # noqa: E402
from app.models.user import User  # noqa: E402
from app.security import hash_password, hash_pin  # noqa: E402

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

_CATEGORIES: list[dict] = [
    {
        "name": "Peinture",
        "display_order": 1,
        "types": ["Coulure", "Peau d'orange", "Bullage", "Manque de brillance", "Séchage insuf."],
    },
    {
        "name": "Surface",
        "display_order": 2,
        "types": ["Rayure", "Bosse", "Contamination", "Marque d'outil"],
    },
    {
        "name": "Application",
        "display_order": 3,
        "types": ["Zone non couverte", "Épaisseur insuf.", "Débordement"],
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

_PRODUCT_REFS = [f"LOT-2026-{n:03d}" for n in range(1, 21)]

LOG_COUNT = 200
LOG_DAYS = 30

# hour weights (index = UTC hour) — biased toward 07:00-17:00 plant time (UTC+1)
_HOUR_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 5, 8, 10, 10, 9, 7, 9, 10, 10, 8, 5, 2, 1, 1, 1, 1, 1]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


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
# Seed functions (each returns the list of ORM objects it touched)
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


def _seed_categories(db) -> list[DefectType]:
    all_types: list[DefectType] = []
    for cat_data in _CATEGORIES:
        cat = db.scalar(select(DefectCategory).where(DefectCategory.name == cat_data["name"]))
        if cat is None:
            cat = DefectCategory(name=cat_data["name"], display_order=cat_data["display_order"])
            db.add(cat)
            db.flush()
            print(f"  + category '{cat.name}'")
        else:
            print(f"  ~ category '{cat.name}' (exists)")
        for order, label in enumerate(cat_data["types"], start=1):
            dt = db.scalar(
                select(DefectType).where(DefectType.category_id == cat.id, DefectType.label == label)
            )
            if dt is None:
                dt = DefectType(category_id=cat.id, label=label, display_order=order)
                db.add(dt)
                print(f"      + type '{label}'")
            all_types.append(dt)
    db.flush()
    return all_types


def _seed_devices(db) -> list[Device]:
    devs: list[Device] = []
    for data in _DEVICES:
        dev = db.get(Device, data["id"])
        if dev is None:
            if data["online"]:
                last_seen = (datetime.now(timezone.utc) - timedelta(seconds=25)).strftime("%Y-%m-%dT%H:%M:%SZ")
            else:
                last_seen = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
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
            db.add(FeatureFlag(name=data["name"], enabled=data["enabled"], description=data["description"]))
            print(f"  + flag '{data['name']}' = {data['enabled']}")
        else:
            print(f"  ~ flag '{data['name']}' (exists)")


def _seed_logs(db, operators: list[Operator], devices: list[Device], defect_types: list[DefectType]) -> None:
    if db.scalar(select(DefectLog.id).limit(1)) is not None:
        print(f"  ~ logs exist, skipping")
        return
    logs = [
        DefectLog(
            device_id=random.choice(devices).id,
            operator_id=random.choice(operators).id,
            defect_type_id=random.choice(defect_types).id,
            product_ref=random.choice(_PRODUCT_REFS),
            logged_at=_rand_ts(),
            received_at=_rand_ts(),
        )
        for _ in range(LOG_COUNT)
    ]
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
        print("Categories & types:")
        defect_types = _seed_categories(db)
        print("Devices:")
        devices = _seed_devices(db)
        print("Feature flags:")
        _seed_flags(db)
        print("Defect logs:")
        _seed_logs(db, operators, devices, defect_types)
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
