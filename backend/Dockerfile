FROM python:3.11-slim

WORKDIR /app

# Install the FRCM model library from the submodule.
# Build context must be the project root (see docker-compose.yml).
COPY third_party/dynamic-frcm-simple/src /app/frcm_src
ENV PYTHONPATH=/app/frcm_src

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application
COPY backend/app ./app
RUN mkdir -p /app/data/datasets

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
