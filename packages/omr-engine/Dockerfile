# syntax=docker/dockerfile:1
FROM python:3.13-slim

WORKDIR /app

# Install dependensi sistem yang dibutuhkan OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install uv untuk manajemen paket python cepat
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy packages
COPY packages/shared-schemas /app/packages/shared-schemas
COPY packages/omr-engine /app/packages/omr-engine

# Install paket-paket
WORKDIR /app/packages/omr-engine
RUN uv pip install --system -e /app/packages/shared-schemas -e .

EXPOSE 8000

CMD ["uvicorn", "omr_engine.api:app", "--host", "0.0.0.0", "--port", "8000"]
