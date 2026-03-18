"""
routes/stream.py
─────────────────────────────────────────────────────────────────────────────
Server-Sent Events — Actualizaciones de hackatones en tiempo real

GET /stream/hackathons   → SSE stream de nuevas hackatones

El frontend se subscribe una vez y recibe eventos automáticamente
cuando el scraper de DoraHacks o Devfolio detecta algo nuevo.

Redis pub/sub channel: hackathons:new
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
REDIS_HACKATHONS_CHANNEL = "hackathons:new"

log = logging.getLogger("xiima.routes.stream")
router = APIRouter()


async def _sse_event(data: dict | str, event: str = "hackathon") -> str:
    """Formatea un evento SSE."""
    if isinstance(data, dict):
        data = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {data}\n\n"


async def _hackathon_stream(request: Request) -> AsyncGenerator[str, None]:
    """
    Generador SSE: suscribe a Redis pub/sub y emite eventos al cliente.
    Se cierra automáticamente si el cliente desconecta.
    """
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()

    try:
        await pubsub.subscribe(REDIS_HACKATHONS_CHANNEL)
        log.info("Cliente SSE conectado")

        # Heartbeat cada 30 segundos para mantener conexión viva
        heartbeat_interval = 30

        async def _listen():
            async for message in pubsub.listen():
                if await request.is_disconnected():
                    break
                if message["type"] == "message":
                    try:
                        hackathon = json.loads(message["data"])
                        yield await _sse_event(hackathon, event="hackathon")
                    except (json.JSONDecodeError, Exception) as exc:
                        log.warning(f"Error procesando mensaje SSE: {exc}")

        # Emitir ping inicial
        yield await _sse_event(
            {"status": "connected", "channel": REDIS_HACKATHONS_CHANNEL},
            event="ping",
        )

        # Stream de eventos con heartbeat
        async for chunk in _listen():
            yield chunk

    except asyncio.CancelledError:
        log.info("Cliente SSE desconectado")
    finally:
        await pubsub.unsubscribe(REDIS_HACKATHONS_CHANNEL)
        await pubsub.close()
        await redis_client.close()


@router.get("/hackathons")
async def stream_hackathons(request: Request):
    """
    SSE endpoint — el frontend se conecta aquí para recibir nuevas
    hackatones en tiempo real desde DoraHacks y Devfolio.

    Ejemplo de uso en JavaScript:
        const es = new EventSource('/stream/hackathons');
        es.addEventListener('hackathon', (e) => {
            const data = JSON.parse(e.data);
            console.log('Nueva hackatón:', data.title);
        });
    """
    return StreamingResponse(
        _hackathon_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",     # Nginx: deshabilitar buffering
            "Connection": "keep-alive",
        },
    )
