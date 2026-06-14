import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import BudgetCreate
from auth import get_current_user

router = APIRouter()


@router.get("/budgets")
async def get_budgets(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if month:
        q["month"] = month
    return await db.budgets.find(q, {"_id": 0}).to_list(100)


@router.post("/budgets")
async def create_budget(data: BudgetCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    e = await db.budgets.find_one({"user_id": user["id"], "category_id": data.category_id, "month": data.month})
    if e:
        await db.budgets.update_one({"id": e["id"]}, {"$set": {"amount": data.amount, "updated_at": now}})
        return await db.budgets.find_one({"id": e["id"]}, {"_id": 0})
    d = {"id": str(uuid.uuid4()), **data.model_dump(), "user_id": user["id"], "created_at": now, "updated_at": now}
    await db.budgets.insert_one(d)
    d.pop("_id", None)
    return d


@router.delete("/budgets/{bid}")
async def delete_budget(bid: str, user: dict = Depends(get_current_user)):
    r = await db.budgets.delete_one({"id": bid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    return {"message": "Dihapus"}
