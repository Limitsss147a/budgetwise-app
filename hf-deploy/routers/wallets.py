import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import WalletCreate, WalletUpdate, WalletTransfer
from auth import get_current_user

router = APIRouter()


@router.get("/wallets")
async def get_wallets(user: dict = Depends(get_current_user)):
    uid = user["id"]
    wallets = await db.wallets.find({"user_id": uid}, {"_id": 0}).to_list(50)
    
    # Calculate current balance for each wallet
    # current_balance = initial_balance + sum(income) - sum(expense)
    for w in wallets:
        wid = w["id"]
        pipe = [
            {"$match": {"user_id": uid, "wallet_id": wid}},
            {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}
        ]
        res = await db.transactions.aggregate(pipe).to_list(10)
        inc = sum(r["total"] for r in res if r["_id"] in ("income", "transfer_in"))
        exp = sum(r["total"] for r in res if r["_id"] in ("expense", "transfer_out"))
        w["balance"] = w.get("initial_balance", 0.0) + inc - exp
    
    return wallets


@router.post("/wallets")
async def create_wallet(data: WalletCreate, user: dict = Depends(get_current_user)):
    uid = user["id"]
    wid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if it's the first wallet, if so make it default
    is_first = await db.wallets.count_documents({"user_id": uid}) == 0
    
    d = {
        "id": wid,
        "user_id": uid,
        **data.model_dump(),
        "is_default": is_first,
        "created_at": now,
        "updated_at": now
    }
    await db.wallets.insert_one(d)
    d.pop("_id", None)
    d["balance"] = d["initial_balance"]
    return d


@router.put("/wallets/{wid}")
async def update_wallet(wid: str, data: WalletUpdate, user: dict = Depends(get_current_user)):
    uid = user["id"]
    e = await db.wallets.find_one({"id": wid, "user_id": uid})
    if not e:
        raise HTTPException(404, "Wallet tidak ditemukan")
    
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If setting as default, unset other default wallets
    if upd.get("is_default"):
        await db.wallets.update_many({"user_id": uid}, {"$set": {"is_default": False}})
        
    await db.wallets.update_one({"id": wid}, {"$set": upd})
    return await db.wallets.find_one({"id": wid}, {"_id": 0})


@router.delete("/wallets/{wid}")
async def delete_wallet(wid: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    e = await db.wallets.find_one({"id": wid, "user_id": uid})
    if not e:
        raise HTTPException(404, "Wallet tidak ditemukan")
        
    # Check if there are transactions associated with this wallet
    tx_count = await db.transactions.count_documents({"user_id": uid, "wallet_id": wid})
    if tx_count > 0:
        raise HTTPException(400, "Tidak bisa menghapus wallet yang memiliki transaksi. Pindahkan transaksi terlebih dahulu.")
        
    if e.get("is_default"):
        raise HTTPException(400, "Tidak bisa menghapus wallet default.")
        
    await db.wallets.delete_one({"id": wid})
    return {"message": "Wallet dihapus"}


@router.post("/wallets/transfer")
async def transfer_balance(data: WalletTransfer, user: dict = Depends(get_current_user)):
    uid = user["id"]
    fw = await db.wallets.find_one({"id": data.from_wallet_id, "user_id": uid})
    tw = await db.wallets.find_one({"id": data.to_wallet_id, "user_id": uid})
    
    if not fw or not tw:
        raise HTTPException(404, "Salah satu wallet tidak ditemukan")
        
    now_iso = datetime.now(timezone.utc).isoformat()
    tx_id_1 = str(uuid.uuid4())
    tx_id_2 = str(uuid.uuid4())
    
    # Create outgoing transaction
    out_tx = {
        "id": tx_id_1,
        "user_id": uid,
        "type": "transfer_out",
        "amount": data.amount,
        "category_id": "transfer-out", # Special category or just "Lainnya"
        "wallet_id": data.from_wallet_id,
        "description": f"Transfer ke {tw['name']}: {data.description}",
        "date": data.date,
        "created_at": now_iso,
        "updated_at": now_iso
    }
    
    # Create incoming transaction
    in_tx = {
        "id": tx_id_2,
        "user_id": uid,
        "type": "transfer_in",
        "amount": data.amount,
        "category_id": "transfer-in",
        "wallet_id": data.to_wallet_id,
        "description": f"Transfer dari {fw['name']}: {data.description}",
        "date": data.date,
        "created_at": now_iso,
        "updated_at": now_iso
    }
    
    await db.transactions.insert_many([out_tx, in_tx])
    return {"message": "Transfer berhasil", "from_transaction_id": tx_id_1, "to_transaction_id": tx_id_2}
