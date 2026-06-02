import threading
from typing import Callable
import paho.mqtt.client as mqtt
from loguru import logger
from app.config import settings

_client: mqtt.Client | None = None
_connected = threading.Event()
# Callbacks run after every successful (re)connect, from the paho network
# thread. Used to (re)publish retained config so a device that joins — or a
# broker that just lost its persistence DB — always gets current state.
_on_connect_callbacks: list[Callable[[], None]] = []


def on_connected(fn: Callable[[], None]) -> None:
    """Register a callback fired after each successful broker connection."""
    _on_connect_callbacks.append(fn)


def _on_connect(client, _userdata, _flags, reason_code, _properties):
    if reason_code == 0:
        client.subscribe("qc/device/+/status", qos=0)
        client.subscribe("qc/device/+/inspection", qos=1)
        client.subscribe("qc/device/+/session", qos=1)
        client.subscribe("qc/device/+/defect", qos=1)  # legacy (ADR-014): logged + discarded
        _connected.set()
        logger.info("MQTT connected host={}:{}", settings.mqtt_host, settings.mqtt_port)
        for cb in _on_connect_callbacks:
            try:
                cb()
            except Exception:
                logger.exception("MQTT on-connect callback failed")
    else:
        logger.warning("MQTT connect failed rc={}", reason_code)


def _on_disconnect(_client, _userdata, _flags, reason_code, _properties):
    _connected.clear()
    logger.warning("MQTT disconnected rc={}", reason_code)


def _on_message(_client, _userdata, msg: mqtt.MQTTMessage):
    from app.mqtt.handlers import dispatch
    dispatch(msg)


def start(client: mqtt.Client | None = None) -> None:
    global _client
    if client is None:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    _client = client
    _client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
    _client.reconnect_delay_set(min_delay=1, max_delay=30)
    _client.on_connect = _on_connect
    _client.on_disconnect = _on_disconnect
    _client.on_message = _on_message
    _client.connect_async(settings.mqtt_host, settings.mqtt_port)
    _client.loop_start()
    logger.info("MQTT bridge starting")


def stop() -> None:
    if _client:
        _client.loop_stop()
        _client.disconnect()
        logger.info("MQTT bridge stopped")


def get_client() -> mqtt.Client | None:
    return _client


def is_connected() -> bool:
    return _connected.is_set()
