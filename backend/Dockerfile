# ==============================================================================
# The Prediction Nexus: Production Dockerfile
# Configured for Render Web Service (FastAPI) and Background Worker (Celery)
# ==============================================================================

FROM python:3.11-slim as base

WORKDIR /app

# Install system build dependencies for numpy/scipy
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY requirements.txt .

# Install dependencies into system environment
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Default port for Render Web Service
ENV PORT=8000
EXPOSE 8000

# Health check using keep-alive endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Default command: FastAPI ASGI server (Worker runs: celery -A celery_app worker --loglevel=info)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
