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


def publish_defect_config(payload: dict) -> None:
    _publish("qc/config/defects", payload, qos=1, retain=True)


def publish_operator_list(payload: dict) -> None:
    _publish("qc/config/operators", payload, qos=1, retain=True)


def send_device_command(device_id: str, payload: dict) -> None:
    _publish(f"qc/device/{device_id}/cmd", payload, qos=1, retain=False)
