from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

# One asyncio.Queue per connected SSE client.
# When a risk run is created, broadcast() pushes the event to every queue.
_subscribers: list[asyncio.Queue[dict[str, Any]]] = []


async def broadcast(event: dict[str, Any]) -> None:
    """Push a new event to all connected SSE clients."""
    for queue in _subscribers:
        await queue.put(event)


async def event_stream() -> AsyncGenerator[str, None]:
    """Async generator that yields SSE-formatted strings to a connected client.

    Each risk run creation sends a 'data: {...}\\n\\n' frame.
    A keep-alive comment is sent every 15 seconds so the connection stays open.
    """
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    _subscribers.append(queue)
    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                # Send a comment line to keep the connection alive
                yield ": keep-alive\n\n"
    finally:
        _subscribers.remove(queue)
