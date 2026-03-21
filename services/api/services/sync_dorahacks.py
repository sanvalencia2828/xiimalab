"""
DoraHacks Sync Service
Coordinates scraping and database operations for hackathon synchronization.
"""
import asyncio
import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from services.dorahacks import fetch_all_dorahacks, get_mock_hackathons
from services.hackathon_db import bulk_upsert_hackathons, get_hackathon_count

log = logging.getLogger("xiima.dorahacks_sync")


async def sync_dorahacks(db: AsyncSession, use_fallback: bool = True) -> dict:
    """
    Main sync function: fetches from DoraHacks and upserts to database.
    
    Args:
        db: Database session
        use_fallback: Use mock data if scraping fails
        
    Returns:
        Dict with sync results: {created, updated, total, source}
    """
    start_time = datetime.now()
    log.info("[DoraHacks Sync] Starting sync...")
    
    try:
        hackathons = await fetch_all_dorahacks()
        
        if not hackathons and use_fallback:
            log.warning("[DoraHacks Sync] No data from API, using fallback")
            hackathons = get_mock_hackathons()
        elif not hackathons:
            return {
                "success": False,
                "created": 0,
                "updated": 0,
                "total": 0,
                "source": "none",
                "error": "No hackathons fetched and fallback disabled",
            }
        
        hackathon_dicts = [h.to_dict() for h in hackathons]
        result = await bulk_upsert_hackathons(db, hackathon_dicts)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        log.info(
            f"[DoraHacks Sync] Complete: {result['total']} total "
            f"({result['created']} created, {result['updated']} updated) "
            f"in {elapsed:.1f}s"
        )
        
        return {
            "success": True,
            "created": result["created"],
            "updated": result["updated"],
            "total": result["total"],
            "source": "live" if hackathons else "fallback",
            "elapsed_seconds": round(elapsed, 1),
        }
        
    except Exception as exc:
        log.error(f"[DoraHacks Sync] Error: {exc}")
        
        if use_fallback:
            log.info("[DoraHacks Sync] Falling back to mock data...")
            try:
                hackathons = get_mock_hackathons()
                hackathon_dicts = [h.to_dict() for h in hackathons]
                result = await bulk_upsert_hackathons(db, hackathon_dicts)
                return {
                    "success": True,
                    "created": result["created"],
                    "updated": result["updated"],
                    "total": result["total"],
                    "source": "fallback",
                    "error": str(exc),
                }
            except Exception as fallback_exc:
                log.error(f"[DoraHacks Sync] Fallback also failed: {fallback_exc}")
        
        return {
            "success": False,
            "created": 0,
            "updated": 0,
            "total": 0,
            "source": "none",
            "error": str(exc),
        }


async def scheduled_dorahacks_sync(db_session_factory):
    """
    Scheduled sync function for APScheduler.
    Called automatically every 6 hours.
    """
    from db import SessionLocal
    
    log.info("[Scheduler] Starting scheduled DoraHacks sync...")
    
    async with SessionLocal() as session:
        result = await sync_dorahacks(session)
        await session.commit()
    
    return result
