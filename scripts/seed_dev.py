#!/usr/bin/env python
"""Development seed script — populates the QC database with starter data.

Run from the repo root:
    PYTHONPATH=server python scripts/seed_dev.py

Or inside the running server container:
    docker compose -f infra/docker-compose.dev.yml exec qc-server \
        python -c "import sys; sys.path.insert(0,'.'); exec(open('/scripts/seed_dev.py').read())"

Idempotent: skips rows whose unique key already exists.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from app.db import SessionLocal, engine
from app.models.base import Base
from app.models.user import User
from app.models.operator import Operator
from app.models.defect import DefectCategory, DefectType
from app.security import hash_password, hash_pin

Base.metadata.create_all(engine)

_CATEGORIES = [
    {"name": "Surface Defects", "display_order": 0},
    {"name": "Assembly Defects", "display_order": 1},
]

_TYPES = {
    "Surface Defects": [
        "Scratch", "Bubble", "Run", "Sag", "Orange Peel",
        "Fisheye", "Cratering", "Pinhole", "Dirt", "Blister",
    ],
    "Assembly Defects": [
        "Gap", "Misalign", "Loose Clip", "Dent", "Wrong Part",
        "Missing Fastener", "Paint Skip",
    ],
}

_OPERATORS = [
    {"name": "Mohammed", "pin": "1234"},
    {"name": "Yasmine", "pin": "5678"},
    {"name": "Karim", "pin": "0000"},
]

_ADMIN = {"email": "admin@qc.local", "password": "admin123"}


def seed():
    db = SessionLocal()
    try:
        # Admin user
        if not db.query(User).filter(User.email == _ADMIN["email"]).first():
            db.add(User(
                email=_ADMIN["email"],
                password_hash=hash_password(_ADMIN["password"]),
                role="admin",
            ))
            print(f"  + user {_ADMIN['email']}")
        else:
            print(f"  ~ user {_ADMIN['email']} (exists)")

        # Categories and types
        for cat_data in _CATEGORIES:
            cat = db.query(DefectCategory).filter(
                DefectCategory.name == cat_data["name"]
            ).first()
            if cat is None:
                cat = DefectCategory(**cat_data)
                db.add(cat)
                db.flush()
                print(f"  + category '{cat.name}'")
            else:
                print(f"  ~ category '{cat.name}' (exists)")

            for i, label in enumerate(_TYPES.get(cat.name, [])):
                exists = db.query(DefectType).filter(
                    DefectType.category_id == cat.id,
                    DefectType.label == label,
                ).first()
                if not exists:
                    db.add(DefectType(category_id=cat.id, label=label, display_order=i))
                    print(f"      + type '{label}'")

        # Operators
        for op_data in _OPERATORS:
            exists = db.query(Operator).filter(Operator.name == op_data["name"]).first()
            if not exists:
                db.add(Operator(name=op_data["name"], pin_hash=hash_pin(op_data["pin"])))
                print(f"  + operator '{op_data['name']}'")
            else:
                print(f"  ~ operator '{op_data['name']}' (exists)")

        db.commit()
        print("Seed complete.")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
