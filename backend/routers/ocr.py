import os
import json
import re
import httpx
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from models import ScanReceiptRequest

router = APIRouter()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# Model vision yang tersedia di Groq per Juni 2026
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


@router.post("/ocr/scan-receipt")
async def scan_receipt(req: ScanReceiptRequest, user: dict = Depends(get_current_user)):
    if not GROQ_API_KEY:
        raise HTTPException(500, "GROQ API Key is not configured")

    prompt = """Kamu adalah asisten OCR yang sangat akurat. Analisis gambar struk belanja ini dan ekstrak informasi berikut:

1. **Nama Toko / Merchant**: Nama toko atau penjual yang tertera di struk.
2. **Total Harga**: Angka total pembayaran AKHIR (yang dibayar pelanggan). Berikan hanya angka bulat tanpa simbol mata uang, titik, atau koma. Contoh: 50000
3. **Tanggal Transaksi**: Dalam format YYYY-MM-DD. Jika tidak ada tanggal yang terlihat, kosongkan string.

PENTING:
- Untuk total harga, cari nilai "TOTAL", "GRAND TOTAL", "TOTAL BAYAR", atau "JUMLAH" yang paling besar/final.
- Jangan gunakan subtotal atau harga per item.
- Kembalikan HANYA JSON valid tanpa markdown, tanpa penjelasan tambahan.

Format output yang WAJIB:
{"merchant": "Nama Toko", "total_amount": 50000, "date": "2024-01-15"}"""

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{req.image_base64}"
                        }
                    }
                ]
            }
        ],
        "temperature": 0.1,
        "max_tokens": 512,
        "response_format": {"type": "json_object"}
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=60.0
            )

        if resp.status_code != 200:
            error_detail = resp.text
            print(f"[OCR] Groq API error {resp.status_code}: {error_detail}")
            raise HTTPException(resp.status_code, f"Gagal menghubungi AI OCR: {error_detail[:200]}")

        data = resp.json()
        content = data["choices"][0]["message"]["content"]

        # Bersihkan response jika AI tetap mengembalikan markdown
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            parts = content.split("```")
            if len(parts) >= 2:
                content = parts[1].strip()

        # Fallback: cari JSON object di dalam string
        if not content.startswith("{"):
            match = re.search(r'\{[^{}]*\}', content)
            if match:
                content = match.group(0)

        parsed = json.loads(content)

        # Normalisasi output
        result = {
            "merchant": str(parsed.get("merchant", "")).strip() or "Tidak Diketahui",
            "total_amount": 0,
            "date": str(parsed.get("date", "")).strip()
        }

        # Parse total_amount dengan aman (bisa string "50.000" atau int 50000)
        raw_amount = parsed.get("total_amount", 0)
        if isinstance(raw_amount, (int, float)):
            result["total_amount"] = int(raw_amount)
        elif isinstance(raw_amount, str):
            cleaned = re.sub(r'[^\d]', '', raw_amount)
            result["total_amount"] = int(cleaned) if cleaned else 0

        return result

    except json.JSONDecodeError as e:
        print(f"[OCR] JSON parse error: {e}, content was: {content[:300]}")
        raise HTTPException(500, "AI mengembalikan format yang tidak valid. Coba foto ulang struk dengan lebih jelas.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[OCR] Unexpected error: {type(e).__name__}: {str(e)}")
        raise HTTPException(500, f"Gagal mengekstrak data dari struk: {str(e)}")
