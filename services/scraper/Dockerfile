# ─────────────────────────────────────────────
# DoraHacks scraper image (Playwright + stealth)
# ─────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# System deps required by Playwright's Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    libnss3 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libxshmfence1 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Least-privilege user
RUN useradd --system --uid 1001 --gid 0 scraper

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Chromium for Playwright (as root, then switch user)
RUN playwright install chromium

COPY . .
RUN chown -R scraper:0 /app

USER scraper

# Health endpoint via simple Python HTTP server on a separate port
EXPOSE 9000

CMD ["python", "scraper.py"]
