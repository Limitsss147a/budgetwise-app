import bcrypt
import jwt
import random
import re
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Request

from database import db, JWT_SECRET, JWT_ALG


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}, JWT_SECRET, algorithm=JWT_ALG)


def create_refresh_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30), "type": "refresh"}, JWT_SECRET, algorithm=JWT_ALG)


def generate_recovery_key() -> str:
    return "BDGT-" + "-".join(''.join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", k=4)) for _ in range(2))


def extract_tags(text: str) -> list[str]:
    if not text:
        return []
    return [match.strip("#").lower() for match in re.findall(r'#\w+', text)]


async def get_current_user(request: Request) -> dict:
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
