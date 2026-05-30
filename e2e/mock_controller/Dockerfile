FROM python:3.14-slim

RUN pip install --no-cache-dir fastapi uvicorn

WORKDIR /app
COPY app.py .
COPY fixtures/ ./fixtures/

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
