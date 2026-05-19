import json
from loguru import logger


def _client():
    from app.mqtt.bridge import get_client
    return get_client()


def _publish(topic: str, payload: dict, *, qos: int = 1, retain: bool = False) -> None:
    client = _client()
    if client is None:
        logger.error("MQTT publish skipped — client not initialised topic={}", topic)
        return
    result = client.publish(topic, json.dumps(payload), qos=qos, retain=retain)
    if result.rc != 0:
        logger.error("MQTT publish failed topic={} rc={}", topic, result.rc)
    else:
        logger.debug("MQTT published topic={} retain={}", topic, retain)


def publish_products_config() -> None:
    from app.db import SessionLocal
    from app.models.product import Product
    from app.models.defect import DefectType
    from app.mqtt.schemas import SCHEMA_VERSION_CONFIG

    db = SessionLocal()
    try:
        products = (
            db.query(Product)
            .filter(Product.active.is_(True))
            .order_by(Product.id)
            .all()
        )
        payload_products = []
        for product in products:
            pmp_types = (
                db.query(DefectType)
                .filter(
                    DefectType.product_id == product.id,
                    DefectType.category_kind == "PMP",
                    DefectType.active.is_(True),
                )
                .order_by(DefectType.is_other_fallback, DefectType.display_order, DefectType.id)
                .all()
            )
            injection_types = (
                db.query(DefectType)
                .filter(
                    DefectType.product_id == product.id,
                    DefectType.category_kind == "INJECTION",
                    DefectType.active.is_(True),
                )
                .order_by(DefectType.is_other_fallback, DefectType.display_order, DefectType.id)
                .all()
            )

            def _type_list(types):
                return [
                    {
                        "id": t.id,
                        "label": t.label,
                        "is_other_fallback": t.is_other_fallback,
                        "display_order": t.display_order,
                    }
                    for t in types
                ]

            payload_products.append({
                "id": product.id,
                "name": product.name,
                "categories": {
                    "PMP": _type_list(pmp_types),
                    "INJECTION": _type_list(injection_types),
                },
            })
    finally:
        db.close()

    _publish(
        "qc/config/products",
        {"schema_version": SCHEMA_VERSION_CONFIG, "products": payload_products},
        qos=1,
        retain=True,
    )


def publish_operator_list() -> None:
    from app.db import SessionLocal
    from app.models.operator import Operator
    from app.mqtt.schemas import SCHEMA_VERSION_OPERATORS

    db = SessionLocal()
    try:
        operators = (
            db.query(Operator)
            .filter(Operator.active.is_(True), Operator.pin_hash.isnot(None))
            .order_by(Operator.id)
            .all()
        )
        payload_ops = [
            {"id": o.id, "name": o.name, "pin_hash": o.pin_hash}
            for o in operators
        ]
    finally:
        db.close()

    _publish(
        "qc/config/operators",
        {"schema_version": SCHEMA_VERSION_OPERATORS, "operators": payload_ops},
        qos=1,
        retain=True,
    )


def send_device_command(device_id: str, payload: dict) -> None:
    _publish(f"qc/device/{device_id}/cmd", payload, qos=1, retain=False)
