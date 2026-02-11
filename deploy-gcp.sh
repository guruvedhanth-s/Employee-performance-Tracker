#!/bin/bash

# Google Cloud Run Deployment Script for Employee Performance Tracker

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-employee-performance-tracker}"
REGION="${GCP_REGION:-us-central1}"
REPO_NAME="employee-performance-tracker"
BACKEND_SERVICE_NAME="employee-performance-backend"
FRONTEND_SERVICE_NAME="employee-performance-frontend"

echo "Deploying to Google Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set the current project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable servicenetworking.googleapis.com

# Create Artifact Registry repository
echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker repository for Employee Performance Tracker" || echo "Repository already exists"

# Build and deploy backend
echo "Building and deploying backend..."
cd Backend
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$BACKEND_SERVICE_NAME:latest .
gcloud auth configure-docker $REGION-docker.pkg.dev
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$BACKEND_SERVICE_NAME:latest

# Deploy backend to Cloud Run
echo "Deploying backend to Cloud Run..."
gcloud run deploy $BACKEND_SERVICE_NAME \
    --image=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$BACKEND_SERVICE_NAME:latest \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --memory=1Gi \
    --cpu=1 \
    --timeout=300 \
    --concurrency=1000 \
    --max-instances=10

# Get backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE_NAME --region=$REGION --format='value(status.url)')
echo "Backend deployed to: $BACKEND_URL"

# Build and deploy frontend
echo "Building and deploying frontend..."
cd ../Frontend
docker build \
    --build-arg VITE_API_URL="$BACKEND_URL" \
    -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$FRONTEND_SERVICE_NAME:latest .
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$FRONTEND_SERVICE_NAME:latest

# Deploy frontend to Cloud Run
echo "Deploying frontend to Cloud Run..."
gcloud run deploy $FRONTEND_SERVICE_NAME \
    --image=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$FRONTEND_SERVICE_NAME:latest \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --memory=512Mi \
    --cpu=1 \
    --timeout=60 \
    --max-instances=10

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE_NAME --region=$REGION --format='value(status.url)')

echo "=========================================="
echo "🎉 Deployment completed successfully!"
echo "=========================================="
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "=========================================="

cd ..