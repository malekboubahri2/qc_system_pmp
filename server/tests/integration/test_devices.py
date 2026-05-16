from datetime import datetime, timedelta, timezone
from app.models.device import Device


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _ago_iso(seconds: int) -> str:
    dt = datetime.now(timezone.utc) - timedelta(seconds=seconds)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def test_device_online_true_when_recently_seen(db):
    dev = Device(id="qc-stm32-aabbccdd", last_seen=_ago_iso(10))
    db.add(dev)
    db.commit()
    db.refresh(dev)
    assert dev.online is True


def test_device_online_false_when_stale(db):
    dev = Device(id="qc-stm32-11223344", last_seen=_ago_iso(120))
    db.add(dev)
    db.commit()
    db.refresh(dev)
    assert dev.online is False


def test_device_online_false_when_never_seen(db):
    dev = Device(id="qc-stm32-00000000")
    db.add(dev)
    db.commit()
    db.refresh(dev)
    assert dev.online is False


def test_list_devices_includes_online_field(client, auth_headers, db):
    db.add(Device(id="qc-stm32-deadbeef", last_seen=_ago_iso(5)))
    db.commit()
    resp = client.get("/devices", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert "online" in body[0]
    assert body[0]["online"] is True
