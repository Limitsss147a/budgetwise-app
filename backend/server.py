from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')

from fastapi import FastAPI, APIRouter, Query, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, hashlib, csv, io, bcrypt, jwt
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional, List
from fastapi.responses import StreamingResponse
import asyncio
import httpx

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== Auth Helpers ====================
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}, JWT_SECRET, algorithm=JWT_ALG)

def create_refresh_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30), "type": "refresh"}, JWT_SECRET, algorithm=JWT_ALG)

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

# ==================== Models ====================
class AuthRegister(BaseModel):
    name: str
    email: str
    password: str

class AuthLogin(BaseModel):
    email: str
    password: str

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
    weekly_report_enabled: Optional[bool] = None
    weekly_report_day: Optional[int] = None  # 1=Mon, 2=Tue, ..., 7=Sun
    weekly_report_hour: Optional[int] = None  # 0-23

class PushTokenRequest(BaseModel):
    token: str

class PinRequest(BaseModel):
    pin: str

class BackupData(BaseModel):
    transactions: list = []
    categories: list = []
    budgets: list = []

class InvestmentCreate(BaseModel):
    ticker: str
    lot_count: int
    average_buy_price: float

class InvestmentUpdate(BaseModel):
    ticker: str
    lot_count: Optional[int]
    average_buy_price: Optional[float]

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

# ==================== Startup ====================
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    # Seed categories
    if await db.categories.count_documents({"is_default": True}) == 0:
        cats = [{"id": str(uuid.uuid4()), **c, "is_default": True, "created_at": datetime.now(timezone.utc).isoformat()} for c in DEFAULT_CATEGORIES]
        await db.categories.insert_many(cats)
        logger.info(f"Seeded {len(cats)} categories")
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        admin_id = str(uuid.uuid4())
        await db.users.insert_one({"id": admin_id, "email": admin_email, "password_hash": hash_password(admin_pw), "name": "Admin", "role": "admin", "created_at": datetime.now(timezone.utc).isoformat()})
        # Create default settings for admin
        await db.settings.insert_one({"user_id": admin_id, "currency": "IDR", "theme": "light", "pin_hash": ""})
        logger.info("Admin user seeded")
    else:
        admin_id = admin.get("id", "")
        if not verify_password(admin_pw, admin.get("password_hash", "")):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})
    # Migrate unowned data to admin
    if admin_id:
        await db.transactions.update_many({"user_id": {"$exists": False}}, {"$set": {"user_id": admin_id}})
        await db.budgets.update_many({"user_id": {"$exists": False}}, {"$set": {"user_id": admin_id}})

# ==================== Auth Endpoints ====================
@api_router.post("/auth/register")
async def register(data: AuthRegister):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    if len(data.password) < 6:
        raise HTTPException(400, "Password minimal 6 karakter")
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.users.insert_one({"id": user_id, "email": email, "password_hash": hash_password(data.password), "name": data.name.strip(), "role": "user", "created_at": now})
    await db.settings.insert_one({"user_id": user_id, "currency": "IDR", "theme": "light", "pin_hash": ""})
    return {"user": {"id": user_id, "email": email, "name": data.name.strip(), "role": "user"}, "access_token": create_access_token(user_id, email), "refresh_token": create_refresh_token(user_id)}

@api_router.post("/auth/login")
async def login(data: AuthLogin):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Email atau password salah")
    uid = user["id"]
    return {"user": {"id": uid, "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "user")}, "access_token": create_access_token(uid, user["email"]), "refresh_token": create_refresh_token(uid)}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"user": user}

@api_router.post("/auth/refresh")
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

# ==================== Health ====================
@api_router.get("/health")
async def health():
    return {"status": "ok"}

# ==================== Categories ====================
@api_router.get("/categories")
async def get_categories(type: Optional[str] = None, user: dict = Depends(get_current_user)):
    base = {"$or": [{"is_default": True}, {"user_id": user["id"]}]}
    query = {"$and": [base, {"type": type}]} if type else base
    return await db.categories.find(query, {"_id": 0}).to_list(100)

@api_router.post("/categories")
async def create_category(data: CategoryCreate, user: dict = Depends(get_current_user)):
    d = {"id": str(uuid.uuid4()), **data.model_dump(), "user_id": user["id"], "is_default": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.categories.insert_one(d)
    d.pop("_id", None)
    return d

@api_router.put("/categories/{cid}")
async def update_category(cid: str, data: CategoryCreate, user: dict = Depends(get_current_user)):
    e = await db.categories.find_one({"id": cid})
    if not e: raise HTTPException(404, "Tidak ditemukan")
    if e.get("is_default"): raise HTTPException(400, "Tidak bisa ubah default")
    if e.get("user_id") != user["id"]: raise HTTPException(403, "Akses ditolak")
    await db.categories.update_one({"id": cid}, {"$set": data.model_dump()})
    return await db.categories.find_one({"id": cid}, {"_id": 0})

@api_router.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(get_current_user)):
    e = await db.categories.find_one({"id": cid})
    if not e: raise HTTPException(404, "Tidak ditemukan")
    if e.get("is_default"): raise HTTPException(400, "Tidak bisa hapus default")
    if e.get("user_id") != user["id"]: raise HTTPException(403, "Akses ditolak")
    await db.categories.delete_one({"id": cid})
    return {"message": "Dihapus"}

# ==================== Transactions ====================
@api_router.get("/transactions")
async def get_transactions(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), type: Optional[str] = None, category_id: Optional[str] = None, month: Optional[str] = None, sort_by: str = "date", sort_order: str = "desc", user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if type: q["type"] = type
    if category_id: q["category_id"] = category_id
    if month: q["date"] = {"$regex": f"^{month}"}
    total = await db.transactions.count_documents(q)
    txs = await db.transactions.find(q, {"_id": 0}).sort(sort_by, -1 if sort_order == "desc" else 1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"transactions": txs, "total": total, "page": page, "limit": limit, "pages": max(1, (total+limit-1)//limit)}

@api_router.get("/transactions/{tid}")
async def get_transaction(tid: str, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": tid, "user_id": user["id"]}, {"_id": 0})
    if not tx: raise HTTPException(404, "Tidak ditemukan")
    return tx

@api_router.post("/transactions")
async def create_transaction(data: TransactionCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    d = {"id": str(uuid.uuid4()), **data.model_dump(), "user_id": user["id"], "created_at": now, "updated_at": now}
    await db.transactions.insert_one(d)
    d.pop("_id", None)
    return d

@api_router.put("/transactions/{tid}")
async def update_transaction(tid: str, data: TransactionUpdate, user: dict = Depends(get_current_user)):
    e = await db.transactions.find_one({"id": tid, "user_id": user["id"]})
    if not e: raise HTTPException(404, "Tidak ditemukan")
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.transactions.update_one({"id": tid}, {"$set": upd})
    return await db.transactions.find_one({"id": tid}, {"_id": 0})

@api_router.delete("/transactions/{tid}")
async def delete_transaction(tid: str, user: dict = Depends(get_current_user)):
    r = await db.transactions.delete_one({"id": tid, "user_id": user["id"]})
    if r.deleted_count == 0: raise HTTPException(404, "Tidak ditemukan")
    return {"message": "Dihapus"}

# ==================== Budgets ====================
@api_router.get("/budgets")
async def get_budgets(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if month: q["month"] = month
    return await db.budgets.find(q, {"_id": 0}).to_list(100)

@api_router.post("/budgets")
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

@api_router.delete("/budgets/{bid}")
async def delete_budget(bid: str, user: dict = Depends(get_current_user)):
    r = await db.budgets.delete_one({"id": bid, "user_id": user["id"]})
    if r.deleted_count == 0: raise HTTPException(404, "Tidak ditemukan")
    return {"message": "Dihapus"}

# ==================== Analytics ====================
@api_router.get("/analytics/summary")
async def get_summary(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    uid = user["id"]
    mq = {"user_id": uid}
    if month: mq["date"] = {"$regex": f"^{month}"}
    pipe = [{"$match": mq}, {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}]
    res = await db.transactions.aggregate(pipe).to_list(10)
    inc = sum(r["total"] for r in res if r["_id"] == "income")
    exp = sum(r["total"] for r in res if r["_id"] == "expense")
    all_pipe = [{"$match": {"user_id": uid}}, {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}]
    all_res = await db.transactions.aggregate(all_pipe).to_list(10)
    ti = sum(r["total"] for r in all_res if r["_id"] == "income")
    te = sum(r["total"] for r in all_res if r["_id"] == "expense")
    tc = await db.transactions.count_documents(mq)
    return {"balance": ti - te, "month_income": inc, "month_expense": exp, "month_net": inc - exp, "transaction_count": tc}

@api_router.get("/analytics/category-breakdown")
async def get_breakdown(month: Optional[str] = None, type: str = "expense", user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"], "type": type}
    if month: q["date"] = {"$regex": f"^{month}"}
    pipe = [{"$match": q}, {"$group": {"_id": "$category_id", "total": {"$sum": "$amount"}}}, {"$sort": {"total": -1}}]
    res = await db.transactions.aggregate(pipe).to_list(50)
    gt = sum(r["total"] for r in res)
    bd = []
    for r in res:
        cat = await db.categories.find_one({"id": r["_id"]}, {"_id": 0})
        if cat:
            bd.append({"category_id": r["_id"], "category_name": cat["name"], "category_icon": cat["icon"], "category_color": cat["color"], "total": r["total"], "percentage": round(r["total"]/gt*100,1) if gt > 0 else 0})
    return {"breakdown": bd, "total": gt}

@api_router.get("/analytics/daily-trend")
async def get_daily_trend(days: int = Query(7, ge=1, le=30), user: dict = Depends(get_current_user)):
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days-1)
    ss, es = start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
    pipe = [{"$match": {"user_id": user["id"], "date": {"$gte": ss, "$lte": es+"T23:59:59"}}}, {"$addFields": {"day": {"$substr": ["$date", 0, 10]}}}, {"$group": {"_id": {"day": "$day", "type": "$type"}, "total": {"$sum": "$amount"}}}, {"$sort": {"_id.day": 1}}]
    res = await db.transactions.aggregate(pipe).to_list(100)
    daily = {}
    for i in range(days):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        daily[d] = {"date": d, "income": 0, "expense": 0}
    for r in res:
        d = r["_id"]["day"]
        if d in daily: daily[d][r["_id"]["type"]] = r["total"]
    return list(daily.values())

@api_router.get("/analytics/monthly-trend")
async def get_monthly_trend(months: int = Query(6, ge=1, le=12), user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    trend = []
    for i in range(months-1, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0: m += 12; y -= 1
        ms = f"{y}-{str(m).zfill(2)}"
        pipe = [{"$match": {"user_id": user["id"], "date": {"$regex": f"^{ms}"}}}, {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}]
        res = await db.transactions.aggregate(pipe).to_list(10)
        inc = sum(r["total"] for r in res if r["_id"] == "income")
        exp = sum(r["total"] for r in res if r["_id"] == "expense")
        trend.append({"month": ms, "income": inc, "expense": exp, "net": inc - exp})
    return trend

@api_router.get("/analytics/stats")
async def get_stats(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"], "type": "expense"}
    if month: q["date"] = {"$regex": f"^{month}"}
    pipe = [{"$match": q}, {"$addFields": {"day": {"$substr": ["$date", 0, 10]}}}, {"$group": {"_id": "$day", "total": {"$sum": "$amount"}}}]
    dr = await db.transactions.aggregate(pipe).to_list(31)
    if dr:
        totals = [r["total"] for r in dr]
        h = max(dr, key=lambda x: x["total"])
        return {"avg_daily_expense": round(sum(totals)/len(totals)), "highest_day": h["_id"], "highest_day_amount": h["total"], "days_with_expense": len(dr)}
    return {"avg_daily_expense": 0, "highest_day": "", "highest_day_amount": 0, "days_with_expense": 0}

# ==================== Weekly Report ====================
@api_router.get("/reports/weekly")
async def get_weekly_report(user: dict = Depends(get_current_user)):
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    ss, es = start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
    uid = user["id"]
    # Expenses
    ep = [{"$match": {"user_id": uid, "type": "expense", "date": {"$gte": ss, "$lte": es+"T23:59:59"}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    er = await db.transactions.aggregate(ep).to_list(1)
    total_exp = er[0]["total"] if er else 0
    # Income
    ip = [{"$match": {"user_id": uid, "type": "income", "date": {"$gte": ss, "$lte": es+"T23:59:59"}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    ir = await db.transactions.aggregate(ip).to_list(1)
    total_inc = ir[0]["total"] if ir else 0
    # Top category
    cp = [{"$match": {"user_id": uid, "type": "expense", "date": {"$gte": ss, "$lte": es+"T23:59:59"}}}, {"$group": {"_id": "$category_id", "total": {"$sum": "$amount"}}}, {"$sort": {"total": -1}}, {"$limit": 1}]
    cr = await db.transactions.aggregate(cp).to_list(1)
    top_cat = None
    if cr:
        cat = await db.categories.find_one({"id": cr[0]["_id"]}, {"_id": 0})
        top_cat = {"name": cat["name"] if cat else "Lainnya", "icon": cat.get("icon", "ellipsis-horizontal") if cat else "ellipsis-horizontal", "color": cat.get("color", "#7D7D7D") if cat else "#7D7D7D", "total": cr[0]["total"]}
    # Budget comparison
    month = end.strftime("%Y-%m")
    budgets = await db.budgets.find({"user_id": uid, "month": month}, {"_id": 0}).to_list(100)
    total_budget = sum(b["amount"] for b in budgets)
    budget_pct = round(total_exp / total_budget * 100, 1) if total_budget > 0 else 0
    tc = await db.transactions.count_documents({"user_id": uid, "date": {"$gte": ss, "$lte": es+"T23:59:59"}})
    return {"period_start": ss, "period_end": es, "total_expense": total_exp, "total_income": total_inc, "net": total_inc - total_exp, "top_category": top_cat, "total_budget": total_budget, "budget_used_pct": budget_pct, "transaction_count": tc}

# ==================== Settings ====================
@api_router.get("/settings")
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

@api_router.put("/settings")
async def update_settings(data: SettingsUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.settings.update_one({"user_id": user["id"]}, {"$set": upd}, upsert=True)
    s = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    s["has_pin"] = bool(s.get("pin_hash"))
    s.pop("pin_hash", None)
    return s

@api_router.post("/notifications/register")
async def register_push_token(data: PushTokenRequest, user: dict = Depends(get_current_user)):
    await db.settings.update_one({"user_id": user["id"]}, {"$set": {"push_token": data.token}}, upsert=True)
    return {"message": "Token registered"}

@api_router.post("/settings/pin/set")
async def set_pin(data: PinRequest, user: dict = Depends(get_current_user)):
    if len(data.pin) != 6 or not data.pin.isdigit():
        raise HTTPException(400, "PIN harus 6 digit")
    h = hashlib.sha256(data.pin.encode()).hexdigest()
    await db.settings.update_one({"user_id": user["id"]}, {"$set": {"pin_hash": h}}, upsert=True)
    return {"message": "PIN diatur", "has_pin": True}

@api_router.post("/settings/pin/verify")
async def verify_pin(data: PinRequest, user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"user_id": user["id"]})
    if not s or not s.get("pin_hash"):
        return {"valid": True}
    if hashlib.sha256(data.pin.encode()).hexdigest() == s["pin_hash"]:
        return {"valid": True}
    raise HTTPException(401, "PIN salah")

@api_router.delete("/settings/pin")
async def remove_pin(user: dict = Depends(get_current_user)):
    await db.settings.update_one({"user_id": user["id"]}, {"$set": {"pin_hash": ""}})
    return {"message": "PIN dihapus", "has_pin": False}

# ==================== Portfolio & Investments ====================
YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

async def _get_yahoo_crumb(client: httpx.AsyncClient) -> tuple:
    """Get Yahoo Finance crumb + cookies for authenticated API calls."""
    try:
        resp = await client.get("https://fc.yahoo.com/", follow_redirects=True)
        cookies = resp.cookies
        crumb_resp = await client.get(
            "https://query2.finance.yahoo.com/v1/test/getcrumb",
            cookies=cookies
        )
        return crumb_resp.text, cookies
    except Exception:
        return None, None

async def fetch_stock_price(ticker: str) -> Optional[dict]:
    """Fetch stock price and fundamentals from Yahoo Finance with multiple strategies."""
    try:
        async with httpx.AsyncClient(timeout=20.0, headers=YAHOO_HEADERS, follow_redirects=True) as client:
            current_price = None
            pbv = 0.0
            roe = 0.0
            der = 0.0

            # Get crumb for authenticated requests
            crumb, cookies = await _get_yahoo_crumb(client)

            # --- Strategy 1: v8 chart API (most reliable) ---
            try:
                chart_url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?range=5d&interval=1d"
                if crumb:
                    chart_url += f"&crumb={crumb}"
                resp = await client.get(chart_url, cookies=cookies)
                if resp.status_code == 200:
                    chart_data = resp.json()
                    chart_result = chart_data.get("chart", {}).get("result", [])
                    if chart_result:
                        meta = chart_result[0].get("meta", {})
                        current_price = meta.get("regularMarketPrice") or meta.get("previousClose")
                        if current_price:
                            current_price = float(current_price)
            except Exception as e:
                logger.warning(f"Chart API failed for {ticker}: {e}")

            # --- Strategy 2: v7 quote API ---
            if not current_price:
                try:
                    quote_url = f"https://query2.finance.yahoo.com/v7/finance/quote?symbols={ticker}"
                    if crumb:
                        quote_url += f"&crumb={crumb}"
                    resp = await client.get(quote_url, cookies=cookies)
                    if resp.status_code == 200:
                        q_data = resp.json()
                        results = q_data.get("quoteResponse", {}).get("result", [])
                        if results:
                            q = results[0]
                            current_price = q.get("regularMarketPrice") or q.get("regularMarketPreviousClose")
                            if current_price:
                                current_price = float(current_price)
                            # Also grab fundamentals here
                            raw = q.get("priceToBook")
                            if raw and isinstance(raw, (int, float)):
                                pbv = float(raw)
                except Exception as e:
                    logger.warning(f"Quote API failed for {ticker}: {e}")

            # --- Strategy 3: v10 quoteSummary for fundamentals ---
            try:
                modules = "price,defaultKeyStatistics,financialData"
                summary_url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules={modules}"
                if crumb:
                    summary_url += f"&crumb={crumb}"
                resp = await client.get(summary_url, cookies=cookies)
                if resp.status_code == 200:
                    s_data = resp.json()
                    s_result = s_data.get("quoteSummary", {}).get("result", [])
                    if s_result:
                        item = s_result[0]
                        
                        # Price fallback
                        if not current_price:
                            price_section = item.get("price", {})
                            rmp = price_section.get("regularMarketPrice", {})
                            current_price = rmp.get("raw") if isinstance(rmp, dict) else rmp
                            if current_price:
                                current_price = float(current_price)
                        
                        # Fundamentals
                        key_stats = item.get("defaultKeyStatistics", {})
                        fin_data = item.get("financialData", {})
                        
                        raw_pbv = key_stats.get("priceToBook", {})
                        val = raw_pbv.get("raw") if isinstance(raw_pbv, dict) else raw_pbv
                        if val and isinstance(val, (int, float)):
                            pbv = float(val)
                        
                        raw_roe = fin_data.get("returnOnEquity", {})
                        val = raw_roe.get("raw") if isinstance(raw_roe, dict) else raw_roe
                        if val and isinstance(val, (int, float)):
                            roe = float(val)
                        
                        raw_der = fin_data.get("debtToEquity", {})
                        val = raw_der.get("raw") if isinstance(raw_der, dict) else raw_der
                        if val and isinstance(val, (int, float)):
                            der = float(val)
            except Exception as e:
                logger.warning(f"QuoteSummary API failed for {ticker}: {e}")

            if not current_price:
                logger.error(f"All strategies failed for {ticker}")
                return None

            logger.info(f"Fetched {ticker}: price={current_price}, pbv={pbv}, roe={roe}, der={der}")
            return {
                "price": float(current_price),
                "pbv": pbv,
                "roe": roe,
                "der": der
            }
    except Exception as e:
        logger.error(f"Error fetching Yahoo Finance for {ticker}: {e}")
        return None

# Debug endpoint to test stock data for a ticker
@api_router.get("/portfolio/debug/{ticker}")
async def debug_ticker(ticker: str):
    if not ticker.endswith(".JK"):
        ticker += ".JK"
    result = await fetch_stock_price(ticker)
    return {"ticker": ticker, "result": result}

@api_router.post("/portfolio/update-prices")
async def update_market_prices(user: dict = Depends(get_current_user)):
    uid = user["id"]
    u = await db.users.find_one({"id": uid})
    investments = u.get("investments", [])
    updated = []
    for inv in investments:
        ticker = inv["ticker"]
        data = await fetch_stock_price(ticker)
        if data and isinstance(data, dict):
            doc = {
                "ticker": ticker,
                "price": data.get("price", 0.0),
                "pbv": data.get("pbv", 0.0),
                "roe": data.get("roe", 0.0),
                "der": data.get("der", 0.0),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.market_prices.update_one({"ticker": ticker}, {"$set": doc}, upsert=True)
            updated.append(doc)
    return {"message": "Prices updated", "updated": updated}

@api_router.get("/portfolio/net-worth")
async def get_net_worth(user: dict = Depends(get_current_user)):
    uid = user["id"]
    
    # 1. Get liquid assets
    pipe = [{"$match": {"user_id": uid}}, {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}]
    res = await db.transactions.aggregate(pipe).to_list(10)
    inc = sum(r["total"] for r in res if r["_id"] == "income")
    exp = sum(r["total"] for r in res if r["_id"] == "expense")
    liquid_asset = inc - exp

    # 2. Get investments
    u = await db.users.find_one({"id": uid})
    investments = u.get("investments", [])
    
    total_investment_value = 0
    total_unrealized_pl = 0
    holdings = []

    for inv in investments:
        ticker = inv["ticker"]
        lot_count = inv["lot_count"]
        avg_price = inv["average_buy_price"]
        shares = lot_count * 100
        
        market_data = await db.market_prices.find_one({"ticker": ticker})
        
        current_price = market_data["price"] if market_data else avg_price
        current_value = current_price * shares
        total_cost = avg_price * shares
        pl = current_value - total_cost
        
        total_investment_value += current_value
        total_unrealized_pl += pl
        
        holdings.append({
            "ticker": ticker,
            "lot_count": lot_count,
            "shares": shares,
            "average_buy_price": avg_price,
            "current_price": current_price,
            "total_value": current_value,
            "unrealized_pl": pl,
            "unrealized_pl_percentage": (pl / total_cost * 100) if total_cost > 0 else 0,
            "pbv": market_data["pbv"] if market_data else None,
            "roe": market_data["roe"] if market_data else None,
            "der": market_data["der"] if market_data else None,
            "updated_at": market_data["updated_at"] if market_data else None
        })

    total_cost_all = sum(h["average_buy_price"] * h["shares"] for h in holdings)
    total_asset_value = liquid_asset + total_investment_value

    return {
        "liquid_asset": liquid_asset,
        "total_investment_value": total_investment_value,
        "total_asset_value": total_asset_value,
        "total_unrealized_pl": total_unrealized_pl,
        "total_unrealized_pl_percentage": (total_unrealized_pl / total_cost_all * 100) if total_cost_all > 0 else 0,
        "holdings": holdings
    }

@api_router.post("/portfolio/investments")
async def add_investment(data: InvestmentCreate, user: dict = Depends(get_current_user)):
    uid = user["id"]
    ticker = data.ticker.upper()
    if not ticker.endswith(".JK"):
        ticker += ".JK"
        
    u = await db.users.find_one({"id": uid})
    investments = u.get("investments", [])
    
    found = False
    for inv in investments:
        if inv["ticker"] == ticker:
            total_shares_old = inv["lot_count"] * 100
            total_cost_old = total_shares_old * inv["average_buy_price"]
            total_shares_new = data.lot_count * 100
            total_cost_new = total_shares_new * data.average_buy_price
            
            inv["lot_count"] += data.lot_count
            new_shares = (inv["lot_count"] * 100)
            inv["average_buy_price"] = (total_cost_old + total_cost_new) / new_shares if new_shares > 0 else 0
            found = True
            break
            
    if not found:
        investments.append({
            "id": str(uuid.uuid4()),
            "ticker": ticker,
            "lot_count": data.lot_count,
            "average_buy_price": data.average_buy_price,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
    await db.users.update_one({"id": uid}, {"$set": {"investments": investments}})
    
    # Immediately fetch price for this ticker to ensure UI has data
    price_data = await fetch_stock_price(ticker)
    if price_data and isinstance(price_data, dict):
        doc = {
            "ticker": ticker,
            "price": price_data.get("price", 0.0),
            "pbv": price_data.get("pbv", 0.0),
            "roe": price_data.get("roe", 0.0),
            "der": price_data.get("der", 0.0),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.market_prices.update_one({"ticker": ticker}, {"$set": doc}, upsert=True)

    return {"message": "Investment added", "investments": investments}

@api_router.put("/portfolio/investments/{ticker}")
async def update_investment(ticker: str, data: InvestmentUpdate, user: dict = Depends(get_current_user)):
    uid = user["id"]
    u = await db.users.find_one({"id": uid})
    investments = u.get("investments", [])
    
    found = False
    for inv in investments:
        if inv["ticker"] == ticker.upper():
            if data.lot_count is not None:
                inv["lot_count"] = data.lot_count
            if data.average_buy_price is not None:
                inv["average_buy_price"] = data.average_buy_price
            found = True
            break
            
    if not found:
        raise HTTPException(404, "Investment not found")
        
    await db.users.update_one({"id": uid}, {"$set": {"investments": investments}})
    return {"message": "Investment updated", "investments": investments}
    
@api_router.delete("/portfolio/investments/{ticker}")
async def delete_investment(ticker: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    u = await db.users.find_one({"id": uid})
    investments = [inv for inv in u.get("investments", []) if inv["ticker"] != ticker.upper()]
    await db.users.update_one({"id": uid}, {"$set": {"investments": investments}})
    return {"message": "Investment removed"}

# ==================== Export ====================
@api_router.get("/export/csv")
async def export_csv(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if month: q["date"] = {"$regex": f"^{month}"}
    txs = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(10000)
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    cm = {c["id"]: c["name"] for c in cats}
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["Tanggal", "Jenis", "Kategori", "Jumlah", "Deskripsi"])
    for t in txs:
        w.writerow([t["date"], "Pemasukan" if t["type"]=="income" else "Pengeluaran", cm.get(t["category_id"],"Lainnya"), t["amount"], t.get("description","")])
    out.seek(0)
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=laporan_{month or 'semua'}.csv"})

@api_router.get("/export/backup")
async def backup(user: dict = Depends(get_current_user)):
    uid = user["id"]
    return {"transactions": await db.transactions.find({"user_id": uid}, {"_id": 0}).to_list(100000), "categories": await db.categories.find({"$or": [{"is_default": True}, {"user_id": uid}]}, {"_id": 0}).to_list(100), "budgets": await db.budgets.find({"user_id": uid}, {"_id": 0}).to_list(100)}

@api_router.post("/import/backup")
async def import_backup(data: BackupData, user: dict = Depends(get_current_user)):
    uid = user["id"]
    if data.transactions:
        await db.transactions.delete_many({"user_id": uid})
        for t in data.transactions: t["user_id"] = uid; t.pop("_id", None)
        await db.transactions.insert_many(data.transactions)
    if data.budgets:
        await db.budgets.delete_many({"user_id": uid})
        for b in data.budgets: b["user_id"] = uid; b.pop("_id", None)
        await db.budgets.insert_many(data.budgets)
    return {"message": "Data diimpor"}

@api_router.delete("/data/reset")
async def reset_data(user: dict = Depends(get_current_user)):
    uid = user["id"]
    await db.transactions.delete_many({"user_id": uid})
    await db.budgets.delete_many({"user_id": uid})
    await db.categories.delete_many({"user_id": uid, "is_default": False})
    await db.settings.update_one({"user_id": uid}, {"$set": {"pin_hash": "", "theme": "light"}})
    return {"message": "Data direset"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown():
    client.close()
