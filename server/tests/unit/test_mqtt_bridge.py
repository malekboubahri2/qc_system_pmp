from unittest.mock import MagicMock
import paho.mqtt.client as mqtt
from app.config import settings


def test_start_configures_client():
    mock_client = MagicMock(spec=mqtt.Client)
    mock_client.publish = MagicMock(return_value=MagicMock(rc=0))

    from app.mqtt.bridge import start, stop
    start(client=mock_client)

    mock_client.username_pw_set.assert_called_once_with(
        settings.mqtt_username, settings.mqtt_password
    )
    mock_client.reconnect_delay_set.assert_called_once_with(min_delay=1, max_delay=30)
    mock_client.connect_async.assert_called_once_with(
        settings.mqtt_host, settings.mqtt_port
    )
    mock_client.loop_start.assert_called_once()

    stop()
