import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')

async def check():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print(f"DB NAME: {os.environ['DB_NAME']}")
    
    # Check collections
    collections = await db.list_collection_names()
    print(f"Collections: {collections}")
    
    for coll in collections:
        count = await db[coll].count_documents({})
        print(f"Collection {coll}: {count} documents")
    
    # Check a user document structure
    user = await db.users.find_one({})
    if user:
        print(f"User keys: {user.keys()}")
    else:
        print("No users found.")

if __name__ == "__main__":
    asyncio.run(check())
