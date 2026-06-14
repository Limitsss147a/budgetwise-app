import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import CategoryCreate
from auth import get_current_user

router = APIRouter()


@router.get("/categories")
async def get_categories(type: Optional[str] = None, user: dict = Depends(get_current_user)):
    base = {"$or": [{"is_default": True}, {"user_id": user["id"]}]}
    query = {"$and": [base, {"type": type}]} if type else base
    return await db.categories.find(query, {"_id": 0}).to_list(100)


@router.post("/categories")
async def create_category(data: CategoryCreate, user: dict = Depends(get_current_user)):
    d = {"id": str(uuid.uuid4()), **data.model_dump(), "user_id": user["id"], "is_default": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.categories.insert_one(d)
    d.pop("_id", None)
    return d


@router.put("/categories/{cid}")
async def update_category(cid: str, data: CategoryCreate, user: dict = Depends(get_current_user)):
    e = await db.categories.find_one({"id": cid})
    if not e:
        raise HTTPException(404, "Tidak ditemukan")
    if e.get("is_default"):
        raise HTTPException(400, "Tidak bisa ubah default")
    if e.get("user_id") != user["id"]:
        raise HTTPException(403, "Akses ditolak")
    await db.categories.update_one({"id": cid}, {"$set": data.model_dump()})
    return await db.categories.find_one({"id": cid}, {"_id": 0})


@router.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(get_current_user)):
    e = await db.categories.find_one({"id": cid})
    if not e:
        raise HTTPException(404, "Tidak ditemukan")
    if e.get("is_default"):
        raise HTTPException(400, "Tidak bisa hapus default")
    if e.get("user_id") != user["id"]:
        raise HTTPException(403, "Akses ditolak")
    await db.categories.delete_one({"id": cid})
    return {"message": "Dihapus"}
