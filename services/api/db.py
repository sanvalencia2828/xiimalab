"""
Database engine and session factory — async SQLAlchemy
"""
import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

_RAW_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./xiimalab_dev.db",
)

# Normalizar URL para asyncpg / aiosqlite según el driver disponible
if _RAW_DATABASE_URL.startswith("sqlite:///"):
    DATABASE_URL = _RAW_DATABASE_URL.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
elif _RAW_DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = _RAW_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = _RAW_DATABASE_URL

# ─────────────────────────────────────────────
# Engine — parámetros distintos para SQLite vs PostgreSQL
# ─────────────────────────────────────────────
_is_sqlite = DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    from sqlalchemy.pool import StaticPool

    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,  # detect stale connections
    )

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


# ─────────────────────────────────────────────
# FastAPI dependency
# ─────────────────────────────────────────────
async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
