"""
Notifier Agent — Watches agent_signals and triggers UI effects for high-value events.
"""
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import AgentSignal
from agents.orchestrator import Orchestrator

log = logging.getLogger("xiima.notifier_agent")

class NotifierAgent:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.orchestrator = Orchestrator(db)

    async def watch_signals(self):
        """Polls for new high-priority signals and triggers visual effects or notifications."""
        # Look for strategist signals with high match scores or golden project matches
        stmt = select(AgentSignal).where(
            AgentSignal.signal_type.in_(["analysis_complete", "golden_project_match"]),
            AgentSignal.is_processed == False
        )
        result = await self.db.execute(stmt)
        signals = result.scalars().all()

        from models import HackathonNotification

        for signal in signals:
            payload = signal.payload or {}
            
            if signal.signal_type == "golden_project_match":
                hackathon_id = payload.get("hackathon_id")
                # Since UserProject doesn't have wallet_address, default to a known value or infer
                wallet_address = payload.get("wallet_address", "default_user_wallet")
                
                # Create a real notification
                notification = HackathonNotification(
                    wallet_address=wallet_address,
                    hackathon_id=hackathon_id,
                    notification_type="golden_match",
                    message=f"🌟 Golden Match Detectado! {payload.get('match_pct', 0)}% afinidad con tu proyecto: {payload.get('project_title')}"
                )
                self.db.add(notification)
                log.info(f"Golden Project Match detectado y guardado como notificacion para {wallet_address}")
            else:
                strategic_category = payload.get("strategic_category", "")

                # Check if this is a "Golden Opportunity" (>90% match)
                if "Golden Opportunity" in strategic_category or payload.get("match_score", 0) > 90:
                    log.info(f"Golden Opportunity detected for hackathon {payload.get('hackathon_id')}")

                    # Emit a UI effect signal (this would be picked up by the frontend)
                    await self.orchestrator.emit_signal(
                        source="notifier",
                        signal_type="golden_opportunity_detected",
                        target="frontend",  # This would be a special target for UI effects
                        payload={
                            "hackathon_id": payload.get("hackathon_id"),
                            "message": "¡Oportunidad Dorada Detectada!",
                            "effect": "particles"  # Frontend knows to show particle effect
                        }
                    )

            # Mark signal as processed
            await self.orchestrator.mark_signal_processed(signal.id)
            
        await self.db.commit()