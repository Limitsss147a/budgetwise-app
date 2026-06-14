import asyncio
import os
import uuid
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI

from database import db, client
from auth import hash_password, verify_password

logger = logging.getLogger(__name__)

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
    {"name": "Transfer Keluar", "type": "expense", "id": "transfer-out", "icon": "swap-horizontal", "color": "#64748B"},
    {"name": "Transfer Masuk", "type": "income", "id": "transfer-in", "icon": "swap-horizontal", "color": "#64748B"},
]

# ==================== Shared snapshot helper ====================


async def _compute_user_snapshot(uid: str) -> dict:
    """Calculate and upsert today's net worth snapshot for a single user.
    Returns the snapshot dict (without _id)."""
    pipe = [{"$match": {"user_id": uid}}, {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}]
    res = await db.transactions.aggregate(pipe).to_list(10)
    inc = sum(r["total"] for r in res if r["_id"] == "income")
    exp = sum(r["total"] for r in res if r["_id"] == "expense")
    liquid = inc - exp

    investments = await db.investments.find({"user_id": uid}, {"_id": 0}).to_list(100)
    tickers = [inv["ticker"] for inv in investments]
    prices_list = (
        await db.market_prices.find({"ticker": {"$in": tickers}}, {"_id": 0}).to_list(len(tickers))
        if tickers else []
    )
    price_map = {p["ticker"]: p for p in prices_list}

    total_inv = 0
    total_pl = 0
    total_cost_all = 0
    for inv in investments:
        mp = price_map.get(inv["ticker"], {})
        cp = mp.get("price", 0) or inv["average_buy_price"]
        shares = inv["lot_count"] * 100
        total_inv += cp * shares
        total_cost_all += inv["average_buy_price"] * shares
        total_pl += (cp - inv["average_buy_price"]) * shares

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_pl_pct = (total_pl / total_cost_all * 100) if total_cost_all > 0 else 0
    snap = {
        "user_id": uid,
        "date": today_str,
        "total_asset_value": liquid + total_inv,
        "liquid_asset": liquid,
        "total_investment_value": total_inv,
        "total_unrealized_pl": total_pl,
        "total_unrealized_pl_percentage": total_pl_pct,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.net_worth_snapshots.update_one(
        {"user_id": uid, "date": today_str}, {"$set": snap}, upsert=True
    )
    return {k: v for k, v in snap.items() if k != "_id"}


# ==================== Daily auto-snapshot scheduler ====================

# Target time: 00:05 WIB = 17:05 UTC (previous day)
SNAPSHOT_HOUR_UTC = int(os.environ.get("SNAPSHOT_HOUR_UTC", "17"))
SNAPSHOT_MINUTE_UTC = int(os.environ.get("SNAPSHOT_MINUTE_UTC", "5"))


async def _daily_snapshot_scheduler():
    """Background loop that records net worth snapshots for all users once per day."""
    logger.info(f"📅 Daily snapshot scheduler started (target {SNAPSHOT_HOUR_UTC:02d}:{SNAPSHOT_MINUTE_UTC:02d} UTC)")
    while True:
        try:
            now = datetime.now(timezone.utc)
            # Calculate next run time
            target_today = now.replace(hour=SNAPSHOT_HOUR_UTC, minute=SNAPSHOT_MINUTE_UTC, second=0, microsecond=0)
            if now >= target_today:
                # Already past today's target — schedule for tomorrow
                target = target_today + timedelta(days=1)
            else:
                target = target_today

            wait_seconds = (target - now).total_seconds()
            logger.info(f"📅 Next snapshot run in {wait_seconds:.0f}s ({target.isoformat()})")
            await asyncio.sleep(wait_seconds)

            # --- Run daily snapshots ---
            logger.info("📸 Starting daily net worth snapshots for all users...")
            # Find all users that have at least one investment
            user_ids_with_investments = await db.investments.distinct("user_id")
            # Also include users that have transactions (they have liquid assets)
            user_ids_with_transactions = await db.transactions.distinct("user_id")
            all_user_ids = list(set(user_ids_with_investments) | set(user_ids_with_transactions))

            success_count = 0
            error_count = 0
            for uid in all_user_ids:
                try:
                    await _compute_user_snapshot(uid)
                    success_count += 1
                except Exception as e:
                    error_count += 1
                    logger.warning(f"Snapshot failed for user {uid}: {e}")

            logger.info(f"📸 Daily snapshots complete: {success_count} ok, {error_count} errors")

        except asyncio.CancelledError:
            logger.info("📅 Snapshot scheduler cancelled")
            break
        except Exception as e:
            logger.exception(f"📅 Snapshot scheduler error: {e}")
            # Sleep a bit before retrying to avoid a tight error loop
            await asyncio.sleep(60)


# ==================== Startup / Init ====================


async def _init_app_state():
    await db.users.create_index("email", unique=True)

    # Index paling penting — query utama semua analytics
    await db.transactions.create_index(
        [("user_id", 1), ("date", -1)],
        name="user_date_idx"
    )
    await db.transactions.create_index(
        [("user_id", 1), ("type", 1), ("date", -1)],
        name="user_type_date_idx"
    )

    # Budget lookup
    await db.budgets.create_index(
        [("user_id", 1), ("month", 1)],
        name="user_month_idx"
    )

    # Market prices cleanup otomatis setelah 24 jam
    # Drop old TTL index if it exists (it was on string values and never worked)
    try:
        await db.market_prices.drop_index("ttl_market_prices")
        # Also clear stale data that had ISO string updated_at (TTL never fired)
        await db.market_prices.delete_many({"updated_at": {"$type": "string"}})
        logger.info("Dropped old TTL index and cleared stale string-format market prices")
    except Exception:
        pass  # Index doesn't exist yet, that's fine
    await db.market_prices.create_index(
        "updated_at",
        expireAfterSeconds=86400,
        name="ttl_market_prices"
    )

    # Investment lookup
    await db.investments.create_index(
        [("user_id", 1), ("ticker", 1)],
        unique=True,
        name="user_ticker_unique"
    )

    # Wallet lookup
    await db.wallets.create_index(
        [("user_id", 1), ("id", 1)],
        unique=True,
        name="user_wallet_unique"
    )

    # Seed categories
    if await db.categories.count_documents({"is_default": True}) == 0:
        cats = [{"id": str(uuid.uuid4()), **c, "is_default": True, "created_at": datetime.now(timezone.utc).isoformat()} for c in DEFAULT_CATEGORIES]
        await db.categories.insert_many(cats)
        logger.info(f"Seeded {len(cats)} categories")
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "")

    if not admin_email or not admin_pw:
        logger.warning("⚠️  ADMIN_EMAIL / ADMIN_PASSWORD env tidak diset — admin seed dilewati")
    else:
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
            env = os.environ.get("ENVIRONMENT", "production")
            if env != "production":
                orphan_count = await db.transactions.count_documents({"user_id": {"$exists": False}})
                if orphan_count > 0:
                    logger.warning(f"Found {orphan_count} orphan transactions — migration skipped in production")
                    # Hanya assign jika benar-benar environment dev
                    if env == "development":
                        await db.transactions.update_many(
                            {"user_id": {"$exists": False}},
                            {"$set": {"user_id": admin_id}}
                        )
                        await db.budgets.update_many(
                            {"user_id": {"$exists": False}},
                            {"$set": {"user_id": admin_id}}
                        )

    # Migrate investments to separate collection
    # Safe Migration: Copy investments from users docs to separate collection if they exist
    users_with_inv = await db.users.find({"investments": {"$exists": True}}).to_list(None)
    for u in users_with_inv:
        uid = u.get('id')
        if not uid:
            continue
        user_investments = u.get('investments', [])
        for inv in user_investments:
            # Ensure consistency with new schema
            inv['user_id'] = uid
            inv.pop('_id', None)
            await db.investments.update_one(
                {"user_id": uid, "ticker": inv.get('ticker')},
                {"$set": inv},
                upsert=True
            )
        # Only unset after successful migration for this user
        await db.users.update_one({"id": uid}, {"$unset": {"investments": ""}})

    # Wallet Migration: Ensure all users have a 'Wallet Utama' and all transactions are linked to it
    all_users_cursor = db.users.find({}, {"id": 1})
    async for u in all_users_cursor:
        uid = u.get("id")
        if not uid: continue
        
        # 1. Pastikan ada Wallet Utama
        default_wallet = await db.wallets.find_one({"user_id": uid, "is_default": True})
        if not default_wallet:
            # Cari dompet pertama jika ada, jadikan default
            any_wallet = await db.wallets.find_one({"user_id": uid})
            if any_wallet:
                await db.wallets.update_one({"id": any_wallet["id"]}, {"$set": {"is_default": True, "name": "Wallet Utama"}})
                default_wallet = await db.wallets.find_one({"id": any_wallet["id"]})
            else:
                # Buat baru
                default_wallet_id = str(uuid.uuid4())
                now_iso = datetime.now(timezone.utc).isoformat()
                await db.wallets.insert_one({
                    "id": default_wallet_id,
                    "user_id": uid,
                    "name": "Wallet Utama",
                    "type": "bank",
                    "initial_balance": 0.0,
                    "color": "#10B981",
                    "icon": "wallet",
                    "is_default": True,
                    "created_at": now_iso,
                    "updated_at": now_iso
                })
                default_wallet = {"id": default_wallet_id}
        
        # Migration for missing wallet_id ONLY (do not overwrite existing ones)
        await db.transactions.update_many(
            {"user_id": uid, "wallet_id": {"$exists": False}},
            {"$set": {"wallet_id": default_wallet["id"]}}
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await _init_app_state()
    except Exception as e:
        logger.exception("App init failed: %s", e)
    # Start the daily snapshot scheduler as a background task
    scheduler_task = asyncio.create_task(_daily_snapshot_scheduler())
    yield
    # Cleanup: cancel the scheduler and close the DB connection
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    try:
        client.close()
    except Exception:
        pass
