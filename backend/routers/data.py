import csv
import io
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from database import db, month_range_query
from models import BackupData
from auth import get_current_user

router = APIRouter()


@router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        raise HTTPException(503, f"Database unavailable: {str(e)}")


@router.get("/export/csv")
async def export_csv(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if month:
        q["date"] = month_range_query(month)
    txs = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(10000)
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    cm = {c["id"]: c["name"] for c in cats}
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["Tanggal", "Jenis", "Kategori", "Jumlah", "Deskripsi"])
    for t in txs:
        w.writerow([t["date"], "Pemasukan" if t["type"] == "income" else "Pengeluaran", cm.get(t["category_id"], "Lainnya"), t["amount"], t.get("description", "")])
    out.seek(0)
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=laporan_{month or 'semua'}.csv"})

MAX_EXPORT = int(os.environ.get("MAX_EXPORT_ROWS", "10000"))


@router.get("/export/backup")
async def backup(user: dict = Depends(get_current_user)):
    uid = user["id"]
    tx_count = await db.transactions.count_documents({"user_id": uid})
    if tx_count > MAX_EXPORT:
        raise HTTPException(400,
                            f"Data terlalu besar untuk diexport sekaligus ({tx_count} transaksi). "
                            f"Gunakan export CSV per bulan."
                            )
    return {
        "transactions": await db.transactions.find({"user_id": uid}, {"_id": 0}).to_list(MAX_EXPORT),
        "categories": await db.categories.find({"$or": [{"is_default": True}, {"user_id": uid}]}, {"_id": 0}).to_list(100),
        "budgets": await db.budgets.find({"user_id": uid}, {"_id": 0}).to_list(100)
    }

TRANSACTION_FIELDS = {"id", "type", "amount", "category_id", "description", "date", "photo_uri", "created_at", "updated_at"}
BUDGET_FIELDS = {"id", "category_id", "amount", "month", "created_at", "updated_at"}


def _sanitize_tx(raw: dict, uid: str) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    out = {k: v for k, v in raw.items() if k in TRANSACTION_FIELDS}
    if out.get("type") not in ("income", "expense"):
        return None
    try:
        out["amount"] = float(out.get("amount", 0))
    except (TypeError, ValueError):
        return None
    if out["amount"] < 0 or out["amount"] > 1e15:
        return None
    if not isinstance(out.get("date"), str) or not out.get("category_id"):
        return None
    out["id"] = out.get("id") or str(uuid.uuid4())
    out["user_id"] = uid
    return out


def _sanitize_budget(raw: dict, uid: str) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    out = {k: v for k, v in raw.items() if k in BUDGET_FIELDS}
    try:
        out["amount"] = float(out.get("amount", 0))
    except (TypeError, ValueError):
        return None
    if not isinstance(out.get("month"), str) or not out.get("category_id"):
        return None
    out["id"] = out.get("id") or str(uuid.uuid4())
    out["user_id"] = uid
    return out


@router.post("/import/backup")
async def import_backup(data: BackupData, user: dict = Depends(get_current_user)):
    uid = user["id"]
    if len(data.transactions) > MAX_EXPORT or len(data.budgets) > 1000:
        raise HTTPException(400, "Data terlalu besar untuk diimpor")
    if data.transactions:
        clean_tx = [t for t in (_sanitize_tx(x, uid) for x in data.transactions) if t]
        if clean_tx:
            await db.transactions.delete_many({"user_id": uid})
            await db.transactions.insert_many(clean_tx)
    if data.budgets:
        clean_bg = [b for b in (_sanitize_budget(x, uid) for x in data.budgets) if b]
        if clean_bg:
            await db.budgets.delete_many({"user_id": uid})
            await db.budgets.insert_many(clean_bg)
    return {"message": "Data diimpor"}


@router.delete("/data/reset")
async def reset_data(user: dict = Depends(get_current_user)):
    uid = user["id"]
    await db.transactions.delete_many({"user_id": uid})
    await db.budgets.delete_many({"user_id": uid})
    await db.categories.delete_many({"user_id": uid, "is_default": False})
    await db.settings.update_one({"user_id": uid}, {"$set": {"pin_hash": "", "theme": "light"}})
    return {"message": "Data direset"}
