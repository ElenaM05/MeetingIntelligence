import os
from motor.motor_asyncio import AsyncIOMotorClient

_client: AsyncIOMotorClient = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    return _client


def get_db():
    client = get_client()
    return client[os.getenv("MONGODB_DB", "cymonic")]


async def get_collection(name: str):
    return get_db()[name]


async def init_db():
    """Create indexes on startup."""
    db = get_db()
    await db["users"].create_index("email", unique=True)
    await db["transcripts"].create_index("user_id")
    await db["transcripts"].create_index([("user_id", 1), ("uploaded_at", -1)])
    await db["extraction_results"].create_index("transcript_id")
    await db["sessions"].create_index("user_id")
