"""Build and publish MQTT config payloads after DB mutations.

Called by service modules after committing. On publish failure we log
and continue — the DB is the source of truth; MQTT is best-effort delivery.
"""
from loguru import logger
from sqlalchemy.orm import Session


def publish_defect_config(db: Session) -> None:
    from app.models.defect import DefectCategory, DefectType
    from app.mqtt import publisher
    from app.mqtt.schemas import SCHEMA_VERSION_CONFIG

    categories = (
        db.query(DefectCategory)
        .filter(DefectCategory.active.is_(True))
        .order_by(DefectCategory.display_order, DefectCategory.id)
        .all()
    )
    payload_cats = []
    for cat in categories:
        types = (
            db.query(DefectType)
            .filter(DefectType.category_id == cat.id, DefectType.active.is_(True))
            .order_by(DefectType.display_order, DefectType.id)
            .all()
        )
        payload_cats.append({
            "id": cat.id,
            "name": cat.name,
            "display_order": cat.display_order,
            "defects": [
                {"id": t.id, "label": t.label, "display_order": t.display_order}
                for t in types
            ],
        })

    try:
        publisher.publish_defect_config({
            "schema_version": SCHEMA_VERSION_CONFIG,
            "categories": payload_cats,
        })
    except Exception as exc:
        logger.error("MQTT defect config publish failed: {}", exc)


def publish_operator_list(db: Session) -> None:
    from app.models.operator import Operator
    from app.mqtt import publisher
    from app.mqtt.schemas import SCHEMA_VERSION_OPERATORS

    operators = (
        db.query(Operator)
        .filter(Operator.active.is_(True))
        .order_by(Operator.id)
        .all()
    )
    try:
        publisher.publish_operator_list({
            "schema_version": SCHEMA_VERSION_OPERATORS,
            "operators": [
                {"id": o.id, "name": o.name, "pin_hash": o.pin_hash}
                for o in operators
            ],
        })
    except Exception as exc:
        logger.error("MQTT operator list publish failed: {}", exc)
