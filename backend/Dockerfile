FROM python:3.11-slim

WORKDIR /app

# Copy requirements from backend directory
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code
COPY backend/ .

# Provide PORT environment variable and EXPOSE it for Railway
ENV PORT 8080
EXPOSE 8080

CMD uvicorn server:app --host 0.0.0.0 --port ${PORT}
