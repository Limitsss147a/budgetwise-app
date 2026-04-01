FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code
COPY . .

# Railway automatically provides the PORT environment variable
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}
