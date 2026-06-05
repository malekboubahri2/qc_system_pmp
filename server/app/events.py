"""Lightweight server→client event stream (SSE).

The PWA logs over REST, so the dashboard can't know a new inspection landed
without asking. This broker lets sync service code (running in FastAPI's thread
pool) notify connected dashboards, which then refetch through their normal
authenticated endpoints. Events carry no sensitive data — only a "refresh"
signal — so the stream itself needs no auth.

Single-process only (one uvicorn worker on the RPi); scaling out would need a
shared bus (e.g. Redis pub/sub).
"""
import asyncio
import json
import queue
from typing import AsyncGenerator

# Thread-safe fan-out: queue.Queue is safe to put from worker threads and get
# from the event-loop thread.
_subscribers: set[queue.Queue] = set()

_TICK = 0.25          # seconds between stream polls
_KEEPALIVE_TICKS = 60  # ~15s comment keepalive to hold the connection open


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=200)
    _subscribers.add(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    _subscribers.discard(q)


def publish(event: str, data: dict | None = None) -> None:
    """Notify all subscribers. Safe to call from sync/worker-thread code."""
    payload = (event, data or {})
    for q in list(_subscribers):
        try:
            q.put_nowait(payload)
        except queue.Full:  # a slow client — drop rather than block
            pass


async def event_stream(is_disconnected) -> AsyncGenerator[str, None]:
    """Yield SSE frames for one client until it disconnects."""
    q = subscribe()
    idle = 0
    try:
        yield ": connected\n\n"
        while not await is_disconnected():
            sent = False
            while True:
                try:
                    event, data = q.get_nowait()
                except queue.Empty:
                    break
                yield f"event: {event}\ndata: {json.dumps(data)}\n\n"
                sent = True
            if sent:
                idle = 0
            else:
                idle += 1
                if idle >= _KEEPALIVE_TICKS:
                    yield ": keepalive\n\n"
                    idle = 0
            await asyncio.sleep(_TICK)
    finally:
        unsubscribe(q)
