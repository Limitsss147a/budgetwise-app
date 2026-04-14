import asyncio
import httpx
import re
import yfinance as yf
import requests
import random

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
]

SCREAPER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
}

async def fetch_google_finance_price(ticker: str):
    try:
        symbol = ticker.split('.')[0]
        url = f"https://www.google.com/finance/quote/{symbol}:IDX"
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=SCREAPER_HEADERS)
            if resp.status_code != 200: return f"Error {resp.status_code}"
            match = re.search(r'class="YMlKec fxKbKc">([^<]+)</div>', resp.text)
            if match:
                price_str = match.group(1)
                cleaned = re.sub(r'[^\d.,]', '', price_str)
                # Logic from server.py
                if '.' in cleaned and ',' in cleaned:
                    dot_idx = cleaned.rfind('.')
                    comma_idx = cleaned.rfind(',')
                    if dot_idx > comma_idx: # Dot is decimal
                        return float(cleaned.replace(',', ''))
                    else: # Comma is decimal
                        return float(cleaned.replace('.', '').replace(',', '.'))
                elif '.' in cleaned:
                    parts = cleaned.split('.')
                    if len(parts[-1]) == 2: return float(cleaned)
                    else: return float(cleaned.replace('.', ''))
                elif ',' in cleaned:
                    parts = cleaned.split(',')
                    if len(parts[-1]) == 2: return float(cleaned.replace(',', '.'))
                    else: return float(cleaned.replace(',', ''))
                return float(cleaned)
            return "No match"
    except Exception as e: return str(e)

async def test():
    tickers = ["BBCA.JK", "TLKM.JK", "GOTO.JK"]
    for t in tickers:
        g = await fetch_google_finance_price(t)
        print(f"{t} (Google): {g}")
        
        # Test yf
        try:
            stock = yf.Ticker(t)
            info = stock.info
            p = info.get("regularMarketPrice") or info.get("currentPrice")
            print(f"{t} (yfinance): {p}")
        except Exception as e:
            print(f"{t} (yfinance): Error {e}")

asyncio.run(test())
