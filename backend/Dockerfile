FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed (e.g. for building python packages)
# RUN apt-get update && apt-get install -y build-essential

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Use uvicorn for development with reload
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
