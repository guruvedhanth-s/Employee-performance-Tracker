#!/bin/bash
# Setup Workload Identity Federation for GitHub Actions
# This is more secure than service account keys!

PROJECT_ID="project-0990a5d7-310c-4a56-837"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"
WORKLOAD_IDENTITY_POOL="github-actions-pool"
WORKLOAD_IDENTITY_PROVIDER="github-provider"
REPO="guruvedhanth-s/Employee-performance-Tracker"

echo "=========================================="
echo "Setting up Workload Identity Federation"
echo "=========================================="
echo "Project ID: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"
echo "Service Account: $SERVICE_ACCOUNT"
echo "Repository: $REPO"
echo ""

# Enable required APIs
echo "Step 1: Enabling required APIs..."
gcloud services enable iamcredentials.googleapis.com \
  --project="${PROJECT_ID}"

# Create Workload Identity Pool
echo ""
echo "Step 2: Creating Workload Identity Pool..."
gcloud iam workload-identity-pools create "${WORKLOAD_IDENTITY_POOL}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --description="Workload Identity Pool for GitHub Actions" || echo "Pool may already exist"

# Create Workload Identity Provider for GitHub
echo ""
echo "Step 3: Creating Workload Identity Provider for GitHub..."
gcloud iam workload-identity-pools providers create-oidc "${WORKLOAD_IDENTITY_PROVIDER}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${WORKLOAD_IDENTITY_POOL}" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner=='guruvedhanth-s'" \
  --issuer-uri="https://token.actions.githubusercontent.com" || echo "Provider may already exist"

# Grant service account permissions to use Workload Identity
echo ""
echo "Step 4: Binding service account to Workload Identity..."
gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WORKLOAD_IDENTITY_POOL}/attribute.repository/${REPO}"

# Get the Workload Identity Provider resource name
echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📋 Add this to your GitHub repository secrets:"
echo ""
echo "Secret Name: WORKLOAD_IDENTITY_PROVIDER"
echo "Secret Value:"
gcloud iam workload-identity-pools providers describe "${WORKLOAD_IDENTITY_PROVIDER}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${WORKLOAD_IDENTITY_POOL}" \
  --format="value(name)"
echo ""
echo "This is the Workload Identity Provider path you'll use in GitHub Actions."
echo ""
