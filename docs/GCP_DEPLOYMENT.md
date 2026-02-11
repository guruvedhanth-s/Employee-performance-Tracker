# Google Cloud Setup Guide for Employee Performance Tracker

This guide will help you set up Google Cloud services for deploying the Employee Performance Tracker application.

## Prerequisites

1. Google Cloud SDK (gcloud) installed
2. Google Cloud project created
3. Billing enabled on the project
4. Docker installed locally

## 1. Set up Google Cloud Project

```bash
# Set your project ID
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"

# Configure gcloud
gcloud config set project $GCP_PROJECT_ID
gcloud config set compute/region $GCP_REGION
```

## 2. Enable Required APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable servicenetworking.googleapis.com
gcloud services enable redis.googleapis.com
```

## 3. Set up Database (Cloud SQL - PostgreSQL)

```bash
# Create Cloud SQL instance
gcloud sql instances create employee-performance-db \
    --database-version=POSTGRES_14 \
    --tier=db-f1-micro \
    --region=$GCP_REGION \
    --storage-size=10GB \
    --storage-type=SSD \
    --backup-start-time=02:00

# Create database
gcloud sql databases create ods_db --instance=employee-performance-db

# Create database user
gcloud sql users create ods_user --instance=employee-performance-db --password=your-secure-password

# Get database connection string
DB_CONNECTION_NAME=$(gcloud sql instances describe employee-performance-db --format='value(connectionName)')

# Set the DATABASE_URL format
# postgresql://ods_user:your-secure-password@/ods_db?cloudSqlInstance=$DB_CONNECTION_NAME
```

## 4. Set up Redis (Memorystore)

```bash
# Create Redis instance
gcloud redis instances create employee-performance-redis \
    --region=$GCP_REGION \
    --zone=$GCP_REGION-a \
    --size=1 \
    --tier=standard

# Get Redis host
REDIS_HOST=$(gcloud redis instances describe employee-performance-redis --region=$GCP_REGION --format='value(host)')
REDIS_PORT=6379

# Set the REDIS_URL format
# redis://$REDIS_HOST:$REDIS_PORT/0
```

## 5. Set up Artifact Registry

```bash
# Create Docker repository
gcloud artifacts repositories create employee-performance-tracker \
    --repository-format=docker \
    --location=$GCP_REGION \
    --description="Docker repository for Employee Performance Tracker"
```

## 6. Set up Service Account for GitHub Actions

```bash
# Create service account
gcloud iam service-accounts create github-actions-deploy \
    --display-name="GitHub Actions Deploy" \
    --description="Service account for deploying Employee Performance Tracker"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
    --member="serviceAccount:github-actions-deploy@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
    --member="serviceAccount:github-actions-deploy@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
    --member="serviceAccount:github-actions-deploy@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
    --member="serviceAccount:github-actions-deploy@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

# Generate and download the key
gcloud iam service-accounts keys create ~/key.json \
    --iam-account=github-actions-deploy@$GCP_PROJECT_ID.iam.gserviceaccount.com
```

## 7. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `GCP_SA_KEY`: The contents of the key.json file generated above
- `DATABASE_URL`: Your PostgreSQL connection string
- `REDIS_URL`: Your Redis connection string

## 8. Deploy

### Option 1: Using GitHub Actions (Recommended)

Push to the main branch to trigger automatic deployment.

### Option 2: Using the deployment script

```bash
# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"

# Run the deployment script
./deploy-gcp.sh
```

## Environment Variables

The application expects these environment variables:

### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

### Frontend
- `VITE_API_URL`: Backend API URL (automatically set during deployment)

## Security Notes

1. Use strong passwords for your database
2. Store secrets in GitHub Secrets, not in code
3. Enable IAM authentication for Cloud SQL
4. Use HTTPS endpoints provided by Cloud Run
5. Regularly rotate your service account keys

## Monitoring

You can monitor your deployments using:

1. **Google Cloud Console**: Navigate to Cloud Run services
2. **gcloud CLI**: `gcloud run services list`
3. **Logs**: `gcloud logs read "resource.type=cloud_run_revision"`