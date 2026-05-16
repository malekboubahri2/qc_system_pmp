from unittest.mock import patch


def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_detailed_returns_full_schema(client):
    response = client.get("/health/detailed")
    assert response.status_code == 200
    body = response.json()
    assert body["db"] == "ok"
    assert "mqtt_broker" in body
    assert "devices" in body
    assert "config_version" in body
    assert "status" in body


def test_health_detailed_db_ok(client):
    response = client.get("/health/detailed")
    assert response.status_code == 200
    body = response.json()
    assert body["db"] == "ok"


def test_health_detailed_status_degraded_when_mqtt_down(client):
    with patch("app.routers.health.mqtt_bridge.is_connected", return_value=False):
        response = client.get("/health/detailed")
    assert response.status_code == 200
    body = response.json()
    assert body["mqtt_broker"] == "disconnected"
    assert body["status"] == "degraded"
