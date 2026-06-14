import asyncio
import logging
import os
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import requests
import yfinance as yf
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from database import db
from models import InvestmentCreate, InvestmentUpdate
from auth import get_current_user
from startup import _compute_user_snapshot

logger = logging.getLogger(__name__)

router = APIRouter()

# Headers to mimic a real browser to avoid blocks
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
]

SCREAPER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}


async def fetch_google_finance_price(ticker: str) -> float | None:
    """Scrape price from Google Finance (High reliability for IDX)."""
    try:
        symbol = ticker.split('.')[0]
        url = f"https://www.google.com/finance/quote/{symbol}:IDX"
        headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
        }
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return None
            match = re.search(r'class="YMlKec fxKbKc">([^<]+)</div>', resp.text)
            if match:
                price_str = match.group(1)
                cleaned = re.sub(r'[^\d.,]', '', price_str)
                if '.' in cleaned and ',' in cleaned:
                    dot_idx = cleaned.rfind('.')
                    comma_idx = cleaned.rfind(',')
                    if dot_idx > comma_idx:
                        return float(cleaned.replace(',', ''))
                    else:
                        return float(cleaned.replace('.', '').replace(',', '.'))
                elif '.' in cleaned:
                    parts = cleaned.split('.')
                    if len(parts[-1]) == 2:
                        return float(cleaned)
                    else:
                        return float(cleaned.replace('.', ''))
                elif ',' in cleaned:
                    parts = cleaned.split(',')
                    if len(parts[-1]) == 2:
                        return float(cleaned.replace(',', '.'))
                    else:
                        return float(cleaned.replace(',', ''))
                return float(cleaned) if cleaned else None
    except Exception as e:
        logger.warning(f"Google Finance scrape failed for {ticker}: {e}")
    return None


async def fetch_yahoo_v8_price(ticker: str) -> Optional[float]:
    """Fallback using Yahoo Finance v8 chart API which is less prone to 429 errors."""
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "application/json"
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                price = data.get("chart", {}).get("result", [{}])[0].get("meta", {}).get("regularMarketPrice")
                if price is not None:
                    return float(price)
    except Exception as e:
        logger.warning(f"Yahoo v8 scrape failed for {ticker}: {e}")
    return None


async def fetch_stock_price(ticker: str) -> dict | None:
    """Ambil harga saham dan fundamental."""
    y_ticker = ticker if '.JK' in ticker else f"{ticker}.JK"
    result = {"price": None, "pbv": 0.0, "roe": 0.0, "der": 0.0}

    # Strategi 1: Yahoo Finance v8
    try:
        y8_price = await fetch_yahoo_v8_price(y_ticker)
        if y8_price and y8_price > 0:
            result["price"] = y8_price
            try:
                def _get_fundamentals():
                    session = requests.Session()
                    session.headers.update({"User-Agent": random.choice(USER_AGENTS)})
                    stock = yf.Ticker(y_ticker, session=session)
                    info = stock.info
                    return {
                        "pbv": float(info.get("priceToBook") or 0),
                        "roe": float(info.get("returnOnEquity") or 0),
                        "der": float(info.get("debtToEquity") or 0),
                    }
                fundamentals = await asyncio.wait_for(
                    asyncio.to_thread(_get_fundamentals),
                    timeout=15
                )
                result.update(fundamentals)
            except Exception as e:
                logger.debug(f"Fundamentals fetch skipped for {ticker}: {e}")
            return result
    except Exception as e:
        logger.warning(f"Yahoo v8 failed for {ticker}: {e}")

    # Strategi 2: Google Finance
    try:
        g_price = await fetch_google_finance_price(y_ticker)
        if g_price and g_price > 0:
            result["price"] = g_price
            return result
    except Exception as e:
        logger.warning(f"Google Finance fallback failed for {ticker}: {e}")

    # Strategi 3: yfinance .info sebagai last resort
    try:
        def _get_yf():
            session = requests.Session()
            session.headers.update({"User-Agent": random.choice(USER_AGENTS)})
            stock = yf.Ticker(y_ticker, session=session)
            info = stock.info
            price = (
                info.get("currentPrice")
                or info.get("regularMarketPrice")
                or info.get("previousClose")
            )
            return {
                "price": float(price) if price and price > 0 else None,
                "pbv": float(info.get("priceToBook") or 0),
                "roe": float(info.get("returnOnEquity") or 0),
                "der": float(info.get("debtToEquity") or 0),
            }
        yf_data = await asyncio.wait_for(asyncio.to_thread(_get_yf), timeout=15)
        if yf_data and yf_data["price"]:
            result.update(yf_data)
            return result
    except asyncio.TimeoutError:
        logger.warning(f"yfinance timeout for {ticker} (>15s)")
    except Exception as e:
        logger.warning(f"yfinance failed for {ticker}: {e}")

    logger.error(f"All price sources failed for {ticker}")
    return None


async def _do_update_prices(uid: str):
    """Background worker — fetch prices sequentially to avoid rate limiting."""
    investments = await db.investments.find({"user_id": uid}, {"_id": 0}).to_list(100)
    if not investments:
        return
    for inv in investments:
        ticker = inv["ticker"]
        try:
            data = await fetch_stock_price(ticker)
            if data and isinstance(data, dict) and data.get("price"):
                await db.market_prices.update_one(
                    {"ticker": ticker},
                    {"$set": {**data, "updated_at": datetime.now(timezone.utc)}},
                    upsert=True
                )
            await asyncio.sleep(0.5)
        except Exception as e:
            logger.warning(f"Price update failed for {ticker}: {e}")
            continue


PRICE_STALE_SECONDS = 600
_price_refresh_locks: dict = {}


async def _background_refresh_stale(uid: str, stale_tickers: list[str]):
    """Background worker: refresh stale tickers TANPA memblokir HTTP response."""
    if uid not in _price_refresh_locks:
        _price_refresh_locks[uid] = asyncio.Lock()
    lock = _price_refresh_locks[uid]

    if lock.locked():
        logger.info(f"Refresh already in progress for user {uid}, skipping")
        return

    async with lock:
        logger.info(f"Background refresh: {len(stale_tickers)} tickers for user {uid}")
        semaphore = asyncio.Semaphore(3)

        async def _refresh_one(ticker: str):
            async with semaphore:
                try:
                    data = await fetch_stock_price(ticker)
                    if data and data.get("price"):
                        doc = {
                            "ticker": ticker,
                            "price": data.get("price", 0.0),
                            "pbv": data.get("pbv", 0.0),
                            "roe": data.get("roe", 0.0),
                            "der": data.get("der", 0.0),
                            "updated_at": datetime.now(timezone.utc),
                        }
                        await db.market_prices.update_one(
                            {"ticker": ticker}, {"$set": doc}, upsert=True
                        )
                        logger.info(f"Refreshed {ticker}: {data['price']}")
                    await asyncio.sleep(0.3)
                except Exception as e:
                    logger.warning(f"Background refresh failed for {ticker}: {e}")

        await asyncio.gather(*[_refresh_one(t) for t in stale_tickers])
        logger.info(f"Background refresh done for user {uid}")


@router.post("/portfolio/update-prices")
async def update_market_prices(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    background_tasks.add_task(_do_update_prices, user["id"])
    return {"message": "Price update dimulai di background"}


@router.get("/portfolio/net-worth")
async def get_net_worth(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    uid = user["id"]

    # 1. Hitung liquid assets
    pipe = [{"$match": {"user_id": uid}}, {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}]
    res = await db.transactions.aggregate(pipe).to_list(10)
    inc = sum(r["total"] for r in res if r["_id"] == "income")
    exp = sum(r["total"] for r in res if r["_id"] == "expense")
    liquid_asset = inc - exp

    # 2. Ambil investasi
    investments = await db.investments.find({"user_id": uid}, {"_id": 0}).to_list(100)

    if not investments:
        return {
            "liquid_asset": liquid_asset,
            "total_investment_value": 0,
            "total_asset_value": liquid_asset,
            "total_unrealized_pl": 0,
            "total_unrealized_pl_percentage": 0,
            "holdings": [],
            "prices_updating": False,
        }

    tickers = [inv["ticker"] for inv in investments]
    prices_list = await db.market_prices.find(
        {"ticker": {"$in": tickers}}, {"_id": 0}
    ).to_list(len(tickers))
    price_map = {p["ticker"]: p for p in prices_list}

    # 3. Identifikasi stale tickers
    now = datetime.now(timezone.utc)
    stale_tickers = []
    for ticker_ in tickers:
        market_data = price_map.get(ticker_)
        if not market_data:
            stale_tickers.append(ticker_)
        else:
            try:
                raw_updated = market_data["updated_at"]
                if isinstance(raw_updated, str):
                    updated_at = datetime.fromisoformat(raw_updated.replace("Z", "+00:00"))
                else:
                    updated_at = raw_updated if raw_updated.tzinfo else raw_updated.replace(tzinfo=timezone.utc)
                if (now - updated_at).total_seconds() > PRICE_STALE_SECONDS:
                    stale_tickers.append(ticker_)
            except Exception:
                stale_tickers.append(ticker_)

    prices_updating = False
    if stale_tickers:
        prices_updating = True
        logger.info(f"Scheduling background refresh for {len(stale_tickers)} tickers (user {uid})")
        background_tasks.add_task(_background_refresh_stale, uid, stale_tickers)

    # 4. Bangun holdings dari data cache
    total_investment_value = 0
    total_unrealized_pl = 0
    holdings = []

    for inv in investments:
        ticker = inv["ticker"]
        lot_count = inv["lot_count"]
        avg_price = inv["average_buy_price"]
        shares = lot_count * 100

        market_data = price_map.get(ticker) or {}
        current_m_price = market_data.get("price", 0)
        current_price = current_m_price if current_m_price > 0 else avg_price

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
            "pbv": market_data.get("pbv"),
            "roe": market_data.get("roe"),
            "der": market_data.get("der"),
            "updated_at": market_data.get("updated_at"),
            "price_is_stale": ticker in stale_tickers,
        })

    total_cost_all = sum(inv["average_buy_price"] * (inv["lot_count"] * 100) for inv in investments)
    total_asset_value = liquid_asset + total_investment_value
    total_pl_pct = (total_unrealized_pl / total_cost_all * 100) if total_cost_all > 0 else 0

    # Auto-snapshot
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing_snap = await db.net_worth_snapshots.find_one({"user_id": uid, "date": today_str})
    snap_doc = {
        "user_id": uid,
        "date": today_str,
        "total_asset_value": total_asset_value,
        "liquid_asset": liquid_asset,
        "total_investment_value": total_investment_value,
        "total_unrealized_pl": total_unrealized_pl,
        "total_unrealized_pl_percentage": total_pl_pct,
        "updated_at": datetime.now(timezone.utc),
    }
    if existing_snap:
        await db.net_worth_snapshots.update_one({"user_id": uid, "date": today_str}, {"$set": snap_doc})
    else:
        await db.net_worth_snapshots.insert_one(snap_doc)

    return {
        "liquid_asset": liquid_asset,
        "total_investment_value": total_investment_value,
        "total_asset_value": total_asset_value,
        "total_unrealized_pl": total_unrealized_pl,
        "total_unrealized_pl_percentage": total_pl_pct,
        "holdings": holdings,
        "prices_updating": prices_updating,
    }


@router.post("/portfolio/investments")
async def add_investment(data: InvestmentCreate, user: dict = Depends(get_current_user)):
    uid = user["id"]
    ticker = data.ticker.upper().strip()
    if ticker and not ticker.endswith(".JK"):
        ticker += ".JK"

    inv = await db.investments.find_one({"user_id": uid, "ticker": ticker})

    if inv:
        total_shares_old = inv["lot_count"] * 100
        total_cost_old = total_shares_old * inv["average_buy_price"]
        total_shares_new = data.lot_count * 100
        total_cost_new = total_shares_new * data.average_buy_price

        lot_count = inv["lot_count"] + data.lot_count
        new_shares = lot_count * 100
        avg_price = (total_cost_old + total_cost_new) / new_shares if new_shares > 0 else 0

        await db.investments.update_one(
            {"user_id": uid, "ticker": ticker},
            {"$set": {"lot_count": lot_count, "average_buy_price": avg_price}}
        )
    else:
        await db.investments.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "ticker": ticker,
            "lot_count": data.lot_count,
            "average_buy_price": data.average_buy_price,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    investments = await db.investments.find({"user_id": uid}, {"_id": 0}).to_list(100)

    # Immediately fetch price for this ticker
    price_data = await fetch_stock_price(ticker)
    if price_data and isinstance(price_data, dict):
        doc = {
            "ticker": ticker,
            "price": price_data.get("price", 0.0),
            "pbv": price_data.get("pbv", 0.0),
            "roe": price_data.get("roe", 0.0),
            "der": price_data.get("der", 0.0),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.market_prices.update_one({"ticker": ticker}, {"$set": doc}, upsert=True)

    return {"message": "Investment added", "investments": investments}


@router.put("/portfolio/investments/{ticker:path}")
async def update_investment(ticker: str, data: InvestmentUpdate, user: dict = Depends(get_current_user)):
    uid = user["id"]
    target_ticker = ticker.upper().strip()

    inv = await db.investments.find_one({"user_id": uid, "ticker": target_ticker})
    if not inv:
        raise HTTPException(404, "Investment not found")

    upd = {}
    if data.lot_count is not None:
        upd["lot_count"] = data.lot_count
    if data.average_buy_price is not None:
        upd["average_buy_price"] = data.average_buy_price

    if upd:
        await db.investments.update_one({"user_id": uid, "ticker": target_ticker}, {"$set": upd})

    investments = await db.investments.find({"user_id": uid}, {"_id": 0}).to_list(100)
    return {"message": "Investment updated", "investments": investments}


@router.delete("/portfolio/investments/{ticker:path}")
async def delete_investment(ticker: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    target_ticker = ticker.upper().strip()
    await db.investments.delete_one({"user_id": uid, "ticker": target_ticker})
    return {"message": "Investment removed"}


# ==================== Net Worth History ====================

PERIOD_DAYS = {"1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365}


@router.get("/portfolio/net-worth/history")
async def get_net_worth_history(
    period: str = Query("1M", regex="^(1W|1M|3M|YTD|6M|1Y|ALL)$"),
    user: dict = Depends(get_current_user),
):
    uid = user["id"]
    q: dict = {"user_id": uid}
    if period == "YTD":
        start = datetime.now(timezone.utc).strftime("%Y-01-01")
        q["date"] = {"$gte": start}
    elif period != "ALL":
        days = PERIOD_DAYS[period]
        start = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
        q["date"] = {"$gte": start}
    snapshots = (
        await db.net_worth_snapshots.find(q, {"_id": 0, "user_id": 0})
        .sort("date", 1)
        .to_list(1000)
    )
    return {"period": period, "snapshots": snapshots}


@router.post("/portfolio/net-worth/snapshot")
async def record_net_worth_snapshot(user: dict = Depends(get_current_user)):
    """Manually trigger a net worth snapshot for today."""
    snap = await _compute_user_snapshot(user["id"])
    return {"message": "Snapshot recorded", "snapshot": snap}
