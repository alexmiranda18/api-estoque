#!/bin/bash

# Create uploads directory if it doesn't exist
mkdir -p uploads

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env file from .env.example"
fi

# Build and start containers
docker-compose up --build -d

echo "Application is running at http://localhost:3000"