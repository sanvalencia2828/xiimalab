"""
Database operations for hackathon synchronization.
Handles upsert logic (update or insert) for hackathons from DoraHacks.
"""
import logging
from datetime import datetime
from typing import Any, Tuple

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from models import Hackathon

log = logging.getLogger("xiima.hackathon_db")


async def check_hackathon_exists(db: AsyncSession, hackathon_id: str) -> bool:
    """Check if a hackathon exists in the database by ID."""
    result = await db.execute(
        select(Hackathon.id).where(Hackathon.id == hackathon_id)
    )
    return result.scalar_one_or_none() is not None


async def upsert_hackathon(db: AsyncSession, hackathon_data: dict[str, Any]) -> Tuple[str, bool]:
    """
    Insert or update a hackathon record.
    
    Args:
        db: Database session
        hackathon_data: Dictionary with hackathon fields
        
    Returns:
        Tuple of (hackathon_id, was_created) where was_created is True if new record
    """
    hackathon_id = hackathon_data.get("id")
    if not hackathon_id:
        raise ValueError("Hackathon ID is required")
    
    was_created = False
    
    existing = await db.execute(
        select(Hackathon).where(Hackathon.id == hackathon_id)
    )
    existing_record = existing.scalar_one_or_none()
    
    if existing_record:
        for key, value in hackathon_data.items():
            if hasattr(existing_record, key) and key not in ["id", "created_at"]:
                setattr(existing_record, key, value)
        existing_record.updated_at = datetime.utcnow()
        log.debug(f"[DB] Updated hackathon: {hackathon_id}")
    else:
        new_record = Hackathon(**hackathon_data)
        db.add(new_record)
        was_created = True
        log.debug(f"[DB] Created hackathon: {hackathon_id}")
    
    await db.flush()
    return hackathon_id, was_created


async def bulk_upsert_hackathons(
    db: AsyncSession, 
    hackathons: list[dict[str, Any]]
) -> dict[str, int]:
    """
    Bulk insert or update multiple hackathons efficiently.
    Uses PostgreSQL upsert (ON CONFLICT) for performance.
    
    Args:
        db: Database session
        hackathons: List of hackathon dictionaries
        
    Returns:
        Dict with counts: {"created": X, "updated": Y, "total": Z}
    """
    if not hackathons:
        return {"created": 0, "updated": 0, "total": 0}
    
    created = 0
    updated = 0
    
    for hack_data in hackathons:
        hackathon_id = hack_data.get("id")
        if not hackathon_id:
            continue
            
        existing = await db.execute(
            select(Hackathon.id).where(Hackathon.id == hackathon_id)
        )
        
        if existing.scalar_one_or_none():
            stmt = (
                update(Hackathon)
                .where(Hackathon.id == hackathon_id)
                .values(
                    title=hack_data.get("title"),
                    prize_pool=hack_data.get("prize_pool", 0),
                    tags=hack_data.get("tags", []),
                    deadline=hack_data.get("deadline"),
                    match_score=hack_data.get("match_score", 0),
                    source_url=hack_data.get("source_url"),
                    source=hack_data.get("source", "dorahacks"),
                    description=hack_data.get("description"),
                    tech_stack=hack_data.get("tech_stack"),
                    difficulty=hack_data.get("difficulty"),
                    organizer=hack_data.get("organizer"),
                    city=hack_data.get("city"),
                    event_type=hack_data.get("event_type"),
                    updated_at=datetime.utcnow(),
                )
            )
            await db.execute(stmt)
            updated += 1
        else:
            new_record = Hackathon(**hack_data)
            db.add(new_record)
            created += 1
    
    await db.flush()
    
    result = {"created": created, "updated": updated, "total": created + updated}
    log.info(f"[DB] Bulk upsert complete: {created} created, {updated} updated")
    
    return result


async def get_hackathon_count(db: AsyncSession, source: str = None) -> int:
    """Get total count of hackathons, optionally filtered by source."""
    query = select(Hackathon.id)
    if source:
        query = query.where(Hackathon.source == source)
    result = await db.execute(query)
    return len(result.scalars().all())


async def delete_stale_hackathons(
    db: AsyncSession, 
    days_old: int = 90,
    source: str = "dorahacks"
) -> int:
    """
    Delete hackathons older than specified days.
    Useful for cleanup after syncing.
    """
    from datetime import timedelta
    
    cutoff_date = (datetime.utcnow() - timedelta(days=days_old)).strftime("%Y-%m-%d")
    
    result = await db.execute(
        select(Hackathon).where(
            Hackathon.source == source,
            Hackathon.deadline < cutoff_date
        )
    )
    stale = result.scalars().all()
    count = len(stale)
    
    for hack in stale:
        await db.delete(hack)
    
    await db.flush()
    
    if count > 0:
        log.info(f"[DB] Deleted {count} stale hackathons")
    
    return count
