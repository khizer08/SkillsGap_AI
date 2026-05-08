"""
MongoDB connection configuration using Motor (async MongoDB driver)
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "skillgap_ai"

client: AsyncIOMotorClient = None
database = None


async def connect_db():
    """Initialize MongoDB connection"""
    global client, database
    try:
        client = AsyncIOMotorClient(MONGO_URI)
        database = client[DB_NAME]
        # Ping to confirm connection
        await client.admin.command("ping")
        logger.info(f"Connected to MongoDB: {DB_NAME}")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        # Continue without MongoDB for development
        logger.warning("Running without MongoDB - results won't be persisted")


async def disconnect_db():
    """Close MongoDB connection"""
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")


def get_database():
    """Get the database instance"""
    return database


def get_collection(name: str):
    """Get a specific collection"""
    if database is not None:
        return database[name]
    return None
