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
from app.models.defect import InspectionLog, DefectType  # noqa: E402
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
# Low-privilege account the inspection tablet (PWA) authenticates as.
_STATION = {"email": "station@qc.local", "password": "station123", "role": "station"}

_OPERATORS = [
    {"name": "Mohammed Benali", "pin": "1234"},
    {"name": "Karim Trabelsi",  "pin": "5678"},
    {"name": "Fatima Nasri",    "pin": None},   # supervisor — no PIN
    {"name": "Youssef Chabbi",  "pin": "9012"},
]

# Paper taxonomy from SVI-PRD-17 (PMP 7 types, INJECTION 10 types).
# Applied to every product so the demo dashboard shows realistic totals.
_PMP_TYPES = [
    "Poussière", "Griffure", "Trace", "Filament",
    "Manque matière", "Coulure matière", "Pt brillant",
]
_INJ_TYPES = [
    "Givrage", "Trace d'huile", "Rayure", "Brillance", "Tache",
    "Bavure", "Flux", "Effet de bord", "Ventouse", "Coup",
]

_PRODUCTS: list[dict] = [
    {"name": "Capot moteur",      "ref": "PROD-001"},
    {"name": "Cadre miroir",      "ref": "PROD-002"},
    {"name": "Boîtier cosmétique","ref": "PROD-003"},
    {"name": "Poignée de porte",  "ref": "PROD-004"},
    {"name": "Calandre",          "ref": "PROD-005"},
]

_DEVICES = [
    {"id": "qc-stm32-pilot01", "online": True},
    {"id": "qc-stm32-pilot02", "online": False},
]

_FLAGS = [
    {"name": "offline_queue",      "enabled": True,  "description": "File d'attente hors ligne pour les logs non transmis"},
    {"name": "advanced_analytics", "enabled": False, "description": "Graphiques avancés et export CSV"},
]

LOG_COUNT = 420     # ~30% OK, ~70% DEFECT, spread across LOG_DAYS
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
    for u in (_ADMIN, _STATION):
        email = u["email"]
        if not db.scalar(select(User).where(User.email == email)):
            db.add(User(
                email=email,
                password_hash=hash_password(u["password"]),
                role=u.get("role", "admin"),
            ))
            print(f"  + user {email}  (password: {u['password']}, role: {u.get('role', 'admin')})")
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
        for category_kind, labels in [
            (CATEGORY_KIND_PMP, _PMP_TYPES),
            (CATEGORY_KIND_INJECTION, _INJ_TYPES),
        ]:
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
    if db.scalar(select(InspectionLog.id).limit(1)) is not None:
        print("  ~ inspection logs exist, skipping")
        return
    logs = []
    defect_count = 0
    ok_count = 0
    for _ in range(LOG_COUNT):
        product, types = random.choice(product_types)
        op = random.choice([o for o in operators if o.pin_hash is not None])
        ts = _rand_ts()

        # ~70% DEFECT, ~30% OK
        if random.random() < 0.70:
            defect_type = random.choice(types)
            note = None
            if defect_type.is_other_fallback:
                note = random.choice([
                    "préciser: bord droit", "préciser: coin inférieur",
                    "préciser: surface centrale", "préciser: à voir avec chef",
                ])
            logs.append(InspectionLog(
                device_id=random.choice(devices).id,
                operator_id=op.id,
                defect_type_id=defect_type.id,
                product_id=product.id,
                outcome="DEFECT",
                note=note,
                logged_at=ts,
                received_at=ts,
            ))
            defect_count += 1
        else:
            logs.append(InspectionLog(
                device_id=random.choice(devices).id,
                operator_id=op.id,
                defect_type_id=None,
                product_id=product.id,
                outcome="OK",
                logged_at=ts,
                received_at=ts,
            ))
            ok_count += 1
    db.add_all(logs)
    print(
        f"  + {LOG_COUNT} inspection logs over the last {LOG_DAYS} days "
        f"({defect_count} DEFECT, {ok_count} OK)"
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def seed() -> None:
    # Fake devices + fake inspection logs are demo-only fixtures. They are
    # opt-in so seeding a real/demo DB loads only genuine config (users,
    # operators, products, defect types, flags) and never injects phantom
    # stations or history. Enable with SEED_DEMO_TELEMETRY=1 for local dev
    # without hardware.
    seed_telemetry = os.environ.get("SEED_DEMO_TELEMETRY", "0").lower() in ("1", "true", "yes")
    db = SessionLocal()
    try:
        print("Admin user:")
        _seed_user(db)
        print("Operators:")
        operators = _seed_operators(db)
        print("Products & defect types (paper taxonomy SVI-PRD-17):")
        product_types = _seed_products(db)
        print("Feature flags:")
        _seed_flags(db)
        if seed_telemetry:
            print("Devices (demo):")
            devices = _seed_devices(db)
            print("Inspection logs (demo):")
            _seed_logs(db, operators, devices, product_types)
        else:
            print("Skipping demo devices + logs (set SEED_DEMO_TELEMETRY=1 to include).")
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
