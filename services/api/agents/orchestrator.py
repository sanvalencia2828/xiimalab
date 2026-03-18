"""
Xiimalab Agent Orchestrator — Coordinates communication between specialized agents.
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import AgentSignal
from agents.brain import store_memory

log = logging.getLogger("xiima.orchestrator")

class Orchestrator:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def emit_signal(self, source: str, signal_type: str, target: Optional[str] = None, payload: Optional[dict] = None):
        """Sends a signal to the orchestration bus."""
        signal = AgentSignal(
            source_agent=source,
            target_agent=target,
            signal_type=signal_type,
            payload=payload
        )
        self.db.add(signal)
        await self.db.commit()
        log.info(f"Signal emitted: {signal_type} from {source}")

    async def get_pending_signals(self, target_agent: str):
        """Retrieves unprocessed signals for a specific agent."""
        stmt = select(AgentSignal).where(
            AgentSignal.is_processed == False,
            (AgentSignal.target_agent == target_agent) | (AgentSignal.target_agent == None)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def mark_signal_processed(self, signal_id: int):
        """Flags a signal as handled."""
        stmt = update(AgentSignal).where(AgentSignal.id == signal_id).values(
            is_processed=True,
            processed_at=datetime.now(timezone.utc)
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def coordinate(self):
        """Main orchestration loop (can be called by a scheduler or background task)."""
        # Example: Link Discovery (Scout) -> Analysis (Strategist)
        # 1. Get discovery signals
        # 2. Logic to trigger Strategist...
        pass
