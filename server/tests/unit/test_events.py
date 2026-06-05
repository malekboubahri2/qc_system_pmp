import queue

import pytest

from app import events


def test_broker_delivers_to_subscribers():
    q = events.subscribe()
    try:
        events.publish("inspection", {"device_id": "qc-web"})
        ev, data = q.get_nowait()
        assert ev == "inspection"
        assert data == {"device_id": "qc-web"}
    finally:
        events.unsubscribe(q)


def test_unsubscribe_stops_delivery():
    q = events.subscribe()
    events.unsubscribe(q)
    events.publish("inspection", {})
    with pytest.raises(queue.Empty):
        q.get_nowait()


def test_publish_without_subscribers_is_noop():
    # Must not raise even when nobody is listening.
    events.publish("inspection", {"device_id": "x"})
