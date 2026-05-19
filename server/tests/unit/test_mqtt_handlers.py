import json
from unittest.mock import MagicMock
import paho.mqtt.client as mqtt
from app.mqtt.handlers import dispatch
from app.models.defect import DefectLog, DefectType
from app.models.device import Device
from app.models.operator import Operator
from app.models.product import Product
from app.security import hash_pin


def _make_msg(topic: str, payload: dict) -> mqtt.MQTTMessage:
    msg = MagicMock(spec=mqtt.MQTTMessage)
    msg.topic = topic
    msg.payload = json.dumps(payload).encode()
    return msg


def _seed_defect_prerequisites(db):
    device = Device(id="qc-stm32-001")
    op = Operator(name="Test Op", pin_hash=hash_pin("1234"))
    product = Product(name="Test Product")
    db.add_all([device, op, product])
    db.flush()
    dt = DefectType(
        product_id=product.id,
        category_kind="PMP",
        label="Scratch",
        is_other_fallback=False,
        display_order=0,
    )
    db.add(dt)
    db.commit()
    db.refresh(op)
    db.refresh(dt)
    db.refresh(product)
    return op, dt, product


def test_handle_defect_writes_log(db):
    op, dt, product = _seed_defect_prerequisites(db)
    msg = _make_msg(
        "qc/device/qc-stm32-001/defect",
        {
            "schema_version": 2,
            "device_id": "qc-stm32-001",
            "operator_id": op.id,
            "defect_type_id": dt.id,
            "product_id": product.id,
            "logged_at": "2026-05-19T10:00:00Z",
        },
    )
    dispatch(msg)
    db.expire_all()
    log = db.query(DefectLog).first()
    assert log is not None
    assert log.device_id == "qc-stm32-001"
    assert log.product_id == product.id
    assert log.operator_id == op.id
    assert log.note is None


def test_handle_defect_stores_note(db):
    op, dt, product = _seed_defect_prerequisites(db)
    msg = _make_msg(
        "qc/device/qc-stm32-001/defect",
        {
            "schema_version": 2,
            "device_id": "qc-stm32-001",
            "operator_id": op.id,
            "defect_type_id": dt.id,
            "product_id": product.id,
            "note": "bord gauche",
            "logged_at": "2026-05-19T10:00:00Z",
        },
    )
    dispatch(msg)
    db.expire_all()
    log = db.query(DefectLog).first()
    assert log.note == "bord gauche"


def test_handle_status_upserts_device(db):
    msg = _make_msg(
        "qc/device/qc-stm32-new/status",
        {
            "schema_version": 1,
            "device_id": "qc-stm32-new",
            "uptime_ms": 60000,
            "config_version": 2,
            "operator_version": 1,
            "queue_depth": 0,
            "wifi_rssi": -55,
            "mqtt_reconnects": 0,
        },
    )
    dispatch(msg)
    db.expire_all()
    device = db.get(Device, "qc-stm32-new")
    assert device is not None
    assert device.config_version == 2
    assert device.last_seen is not None


def test_handle_status_updates_existing_device(db):
    db.add(Device(id="qc-stm32-001", config_version=1, operator_version=1))
    db.commit()

    msg = _make_msg(
        "qc/device/qc-stm32-001/status",
        {
            "schema_version": 1,
            "device_id": "qc-stm32-001",
            "uptime_ms": 120000,
            "config_version": 3,
            "operator_version": 2,
            "queue_depth": 5,
            "wifi_rssi": -60,
            "mqtt_reconnects": 1,
        },
    )
    dispatch(msg)
    db.expire_all()
    device = db.get(Device, "qc-stm32-001")
    assert device.config_version == 3
    assert device.operator_version == 2


def test_handle_session_logged(db, caplog):
    msg = _make_msg(
        "qc/device/qc-stm32-001/session",
        {
            "schema_version": 1,
            "device_id": "qc-stm32-001",
            "operator_id": 1,
            "product_id": 1,
            "started_at": "2026-05-19T08:00:00Z",
        },
    )
    dispatch(msg)  # must not raise


def test_bad_json_ignored():
    msg = MagicMock(spec=mqtt.MQTTMessage)
    msg.topic = "qc/device/qc-stm32-001/defect"
    msg.payload = b"not-json"
    dispatch(msg)  # must not raise


def test_unknown_schema_version_discarded(db):
    msg = _make_msg(
        "qc/device/qc-stm32-001/defect",
        {
            "schema_version": 99,
            "device_id": "qc-stm32-001",
            "operator_id": 1,
            "defect_type_id": 1,
            "product_id": 1,
            "logged_at": "2026-05-19T10:00:00Z",
        },
    )
    dispatch(msg)
    assert db.query(DefectLog).count() == 0
