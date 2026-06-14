import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db, month_range_query
from models import TransactionCreate, TransactionUpdate, RecurringUpdate
from auth import get_current_user, extract_tags

router = APIRouter()


@router.get("/transactions")
async def get_transactions(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), type: Optional[str] = None, category_id: Optional[str] = None, month: Optional[str] = None, sort_by: str = "date", sort_order: str = "desc", user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if type:
        q["type"] = type
    if category_id:
        q["category_id"] = category_id
    if month:
        q["date"] = month_range_query(month)
    total = await db.transactions.count_documents(q)
    txs = await db.transactions.find(q, {"_id": 0}).sort(sort_by, -1 if sort_order == "desc" else 1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"transactions": txs, "total": total, "page": page, "limit": limit, "pages": max(1, (total + limit - 1) // limit)}


@router.get("/transactions/{tid}")
async def get_transaction(tid: str, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": tid, "user_id": user["id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Tidak ditemukan")
    return tx


@router.post("/transactions")
async def create_transaction(data: TransactionCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    d = {"id": str(uuid.uuid4()), **data.model_dump(exclude={"recurring_frequency"}), "user_id": user["id"], "tags": extract_tags(data.description), "created_at": now, "updated_at": now}
    await db.transactions.insert_one(d)
    
    if data.recurring_frequency:
        # Hitung next date
        dt = datetime.fromisoformat(data.date.replace('Z', '+00:00') if 'T' in data.date else data.date)
        if data.recurring_frequency == "daily":
            next_dt = dt + timedelta(days=1)
        elif data.recurring_frequency == "weekly":
            next_dt = dt + timedelta(days=7)
        elif data.recurring_frequency == "monthly":
            # Simple month addition
            next_dt = dt + timedelta(days=30)
        elif data.recurring_frequency == "yearly":
            next_dt = dt + timedelta(days=365)
        else:
            next_dt = dt + timedelta(days=30)
            
        r = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": data.type,
            "amount": data.amount,
            "category_id": data.category_id,
            "wallet_id": data.wallet_id,
            "description": data.description,
            "frequency": data.recurring_frequency,
            "next_date": next_dt.strftime("%Y-%m-%d"),
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        await db.recurring_transactions.insert_one(r)
        
    d.pop("_id", None)
    return d


@router.put("/transactions/{tid}")
async def update_transaction(tid: str, data: TransactionUpdate, user: dict = Depends(get_current_user)):
    e = await db.transactions.find_one({"id": tid, "user_id": user["id"]})
    if not e:
        raise HTTPException(404, "Tidak ditemukan")
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if "description" in upd:
        upd["tags"] = extract_tags(upd["description"])
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.transactions.update_one({"id": tid}, {"$set": upd})
    return await db.transactions.find_one({"id": tid}, {"_id": 0})


@router.delete("/transactions/{tid}")
async def delete_transaction(tid: str, user: dict = Depends(get_current_user)):
    r = await db.transactions.delete_one({"id": tid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    return {"message": "Dihapus"}


# ==================== Recurring Transactions ====================


@router.get("/recurring")
async def get_recurring_transactions(user: dict = Depends(get_current_user)):
    return await db.recurring_transactions.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)

@router.put("/recurring/{rid}")
async def update_recurring_transaction(rid: str, data: RecurringUpdate, user: dict = Depends(get_current_user)):
    e = await db.recurring_transactions.find_one({"id": rid, "user_id": user["id"]})
    if not e:
        raise HTTPException(404, "Tidak ditemukan")
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.recurring_transactions.update_one({"id": rid}, {"$set": upd})
    return await db.recurring_transactions.find_one({"id": rid}, {"_id": 0})

@router.delete("/recurring/{rid}")
async def delete_recurring_transaction(rid: str, user: dict = Depends(get_current_user)):
    r = await db.recurring_transactions.delete_one({"id": rid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    return {"message": "Dihapus"}

@router.post("/recurring/process")
async def process_recurring_transactions(user: dict = Depends(get_current_user)):
    """Called by frontend on launch to process due recurring transactions for the current user."""
    uid = user["id"]
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Cari yang due date <= hari ini dan aktif
    due_recurring = await db.recurring_transactions.find({
        "user_id": uid,
        "is_active": True,
        "next_date": {"$lte": now_str}
    }).to_list(100)
    
    processed = 0
    for r in due_recurring:
        # Create transaction
        tx = {
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "type": r["type"],
            "amount": r["amount"],
            "category_id": r["category_id"],
            "wallet_id": r["wallet_id"],
            "description": r.get("description", "") + " (Otomatis)",
            "date": now_str,
            "tags": extract_tags(r.get("description", "")),
            "created_at": now_iso,
            "updated_at": now_iso
        }
        await db.transactions.insert_one(tx)
        
        # Calculate next date
        dt = datetime.fromisoformat(now_str)
        if r["frequency"] == "daily":
            next_dt = dt + timedelta(days=1)
        elif r["frequency"] == "weekly":
            next_dt = dt + timedelta(days=7)
        elif r["frequency"] == "monthly":
            next_dt = dt + timedelta(days=30)
        elif r["frequency"] == "yearly":
            next_dt = dt + timedelta(days=365)
        else:
            next_dt = dt + timedelta(days=30)
            
        await db.recurring_transactions.update_one(
            {"id": r["id"]}, 
            {"$set": {"next_date": next_dt.strftime("%Y-%m-%d"), "updated_at": now_iso}}
        )
        processed += 1
        
    return {"message": f"Processed {processed} recurring transactions", "count": processed}
