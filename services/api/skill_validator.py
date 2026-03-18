"""
skill_validator.py — Xiimalab
Valida los hitos de competencia del usuario y, al cumplirse ambos,
marca el Claimable Balance como liberado para que el usuario lo reclame.

Hitos requeridos (ambos deben cumplirse):
  - Trigger AURA:      aura_milestone_count >= AURA_REQUIRED_COUNT
  - Trigger Hackathon: hackathon_id IS NOT NULL

API endpoints expuestos:
  POST /skills/progress          → registrar progreso de AURA o hackathon
  GET  /skills/escrow/{email}    → estado del escrow del usuario
  POST /skills/validate/{email}  → forzar re-validación (admin o cron)
"""

import logging
import os
from enum import Enum

import asyncpg
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/skills", tags=["skill-validation"])

DATABASE_URL = os.environ["DATABASE_URL"]
AURA_REQUIRED_COUNT = int(os.getenv("AURA_REQUIRED_COUNT", "10"))


# ─── Modelos ──────────────────────────────────────────────────────────────────

class MilestoneType(str, Enum):
    aura_image = "aura_image"
    hackathon = "hackathon"


class ProgressPayload(BaseModel):
    buyer_email:    EmailStr
    milestone_type: MilestoneType
    # Para hackathon: ID del hackathon scrapeado
    hackathon_id:   str | None = None


class EscrowStatus(BaseModel):
    buyer_email:          str
    skill_tag:            str
    escrow_status:        str
    aura_milestone_count: int
    hackathon_id:         str | None
    stellar_balance_id:   str
    xlm_amount:           float
    aura_complete:        bool
    hackathon_complete:   bool
    fully_unlocked:       bool


# ─── Helpers de DB ────────────────────────────────────────────────────────────

async def _get_escrow(conn: asyncpg.Connection, email: str) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """
        SELECT id, buyer_email, skill_tag, escrow_status,
               aura_milestone_count, hackathon_id,
               stellar_balance_id, xlm_amount
        FROM   educational_escrows
        WHERE  buyer_email = $1
          AND  escrow_status NOT IN ('claimed', 'expired')
        ORDER  BY created_at DESC
        LIMIT  1
        """,
        email,
    )


async def _update_escrow_status(conn: asyncpg.Connection, escrow_id: int, status: str) -> None:
    await conn.execute(
        "UPDATE educational_escrows SET escrow_status = $1, updated_at = NOW() WHERE id = $2",
        status,
        escrow_id,
    )


# ─── Lógica de validación ─────────────────────────────────────────────────────

async def _evaluate_milestones(escrow: asyncpg.Record) -> tuple[bool, bool, bool]:
    """
    Retorna (aura_complete, hackathon_complete, fully_unlocked).
    """
    aura_ok = (escrow["aura_milestone_count"] or 0) >= AURA_REQUIRED_COUNT
    hackathon_ok = escrow["hackathon_id"] is not None
    return aura_ok, hackathon_ok, (aura_ok and hackathon_ok)


async def validate_and_release(email: str) -> EscrowStatus:
    """
    Núcleo del validador. Verifica hitos y actualiza el estado del escrow.
    Si ambos hitos están completos → escrow_status = 'releasable'.
    """
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        escrow = await _get_escrow(conn, email)
        if not escrow:
            raise HTTPException(status_code=404, detail="No hay escrow activo para este email")

        aura_ok, hackathon_ok, unlocked = await _evaluate_milestones(escrow)

        if unlocked and escrow["escrow_status"] == "pending":
            await _update_escrow_status(conn, escrow["id"], "releasable")
            logger.info("Escrow %s liberado para %s", escrow["id"], email)

        current_status = "releasable" if unlocked else escrow["escrow_status"]

        return EscrowStatus(
            buyer_email=email,
            skill_tag=escrow["skill_tag"],
            escrow_status=current_status,
            aura_milestone_count=escrow["aura_milestone_count"] or 0,
            hackathon_id=escrow["hackathon_id"],
            stellar_balance_id=escrow["stellar_balance_id"],
            xlm_amount=float(escrow["xlm_amount"]),
            aura_complete=aura_ok,
            hackathon_complete=hackathon_ok,
            fully_unlocked=unlocked,
        )
    finally:
        await conn.close()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/progress")
async def register_progress(payload: ProgressPayload):
    """
    Registra el avance del usuario en un hito.

    - aura_image:  incrementa aura_milestone_count en 1
    - hackathon:   guarda el hackathon_id (debe existir en la tabla hackathons)

    Después de cada registro, se re-evalúa el estado del escrow automáticamente.
    """
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        escrow = await _get_escrow(conn, payload.buyer_email)
        if not escrow:
            raise HTTPException(
                status_code=404,
                detail="No hay escrow activo para este usuario",
            )

        if payload.milestone_type == MilestoneType.aura_image:
            new_count = await conn.fetchval(
                """
                UPDATE educational_escrows
                SET    aura_milestone_count = aura_milestone_count + 1,
                       updated_at = NOW()
                WHERE  id = $1
                RETURNING aura_milestone_count
                """,
                escrow["id"],
            )
            logger.debug("AURA count para %s: %d", payload.buyer_email, new_count)

        elif payload.milestone_type == MilestoneType.hackathon:
            if not payload.hackathon_id:
                raise HTTPException(status_code=422, detail="hackathon_id requerido")

            # Verificar que el hackathon existe en nuestra DB scrapeada
            exists = await conn.fetchval(
                "SELECT 1 FROM hackathons WHERE id = $1", payload.hackathon_id
            )
            if not exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Hackathon '{payload.hackathon_id}' no encontrado en el portal",
                )

            await conn.execute(
                """
                UPDATE educational_escrows
                SET    hackathon_id = $1,
                       updated_at = NOW()
                WHERE  id = $2
                """,
                payload.hackathon_id,
                escrow["id"],
            )
    finally:
        await conn.close()

    # Re-evaluar automáticamente tras cada progreso
    status = await validate_and_release(payload.buyer_email)
    return {
        "registered": payload.milestone_type,
        "escrow": status,
        "message": (
            "Ambos hitos completos — el reembolso está disponible para reclamar en tu wallet Stellar."
            if status.fully_unlocked
            else "Progreso registrado. Pendiente: "
                 + ([] if status.aura_complete else [f"AURA ({status.aura_milestone_count}/{AURA_REQUIRED_COUNT} imágenes)"])
                 + ([] if status.hackathon_complete else ["participación en hackathon"])
        ),
    }


@router.get("/escrow/{email}", response_model=EscrowStatus)
async def get_escrow_status(email: str):
    """Consulta el estado actual del escrow y los hitos del usuario."""
    return await validate_and_release(email)


@router.post("/validate/{email}", response_model=EscrowStatus)
async def force_validate(email: str):
    """
    Re-validación manual (llamada por el cron job o por admins).
    Útil si los hitos se actualizaron directamente en DB.
    """
    return await validate_and_release(email)
