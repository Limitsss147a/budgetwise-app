"""
BudgetWise Backend — Entry Point

Modul ini hanya bertugas:
1. Membuat instance FastAPI
2. Mendaftarkan middleware (CORS, rate-limiter)
3. Menyambungkan seluruh router
"""

import os

from fastapi import APIRouter, FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.cors import CORSMiddleware

from database import limiter
from startup import lifespan

from routers import auth, wallets, categories, transactions, budgets, goals
from routers import analytics, settings, portfolio, data, ocr

# ==================== App ====================

app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ==================== API Router ====================

api_router = APIRouter(prefix="/api")

# Sambungkan semua sub-router ke api_router
api_router.include_router(auth.router)
api_router.include_router(wallets.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(budgets.router)
api_router.include_router(goals.router)
api_router.include_router(analytics.router)
api_router.include_router(settings.router)
api_router.include_router(portfolio.router)
api_router.include_router(data.router)
api_router.include_router(ocr.router)

app.include_router(api_router)

# ==================== CORS ====================

# CORS — mobile app (no Origin header) selalu diperbolehkan, tapi origin HTTP/HTTPS
# eksplisit dikontrol via env ALLOWED_ORIGINS. Entry yang tidak valid (mis. "exp://"
# skema tanpa host) tidak lagi diperbolehkan sebagai fallback — lebih aman.
DEFAULT_DEV_ORIGINS = ["http://localhost:8081", "http://localhost:19006", "http://localhost:19000"]
_env_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
origins = _env_origins or DEFAULT_DEV_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Trigger deployment
