"""
Database configuration and connection for ChronoGann
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import pool

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_j8nbKe5Ofmus@ep-floral-breeze-aqb26u6x.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

# Convert to async URL for asyncpg
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    poolclass=pool.NullPool,  # Use NullPool for serverless
)

async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    """Dependency for FastAPI to provide database session"""
    async with async_session() as session:
        yield session
