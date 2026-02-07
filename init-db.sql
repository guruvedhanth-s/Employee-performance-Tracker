-- Initialize database with extensions if needed

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for better performance (if not created by SQLAlchemy)
-- These will be created automatically by Alembic migrations
