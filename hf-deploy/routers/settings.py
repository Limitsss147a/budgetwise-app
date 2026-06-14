import bcrypt

from fastapi import APIRouter, Depends, HTTPException

from database import db, PUSH_TOKEN_REGEX
from models import SettingsUpdate, PushTokenRequest, PinRequest
from auth import get_current_user

router = APIRouter()


@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not s:
        s = {"user_id": user["id"], "currency": "IDR", "theme": "light", "pin_hash": "",
             "weekly_report_enabled": False, "weekly_report_day": 1, "weekly_report_hour": 9, "push_token": ""}
        await db.settings.insert_one(s)
        s.pop("_id", None)
    s["has_pin"] = bool(s.get("pin_hash"))
    s.pop("pin_hash", None)
    s.pop("push_token", None)
    s.setdefault("weekly_report_enabled", False)
    s.setdefault("weekly_report_day", 1)
    s.setdefault("weekly_report_hour", 9)
    return s


@router.put("/settings")
async def update_settings(data: SettingsUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.settings.update_one({"user_id": user["id"]}, {"$set": upd}, upsert=True)
    s = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    s["has_pin"] = bool(s.get("pin_hash"))
    s.pop("pin_hash", None)
    return s


@router.post("/notifications/register")
async def register_push_token(data: PushTokenRequest, user: dict = Depends(get_current_user)):
    token = (data.token or "").strip()
    if not token or not PUSH_TOKEN_REGEX.match(token):
        raise HTTPException(400, "Token push tidak valid")
    await db.settings.update_one({"user_id": user["id"]}, {"$set": {"push_token": token}}, upsert=True)
    return {"message": "Token registered"}


@router.post("/settings/pin/set")
async def set_pin(data: PinRequest, user: dict = Depends(get_current_user)):
    if len(data.pin) != 6 or not data.pin.isdigit():
        raise HTTPException(400, "PIN harus 6 digit")
    h = bcrypt.hashpw(data.pin.encode(), bcrypt.gensalt(rounds=12)).decode()
    await db.settings.update_one({"user_id": user["id"]}, {"$set": {"pin_hash": h}}, upsert=True)
    return {"message": "PIN diatur", "has_pin": True}


@router.post("/settings/pin/verify")
async def verify_pin(data: PinRequest, user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"user_id": user["id"]})
    if not s or not s.get("pin_hash"):
        return {"valid": True}
    if bcrypt.checkpw(data.pin.encode(), s["pin_hash"].encode()):
        return {"valid": True}
    raise HTTPException(401, "PIN salah")


@router.delete("/settings/pin")
async def remove_pin(user: dict = Depends(get_current_user)):
    await db.settings.update_one({"user_id": user["id"]}, {"$set": {"pin_hash": ""}})
    return {"message": "PIN dihapus", "has_pin": False}
