from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query

from database import db, month_range_query
from auth import get_current_user

router = APIRouter()


@router.get("/analytics/tags")
async def get_tags_analytics(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"], "type": "expense"}
    if month:
        q["date"] = month_range_query(month)
    
    pipeline = [
        {"$match": q},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 20}
    ]
    results = await db.transactions.aggregate(pipeline).to_list(20)
    return [{"tag": r["_id"], "total": r["total"], "count": r["count"]} for r in results]


@router.get("/analytics/summary")
async def get_summary(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    uid = user["id"]
    mq = {"user_id": uid}
    if month:
        mq["date"] = month_range_query(month)
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


@router.get("/analytics/category-breakdown")
async def get_breakdown(month: Optional[str] = None, type: str = "expense", user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"], "type": type}
    if month:
        q["date"] = month_range_query(month)
    pipe = [{"$match": q}, {"$group": {"_id": "$category_id", "total": {"$sum": "$amount"}}}, {"$sort": {"total": -1}}]
    res = await db.transactions.aggregate(pipe).to_list(50)
    gt = sum(r["total"] for r in res)
    bd = []
    if res:
        cat_ids = [r["_id"] for r in res]
        cats_list = await db.categories.find({"id": {"$in": cat_ids}}, {"_id": 0}).to_list(len(cat_ids))
        cat_map = {c["id"]: c for c in cats_list}

        for r in res:
            cat = cat_map.get(r["_id"])
            if cat:
                bd.append({"category_id": r["_id"], "category_name": cat["name"], "category_icon": cat["icon"], "category_color": cat["color"], "total": r["total"], "percentage": round(r["total"] / gt * 100, 1) if gt > 0 else 0})
    return {"breakdown": bd, "total": gt}


@router.get("/analytics/daily-trend")
async def get_daily_trend(days: int = Query(7, ge=1, le=30), user: dict = Depends(get_current_user)):
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days - 1)
    ss, es = start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
    pipe = [{"$match": {"user_id": user["id"], "date": {"$gte": ss, "$lte": es + "T23:59:59"}}}, {"$addFields": {"day": {"$substr": ["$date", 0, 10]}}}, {"$group": {"_id": {"day": "$day", "type": "$type"}, "total": {"$sum": "$amount"}}}, {"$sort": {"_id.day": 1}}]
    res = await db.transactions.aggregate(pipe).to_list(100)
    daily = {}
    for i in range(days):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        daily[d] = {"date": d, "income": 0, "expense": 0}
    for r in res:
        d = r["_id"]["day"]
        if d in daily:
            daily[d][r["_id"]["type"]] = r["total"]
    return list(daily.values())


@router.get("/analytics/monthly-trend")
async def get_monthly_trend(months: int = Query(6, ge=1, le=12), user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start_y, start_m = now.year, now.month - (months - 1)
    while start_m <= 0:
        start_m += 12
        start_y -= 1
    start_str = f"{start_y}-{str(start_m).zfill(2)}-01"
    end_m = now.month + 1
    end_y = now.year
    if end_m > 12:
        end_m -= 12
        end_y += 1
    end_str = f"{end_y}-{str(end_m).zfill(2)}-01"

    pipe = [
        {"$match": {"user_id": user["id"], "date": {"$gte": start_str, "$lt": end_str}}},
        {"$group": {"_id": {"month": {"$substr": ["$date", 0, 7]}, "type": "$type"}, "total": {"$sum": "$amount"}}},
    ]
    agg = await db.transactions.aggregate(pipe).to_list(1000)

    trend_map: dict = {}
    y, m = start_y, start_m
    for _ in range(months):
        key = f"{y}-{str(m).zfill(2)}"
        trend_map[key] = {"month": key, "income": 0, "expense": 0, "net": 0}
        m += 1
        if m > 12:
            m = 1
            y += 1

    for row in agg:
        key = row["_id"]["month"]
        t = row["_id"]["type"]
        if key in trend_map and t in ("income", "expense"):
            trend_map[key][t] = row["total"]

    trend = []
    for v in trend_map.values():
        v["net"] = v["income"] - v["expense"]
        trend.append(v)
    return trend


@router.get("/analytics/stats")
async def get_stats(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"], "type": "expense"}
    if month:
        q["date"] = month_range_query(month)
    pipe = [{"$match": q}, {"$addFields": {"day": {"$substr": ["$date", 0, 10]}}}, {"$group": {"_id": "$day", "total": {"$sum": "$amount"}}}]
    dr = await db.transactions.aggregate(pipe).to_list(31)
    if dr:
        totals = [r["total"] for r in dr]
        h = max(dr, key=lambda x: x["total"])
        return {"avg_daily_expense": round(sum(totals) / len(totals)), "highest_day": h["_id"], "highest_day_amount": h["total"], "days_with_expense": len(dr)}
    return {"avg_daily_expense": 0, "highest_day": "", "highest_day_amount": 0, "days_with_expense": 0}


# ==================== Weekly Report ====================


@router.get("/reports/weekly")
async def get_weekly_report(user: dict = Depends(get_current_user)):
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    ss, es = start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
    uid = user["id"]
    # Expenses
    ep = [{"$match": {"user_id": uid, "type": "expense", "date": {"$gte": ss, "$lte": es + "T23:59:59"}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    er = await db.transactions.aggregate(ep).to_list(1)
    total_exp = er[0]["total"] if er else 0
    # Income
    ip = [{"$match": {"user_id": uid, "type": "income", "date": {"$gte": ss, "$lte": es + "T23:59:59"}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    ir = await db.transactions.aggregate(ip).to_list(1)
    total_inc = ir[0]["total"] if ir else 0
    # Top category
    cp = [{"$match": {"user_id": uid, "type": "expense", "date": {"$gte": ss, "$lte": es + "T23:59:59"}}}, {"$group": {"_id": "$category_id", "total": {"$sum": "$amount"}}}, {"$sort": {"total": -1}}, {"$limit": 1}]
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
    tc = await db.transactions.count_documents({"user_id": uid, "date": {"$gte": ss, "$lte": es + "T23:59:59"}})
    return {"period_start": ss, "period_end": es, "total_expense": total_exp, "total_income": total_inc, "net": total_inc - total_exp, "top_category": top_cat, "total_budget": total_budget, "budget_used_pct": budget_pct, "transaction_count": tc}
