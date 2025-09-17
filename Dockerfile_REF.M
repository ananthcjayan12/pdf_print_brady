FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies needed for ReportLab and other packages
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       gcc \
       libfreetype6-dev \
       libjpeg-dev \
       zlib1g-dev \
       pkg-config \
       curl \
       wget \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app/

# Expose the port for the Django application
EXPOSE 8000

# Run the application with Gunicorn
CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000"] 



# Run the application with Django's runserver for debugging
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"] 