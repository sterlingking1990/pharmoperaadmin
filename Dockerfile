# Use official Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .

# Expose the port Fly expects
ENV PORT 8080
EXPOSE 8080

# Use Gunicorn to serve your Flask app
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "api.index:app"]
