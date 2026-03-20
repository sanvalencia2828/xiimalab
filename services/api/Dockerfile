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

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set proper ownership
RUN chown -R apiuser:0 /app
USER apiuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
