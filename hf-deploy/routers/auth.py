import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from database import db, limiter, EMAIL_REGEX, JWT_SECRET, JWT_ALG
from models import AuthRegister, AuthLogin, ForgotPassword
from auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    generate_recovery_key, get_current_user
)
import jwt

router = APIRouter()


@router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, data: AuthRegister):
    email = data.email.lower().strip()
    name = data.name.strip()
    if not EMAIL_REGEX.match(email):
        raise HTTPException(400, "Format email tidak valid")
    if not name or len(name) > 80:
        raise HTTPException(400, "Nama wajib diisi (maks 80 karakter)")
    if len(data.password) < 8:
        raise HTTPException(400, "Password minimal 8 karakter")
    if not re.search(r"[A-Za-z]", data.password) or not re.search(r"\d", data.password):
        raise HTTPException(400, "Password harus mengandung huruf dan angka")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    recovery_key = generate_recovery_key()
    await db.users.insert_one({"id": user_id, "email": email, "password_hash": hash_password(data.password), "recovery_key_hash": hash_password(recovery_key), "name": name, "role": "user", "created_at": now})
    await db.settings.insert_one({"user_id": user_id, "currency": "IDR", "theme": "light", "pin_hash": ""})
    
    # Create default wallet for new user
    await db.wallets.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": "Wallet Utama",
        "type": "bank",
        "initial_balance": 0.0,
        "color": "#10B981",
        "icon": "wallet",
        "is_default": True,
        "created_at": now,
        "updated_at": now
    })
    
    return {"user": {"id": user_id, "email": email, "name": data.name.strip(), "role": "user"}, "access_token": create_access_token(user_id, email), "refresh_token": create_refresh_token(user_id), "recovery_key": recovery_key}


@router.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, data: AuthLogin):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Email atau password salah")
    uid = user["id"]
    return {"user": {"id": uid, "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "user")}, "access_token": create_access_token(uid, user["email"]), "refresh_token": create_refresh_token(uid)}


@router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"user": user}


@router.post("/auth/refresh")
async def refresh_token(request: Request):
    token = (await request.json()).get("refresh_token", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return {"access_token": create_access_token(user["id"], user["email"])}
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise HTTPException(401, "Token expired")


@router.post("/auth/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, data: ForgotPassword):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(400, "Email atau Recovery Key salah")
    if "recovery_key_hash" not in user:
        raise HTTPException(400, "Akun ini belum memiliki recovery key. Tidak bisa di-reset.")
    
    rk = data.recovery_key.upper().strip()
    if not verify_password(rk, user["recovery_key_hash"]):
        raise HTTPException(400, "Email atau Recovery Key salah")
    
    if len(data.new_password) < 8 or not re.search(r"[A-Za-z]", data.new_password) or not re.search(r"\d", data.new_password):
        raise HTTPException(400, "Password baru minimal 8 karakter dan mengandung huruf serta angka")
    
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(data.new_password)}})
    return {"message": "Password berhasil diubah"}


@router.post("/auth/recovery-key/generate")
@limiter.limit("5/minute")
async def generate_new_recovery_key(request: Request, user: dict = Depends(get_current_user)):
    new_key = generate_recovery_key()
    await db.users.update_one({"id": user["id"]}, {"$set": {"recovery_key_hash": hash_password(new_key)}})
    return {"recovery_key": new_key, "message": "Recovery key baru berhasil dibuat"}
