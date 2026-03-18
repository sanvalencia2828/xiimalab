import asyncio
import sys
import os
import json

# Add services/api to path
sys.path.append(os.path.join(os.getcwd(), 'services', 'api'))

from models import UserProject, Base
from db import engine

async def seed():
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import select

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check if already exists
        result = await session.execute(select(UserProject).where(UserProject.title == 'regen-buddy'))
        if result.scalars().first():
            print("Project regen-buddy already exists in DB.")
            return

        project = UserProject(
            title="regen-buddy",
            repo_url="https://github.com/sanvalencia2828/regen-buddy",
            description="Herramienta de finanzas regenerativas (ReFi) enfocada en el impacto ecológico y la coordinación comunitaria.",
            stack=["Web3", "Stellar", "Python", "Next.js"],
            impact_score=85
        )
        session.add(project)
        await session.commit()
        print("Successfully seeded regen-buddy into user_projects.")

if __name__ == "__main__":
    asyncio.run(seed())
