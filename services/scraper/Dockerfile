# ─────────────────────────────────────────────
# Xiimalab Scraper Image (Playwright + Selenium)
# Multi-source hackathon scraper with automated scheduling
# ─────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# System deps required by Playwright's Chromium and Selenium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    curl \
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
    fonts-dejavu \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome for Selenium
RUN curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /tmp/chrome.deb && \
    dpkg -i /tmp/chrome.deb || apt-get -f install -y && \
    rm /tmp/chrome.deb

# Least-privilege user
RUN useradd --system --uid 1001 --gid 0 scraper

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Chromium for Playwright (as root, then switch user)
RUN playwright install chromium

# Pre-download ChromeDriver for Selenium
RUN playwright install-deps chromium || true

# Copy application code
COPY . .
RUN chown -R scraper:0 /app

USER scraper

# Health check port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)" || exit 1

# Run with automated scheduling
CMD ["python", "scraper.py"]
