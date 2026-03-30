from fastapi import FastAPI, APIRouter, Query, HTTPException, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import csv
import io
from fastapi.responses import StreamingResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== Pydantic Models ====================

class CategoryCreate(BaseModel):
    name: str
    type: str
    icon: str
    color: str

class TransactionCreate(BaseModel):
    type: str
    amount: float
    category_id: str
    description: str = ""
    date: str
    photo_uri: str = ""

class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    amount: Optional[float] = None
    category_id: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    photo_uri: Optional[str] = None

class BudgetCreate(BaseModel):
    category_id: str
    amount: float
    month: str

class SettingsUpdate(BaseModel):
    currency: Optional[str] = None
    date_format: Optional[str] = None
    theme: Optional[str] = None
    profile_name: Optional[str] = None
    profile_photo: Optional[str] = None

class PinRequest(BaseModel):
    pin: str

class BackupData(BaseModel):
    transactions: list = []
    categories: list = []
    budgets: list = []

# ==================== Default Categories ====================

DEFAULT_CATEGORIES = [
    {"name": "Makanan & Minuman", "type": "expense", "icon": "fast-food", "color": "#E86A33"},
    {"name": "Transportasi", "type": "expense", "icon": "car", "color": "#4A8B9A"},
    {"name": "Rumah & Utilitas", "type": "expense", "icon": "home", "color": "#C2A878"},
    {"name": "Belanja", "type": "expense", "icon": "bag-handle", "color": "#7D8F69"},
    {"name": "Kesehatan", "type": "expense", "icon": "medkit", "color": "#D34A3E"},
    {"name": "Hiburan", "type": "expense", "icon": "game-controller", "color": "#9DB0A3"},
    {"name": "Pendidikan", "type": "expense", "icon": "book", "color": "#1A4D2E"},
    {"name": "Tabungan & Investasi", "type": "expense", "icon": "trending-up", "color": "#3A6E4B"},
    {"name": "Lainnya", "type": "expense", "icon": "ellipsis-horizontal", "color": "#7D7D7D"},
    {"name": "Gaji", "type": "income", "icon": "briefcase", "color": "#1A4D2E"},
    {"name": "Freelance / Bisnis", "type": "income", "icon": "laptop", "color": "#7D8F69"},
    {"name": "Hadiah / Bonus", "type": "income", "icon": "gift", "color": "#E86A33"},
    {"name": "Investasi", "type": "income", "icon": "trending-up", "color": "#3A6E4B"},
    {"name": "Lainnya", "type": "income", "icon": "ellipsis-horizontal", "color": "#C2A878"},
]

def hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()

# ==================== Startup ====================

@app.on_event("startup")
async def startup():
    count = await db.categories.count_documents({"is_default": True})
    if count == 0:
        cats = []
        for cat in DEFAULT_CATEGORIES:
            cats.append({
                "id": str(uuid.uuid4()),
                **cat,
                "is_default": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        await db.categories.insert_many(cats)
        logger.info(f"Seeded {len(cats)} default categories")

    settings = await db.settings.find_one({"id": "main"})
    if not settings:
        await db.settings.insert_one({
            "id": "main", "currency": "IDR", "date_format": "DD/MM/YYYY",
            "theme": "light", "pin_hash": "", "profile_name": "", "profile_photo": ""
        })
        logger.info("Created default settings")

# ==================== Health ====================

@api_router.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

# ==================== Categories ====================

@api_router.get("/categories")
async def get_categories(type: Optional[str] = None):
    query = {}
    if type:
        query["type"] = type
    return await db.categories.find(query, {"_id": 0}).to_list(100)

@api_router.post("/categories")
async def create_category(data: CategoryCreate):
    cat_dict = {
        "id": str(uuid.uuid4()), **data.model_dump(),
        "is_default": False, "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.categories.insert_one(cat_dict)
    cat_dict.pop("_id", None)
    return cat_dict

@api_router.put("/categories/{category_id}")
async def update_category(category_id: str, data: CategoryCreate):
    existing = await db.categories.find_one({"id": category_id})
    if not existing:
        raise HTTPException(404, "Kategori tidak ditemukan")
    if existing.get("is_default"):
        raise HTTPException(400, "Tidak bisa mengubah kategori default")
    await db.categories.update_one({"id": category_id}, {"$set": data.model_dump()})
    return await db.categories.find_one({"id": category_id}, {"_id": 0})

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    existing = await db.categories.find_one({"id": category_id})
    if not existing:
        raise HTTPException(404, "Kategori tidak ditemukan")
    if existing.get("is_default"):
        raise HTTPException(400, "Tidak bisa menghapus kategori default")
    await db.categories.delete_one({"id": category_id})
    return {"message": "Kategori berhasil dihapus"}

# ==================== Transactions ====================

@api_router.get("/transactions")
async def get_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    category_id: Optional[str] = None,
    month: Optional[str] = None,
    sort_by: str = "date",
    sort_order: str = "desc"
):
    query = {}
    if type:
        query["type"] = type
    if category_id:
        query["category_id"] = category_id
    if month:
        query["date"] = {"$regex": f"^{month}"}

    sort_dir = -1 if sort_order == "desc" else 1
    skip = (page - 1) * limit
    total = await db.transactions.count_documents(query)
    transactions = await db.transactions.find(query, {"_id": 0}).sort(sort_by, sort_dir).skip(skip).limit(limit).to_list(limit)
    return {
        "transactions": transactions, "total": total,
        "page": page, "limit": limit,
        "pages": max(1, (total + limit - 1) // limit)
    }

@api_router.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: str):
    tx = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    return tx

@api_router.post("/transactions")
async def create_transaction(data: TransactionCreate):
    now = datetime.now(timezone.utc).isoformat()
    tx_dict = {"id": str(uuid.uuid4()), **data.model_dump(), "created_at": now, "updated_at": now}
    await db.transactions.insert_one(tx_dict)
    tx_dict.pop("_id", None)
    return tx_dict

@api_router.put("/transactions/{transaction_id}")
async def update_transaction(transaction_id: str, data: TransactionUpdate):
    existing = await db.transactions.find_one({"id": transaction_id})
    if not existing:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.transactions.update_one({"id": transaction_id}, {"$set": update_data})
    return await db.transactions.find_one({"id": transaction_id}, {"_id": 0})

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str):
    result = await db.transactions.delete_one({"id": transaction_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    return {"message": "Transaksi berhasil dihapus"}

# ==================== Budgets ====================

@api_router.get("/budgets")
async def get_budgets(month: Optional[str] = None):
    query = {}
    if month:
        query["month"] = month
    return await db.budgets.find(query, {"_id": 0}).to_list(100)

@api_router.post("/budgets")
async def create_or_update_budget(data: BudgetCreate):
    existing = await db.budgets.find_one({"category_id": data.category_id, "month": data.month})
    now = datetime.now(timezone.utc).isoformat()
    if existing:
        await db.budgets.update_one({"id": existing["id"]}, {"$set": {"amount": data.amount, "updated_at": now}})
        return await db.budgets.find_one({"id": existing["id"]}, {"_id": 0})
    budget_dict = {"id": str(uuid.uuid4()), **data.model_dump(), "created_at": now, "updated_at": now}
    await db.budgets.insert_one(budget_dict)
    budget_dict.pop("_id", None)
    return budget_dict

@api_router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str):
    result = await db.budgets.delete_one({"id": budget_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Budget tidak ditemukan")
    return {"message": "Budget berhasil dihapus"}

# ==================== Analytics ====================

@api_router.get("/analytics/summary")
async def get_summary(month: Optional[str] = None):
    month_query = {}
    if month:
        month_query["date"] = {"$regex": f"^{month}"}

    pipeline = [{"$match": month_query}, {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}]
    results = await db.transactions.aggregate(pipeline).to_list(10)
    income = sum(r["total"] for r in results if r["_id"] == "income")
    expense = sum(r["total"] for r in results if r["_id"] == "expense")

    all_pipeline = [{"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}]
    all_results = await db.transactions.aggregate(all_pipeline).to_list(10)
    total_income = sum(r["total"] for r in all_results if r["_id"] == "income")
    total_expense = sum(r["total"] for r in all_results if r["_id"] == "expense")

    tx_count = await db.transactions.count_documents(month_query)
    return {
        "balance": total_income - total_expense,
        "month_income": income, "month_expense": expense,
        "month_net": income - expense, "transaction_count": tx_count
    }

@api_router.get("/analytics/category-breakdown")
async def get_category_breakdown(month: Optional[str] = None, type: str = "expense"):
    query = {"type": type}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    pipeline = [{"$match": query}, {"$group": {"_id": "$category_id", "total": {"$sum": "$amount"}}}, {"$sort": {"total": -1}}]
    results = await db.transactions.aggregate(pipeline).to_list(50)
    grand_total = sum(r["total"] for r in results)
    breakdown = []
    for r in results:
        cat = await db.categories.find_one({"id": r["_id"]}, {"_id": 0})
        if cat:
            breakdown.append({
                "category_id": r["_id"], "category_name": cat["name"],
                "category_icon": cat["icon"], "category_color": cat["color"],
                "total": r["total"],
                "percentage": round(r["total"] / grand_total * 100, 1) if grand_total > 0 else 0
            })
    return {"breakdown": breakdown, "total": grand_total}

@api_router.get("/analytics/daily-trend")
async def get_daily_trend(days: int = Query(7, ge=1, le=30)):
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days - 1)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    pipeline = [
        {"$match": {"date": {"$gte": start_str, "$lte": end_str + "T23:59:59"}}},
        {"$addFields": {"day": {"$substr": ["$date", 0, 10]}}},
        {"$group": {"_id": {"day": "$day", "type": "$type"}, "total": {"$sum": "$amount"}}},
        {"$sort": {"_id.day": 1}}
    ]
    results = await db.transactions.aggregate(pipeline).to_list(100)

    daily = {}
    for i in range(days):
        day = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        daily[day] = {"date": day, "income": 0, "expense": 0}
    for r in results:
        day = r["_id"]["day"]
        if day in daily:
            daily[day][r["_id"]["type"]] = r["total"]
    return list(daily.values())

@api_router.get("/analytics/monthly-trend")
async def get_monthly_trend(months: int = Query(6, ge=1, le=12)):
    now = datetime.now(timezone.utc)
    trend = []
    for i in range(months - 1, -1, -1):
        target_month = now.month - i
        target_year = now.year
        while target_month <= 0:
            target_month += 12
            target_year -= 1
        month_str = f"{target_year}-{str(target_month).zfill(2)}"
        pipeline = [{"$match": {"date": {"$regex": f"^{month_str}"}}}, {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}]
        results = await db.transactions.aggregate(pipeline).to_list(10)
        inc = sum(r["total"] for r in results if r["_id"] == "income")
        exp = sum(r["total"] for r in results if r["_id"] == "expense")
        trend.append({"month": month_str, "income": inc, "expense": exp, "net": inc - exp})
    return trend

@api_router.get("/analytics/stats")
async def get_stats(month: Optional[str] = None):
    query = {"type": "expense"}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    pipeline = [
        {"$match": query},
        {"$addFields": {"day": {"$substr": ["$date", 0, 10]}}},
        {"$group": {"_id": "$day", "total": {"$sum": "$amount"}}},
    ]
    daily_results = await db.transactions.aggregate(pipeline).to_list(31)
    if daily_results:
        daily_totals = [r["total"] for r in daily_results]
        highest = max(daily_results, key=lambda x: x["total"])
        return {
            "avg_daily_expense": round(sum(daily_totals) / len(daily_totals)),
            "highest_day": highest["_id"], "highest_day_amount": highest["total"],
            "days_with_expense": len(daily_results)
        }
    return {"avg_daily_expense": 0, "highest_day": "", "highest_day_amount": 0, "days_with_expense": 0}

# ==================== Settings ====================

@api_router.get("/settings")
async def get_settings():
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    if not settings:
        settings = {"id": "main", "currency": "IDR", "date_format": "DD/MM/YYYY", "theme": "light", "pin_hash": "", "profile_name": "", "profile_photo": ""}
    settings["has_pin"] = bool(settings.get("pin_hash"))
    return settings

@api_router.put("/settings")
async def update_settings(data: SettingsUpdate):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.settings.update_one({"id": "main"}, {"$set": update_data})
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    settings["has_pin"] = bool(settings.get("pin_hash"))
    return settings

@api_router.post("/settings/pin/set")
async def set_pin(data: PinRequest):
    if len(data.pin) != 6 or not data.pin.isdigit():
        raise HTTPException(400, "PIN harus 6 digit angka")
    await db.settings.update_one({"id": "main"}, {"$set": {"pin_hash": hash_pin(data.pin)}})
    return {"message": "PIN berhasil diatur", "has_pin": True}

@api_router.post("/settings/pin/verify")
async def verify_pin(data: PinRequest):
    settings = await db.settings.find_one({"id": "main"})
    if not settings or not settings.get("pin_hash"):
        return {"valid": True, "message": "PIN tidak diatur"}
    if hash_pin(data.pin) == settings["pin_hash"]:
        return {"valid": True, "message": "PIN benar"}
    raise HTTPException(401, "PIN salah")

@api_router.delete("/settings/pin")
async def remove_pin():
    await db.settings.update_one({"id": "main"}, {"$set": {"pin_hash": ""}})
    return {"message": "PIN berhasil dihapus", "has_pin": False}

# ==================== Export & Backup ====================

@api_router.get("/export/csv")
async def export_csv(month: Optional[str] = None):
    query = {}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    transactions = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    cat_map = {c["id"]: c["name"] for c in categories}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Tanggal", "Jenis", "Kategori", "Jumlah", "Deskripsi"])
    for tx in transactions:
        writer.writerow([
            tx["date"], "Pemasukan" if tx["type"] == "income" else "Pengeluaran",
            cat_map.get(tx["category_id"], "Lainnya"), tx["amount"], tx.get("description", "")
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=laporan_{month or 'semua'}.csv"}
    )

@api_router.get("/export/backup")
async def backup_data():
    transactions = await db.transactions.find({}, {"_id": 0}).to_list(100000)
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    budgets = await db.budgets.find({}, {"_id": 0}).to_list(100)
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    return {"transactions": transactions, "categories": categories, "budgets": budgets, "settings": settings, "exported_at": datetime.now(timezone.utc).isoformat()}

@api_router.post("/import/backup")
async def import_backup(data: BackupData):
    if data.transactions:
        await db.transactions.delete_many({})
        clean = [{k: v for k, v in t.items() if k != "_id"} for t in data.transactions]
        await db.transactions.insert_many(clean)
    if data.categories:
        await db.categories.delete_many({})
        clean = [{k: v for k, v in c.items() if k != "_id"} for c in data.categories]
        await db.categories.insert_many(clean)
    if data.budgets:
        await db.budgets.delete_many({})
        clean = [{k: v for k, v in b.items() if k != "_id"} for b in data.budgets]
        await db.budgets.insert_many(clean)
    return {"message": "Data berhasil diimpor"}

@api_router.delete("/data/reset")
async def reset_all_data():
    await db.transactions.delete_many({})
    await db.budgets.delete_many({})
    await db.categories.delete_many({})
    await db.settings.delete_many({})
    cats = []
    for cat in DEFAULT_CATEGORIES:
        cats.append({"id": str(uuid.uuid4()), **cat, "is_default": True, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.categories.insert_many(cats)
    await db.settings.insert_one({"id": "main", "currency": "IDR", "date_format": "DD/MM/YYYY", "theme": "light", "pin_hash": "", "profile_name": "", "profile_photo": ""})
    return {"message": "Semua data berhasil direset"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
