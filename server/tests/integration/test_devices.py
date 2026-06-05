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


def test_heartbeat_registers_and_keeps_device_online(client, auth_headers, db):
    resp = client.post("/devices/heartbeat", headers=auth_headers,
                       json={"device_id": "qc-web-a1b2c3d4", "name": "Poste Peinture 1"})
    assert resp.status_code == 204
    dev = db.get(Device, "qc-web-a1b2c3d4")
    assert dev is not None
    assert dev.name == "Poste Peinture 1"
    assert dev.online is True


def test_heartbeat_refreshes_presence(client, auth_headers, db):
    db.add(Device(id="qc-web-stale", last_seen=_ago_iso(300)))
    db.commit()
    assert db.get(Device, "qc-web-stale").online is False
    resp = client.post("/devices/heartbeat", headers=auth_headers,
                       json={"device_id": "qc-web-stale"})
    assert resp.status_code == 204
    db.expire_all()
    assert db.get(Device, "qc-web-stale").online is True


def test_heartbeat_requires_auth(client):
    assert client.post("/devices/heartbeat", json={"device_id": "x"}).status_code == 401


def test_disconnect_marks_device_offline_immediately(client, auth_headers, db):
    client.post("/devices/heartbeat", headers=auth_headers, json={"device_id": "qc-web-dc"})
    db.expire_all()
    assert db.get(Device, "qc-web-dc").online is True
    resp = client.post("/devices/disconnect", headers=auth_headers, json={"device_id": "qc-web-dc"})
    assert resp.status_code == 204
    db.expire_all()
    assert db.get(Device, "qc-web-dc").online is False
