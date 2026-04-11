FROM python:3.11-slim

# Ensure Python output is sent straight to Railway logs (no buffering)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# gcc/g++ needed to compile scipy/pyarrow wheels on slim image
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default cache dir; override with STATCAST_CACHE_DIR env var on Railway
RUN mkdir -p /data/cache

EXPOSE 8080

# Railway injects $PORT at runtime; fall back to 8080 for local docker use
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
