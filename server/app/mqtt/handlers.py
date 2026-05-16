import json
from loguru import logger
import paho.mqtt.client as mqtt

_handlers: dict[str, callable] = {}


def _topic_matches(pattern: str, topic: str) -> bool:
    p, t = pattern.split("/"), topic.split("/")
    if len(p) != len(t) and p[-1] != "#":
        return False
    for pp, tp in zip(p, t):
        if pp == "#":
            return True
        if pp != "+" and pp != tp:
            return False
    return len(p) == len(t)


def register(pattern: str):
    def decorator(fn):
        _handlers[pattern] = fn
        return fn
    return decorator


def dispatch(msg: mqtt.MQTTMessage) -> None:
    try:
        payload = json.loads(msg.payload.decode())
    except Exception as exc:
        logger.warning("MQTT bad payload topic={} err={}", msg.topic, exc)
        return
    for pattern, handler in _handlers.items():
        if _topic_matches(pattern, msg.topic):
            try:
                handler(msg.topic, payload)
            except Exception:
                logger.exception("MQTT handler error topic={}", msg.topic)
            return
    logger.debug("MQTT no handler for topic={}", msg.topic)


@register("qc/device/+/status")
def _handle_status(topic: str, payload: dict) -> None:
    logger.debug("device status topic={}", topic)


@register("qc/device/+/defect")
def _handle_defect(topic: str, payload: dict) -> None:
    logger.debug("device defect topic={}", topic)
