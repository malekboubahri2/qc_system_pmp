from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.events import event_stream

router = APIRouter(tags=["events"])


@router.get("/events")
async def events(request: Request):
    """Server-Sent Events stream of content-free refresh signals (e.g. a new
    inspection). Unauthenticated by design — it carries no data, only a nudge to
    refetch through the normal authenticated endpoints."""
    return StreamingResponse(
        event_stream(request.is_disconnected),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable proxy buffering for streaming
        },
    )
