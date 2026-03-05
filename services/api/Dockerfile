# ─────────────────────────────────────────────
# FastAPI service image
# ─────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install system deps (needed for asyncpg's C extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Least-privilege user
RUN useradd --system --uid 1001 --gid 0 apiuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R apiuser:0 /app
USER apiuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
