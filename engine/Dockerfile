FROM python:3.11-slim

WORKDIR /app

# Dependencias del sistema necesarias para torch + sentence-transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Instalar CPU-only torch primero (evita descargar la versión CUDA ~2GB)
RUN pip install --no-cache-dir \
    torch==2.3.0+cpu \
    --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt

# Pre-descargar el modelo para que el contenedor no lo descargue en runtime
# Esto evita cold starts largos en producción
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

CMD ["python", "staking_manager.py"]
