import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import GoalCreate, GoalUpdate, GoalContribute
from auth import get_current_user, extract_tags

router = APIRouter()


@router.get("/goals")
async def get_goals(user: dict = Depends(get_current_user)):
    return await db.goals.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)

@router.post("/goals")
async def create_goal(data: GoalCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    d = {"id": str(uuid.uuid4()), **data.model_dump(), "current_amount": 0.0, "user_id": user["id"], "created_at": now, "updated_at": now}
    await db.goals.insert_one(d)
    d.pop("_id", None)
    return d

@router.put("/goals/{gid}")
async def update_goal(gid: str, data: GoalUpdate, user: dict = Depends(get_current_user)):
    e = await db.goals.find_one({"id": gid, "user_id": user["id"]})
    if not e:
        raise HTTPException(404, "Goal tidak ditemukan")
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.goals.update_one({"id": gid}, {"$set": upd})
    return await db.goals.find_one({"id": gid}, {"_id": 0})

@router.delete("/goals/{gid}")
async def delete_goal(gid: str, user: dict = Depends(get_current_user)):
    r = await db.goals.delete_one({"id": gid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Goal tidak ditemukan")
    return {"message": "Dihapus"}

@router.post("/goals/{gid}/contribute")
async def contribute_goal(gid: str, data: GoalContribute, user: dict = Depends(get_current_user)):
    e = await db.goals.find_one({"id": gid, "user_id": user["id"]})
    if not e:
        raise HTTPException(404, "Goal tidak ditemukan")
    w = await db.wallets.find_one({"id": data.wallet_id, "user_id": user["id"]})
    if not w:
        raise HTTPException(404, "Wallet tidak ditemukan")
    
    pipe = [
        {"$match": {"user_id": user["id"], "wallet_id": data.wallet_id}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}
    ]
    res = await db.transactions.aggregate(pipe).to_list(10)
    inc = sum(r["total"] for r in res if r["_id"] in ("income", "transfer_in"))
    exp = sum(r["total"] for r in res if r["_id"] in ("expense", "transfer_out"))
    current_balance = w.get("initial_balance", 0.0) + inc - exp

    if current_balance < data.amount:
        raise HTTPException(400, "Saldo wallet tidak cukup")
    now = datetime.now(timezone.utc).isoformat()
    await db.wallets.update_one({"id": data.wallet_id}, {"$set": {"updated_at": now}})
    await db.goals.update_one({"id": gid}, {"$inc": {"current_amount": data.amount}, "$set": {"updated_at": now}})
    tx = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "wallet_id": data.wallet_id,
        "type": "transfer_out",
        "amount": data.amount,
        "date": now[:10],
        "description": f"Alokasi ke: {e.get('name', 'Goal')}",
        "category_id": "transfer",
        "destination_id": f"goal:{gid}",
        "tags": extract_tags(f"Alokasi ke: {e.get('name', 'Goal')}"),
        "created_at": now,
        "updated_at": now
    }
    await db.transactions.insert_one(tx)
    return {"message": "Berhasil menambah tabungan", "goal": await db.goals.find_one({"id": gid}, {"_id": 0})}
