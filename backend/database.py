import os
import re
import logging

from dotenv import load_dotenv
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter
from slowapi.util import get_remote_address

load_dotenv(Path(__file__).parent / '.env')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== Env Validation ====================


def _require_env(name: str, min_length: int = 0) -> str:
    val = os.environ.get(name, "")
    if not val:
        raise RuntimeError(f"Env var {name} is required but not set")
    if min_length and len(val) < min_length:
        raise RuntimeError(f"Env var {name} must be at least {min_length} characters (got {len(val)})")
    return val


mongo_url = _require_env("MONGO_URL")
DB_NAME = _require_env("DB_NAME")
JWT_SECRET = _require_env("JWT_SECRET", min_length=32)
JWT_ALG = "HS256"

EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
PUSH_TOKEN_REGEX = re.compile(r"^(ExponentPushToken\[[A-Za-z0-9_\-]+\]|ExpoPushToken\[[A-Za-z0-9_\-]+\])$")

client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=int(os.environ.get("MONGO_MAX_POOL", "20")),
    minPoolSize=2,
    connectTimeoutMS=5000,
    serverSelectionTimeoutMS=5000,
    socketTimeoutMS=10000,
)
db = client[DB_NAME]


def month_range_query(month: str) -> dict:
    """Konversi '2025-01' menjadi range query yang bisa menggunakan index."""
    year, m = int(month.split('-')[0]), int(month.split('-')[1])
    start = f"{year}-{str(m).zfill(2)}-01"
    # Hitung akhir bulan
    next_m = m + 1 if m < 12 else 1
    next_y = year if m < 12 else year + 1
    end = f"{next_y}-{str(next_m).zfill(2)}-01"
    return {"$gte": start, "$lt": end}


limiter = Limiter(key_func=get_remote_address)
