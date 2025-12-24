FROM python:3.11-slim

RUN pip install pandas==2.1.0

WORKDIR /app

COPY data/ /app/data/

RUN chmod -R 444 /app/data/
RUN mkdir -p /app/output
