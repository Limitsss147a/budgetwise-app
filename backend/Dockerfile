FROM python:3.11-slim

WORKDIR /app

# Copy requirements from backend directory
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code
COPY backend/ .

# Railway automatically provides the PORT environment variable
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}
