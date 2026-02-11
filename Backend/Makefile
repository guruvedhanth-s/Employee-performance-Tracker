.PHONY: help setup install run stop clean test lint format shell db-init db-migrate docker-up docker-down

# Colors for output
BLUE := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help:
	@echo "$(BLUE)Employee Performance Tracker - Backend Makefile$(NC)"
	@echo ""
	@echo "$(GREEN)Setup Commands:$(NC)"
	@echo "  $(YELLOW)make setup$(NC)           - Full setup (venv + deps + docker + db)"
	@echo "  $(YELLOW)make install$(NC)         - Install Python dependencies"
	@echo ""
	@echo "$(GREEN)Running:$(NC)"
	@echo "  $(YELLOW)make run$(NC)             - Start development server"
	@echo "  $(YELLOW)make stop$(NC)            - Stop development server"
	@echo ""
	@echo "$(GREEN)Database:$(NC)"
	@echo "  $(YELLOW)make db-init$(NC)        - Initialize database"
	@echo "  $(YELLOW)make db-migrate$(NC)     - Run database migrations"
	@echo "  $(YELLOW)make db-reset$(NC)       - Reset database (warning: deletes data)"
	@echo ""
	@echo "$(GREEN)Docker:$(NC)"
	@echo "  $(YELLOW)make docker-up$(NC)      - Start Docker containers"
	@echo "  $(YELLOW)make docker-down$(NC)    - Stop Docker containers"
	@echo "  $(YELLOW)make docker-logs$(NC)    - View Docker logs"
	@echo ""
	@echo "$(GREEN)Testing & Quality:$(NC)"
	@echo "  $(YELLOW)make test$(NC)           - Run tests"
	@echo "  $(YELLOW)make test-cov$(NC)       - Run tests with coverage"
	@echo "  $(YELLOW)make lint$(NC)           - Run linters (flake8)"
	@echo "  $(YELLOW)make format$(NC)         - Format code (black + isort)"
	@echo "  $(YELLOW)make quality$(NC)        - Run all quality checks"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  $(YELLOW)make shell$(NC)          - Open Python shell"
	@echo "  $(YELLOW)make venv$(NC)           - Create virtual environment"
	@echo "  $(YELLOW)make clean$(NC)          - Clean cache files"
	@echo "  $(YELLOW)make requirements$(NC)   - Update requirements.txt"
	@echo ""

# ==============================================================================
# SETUP & INSTALLATION
# ==============================================================================

.PHONY: venv
venv:
	@echo "$(BLUE)Creating virtual environment...$(NC)"
	python3 -m venv venv
	@echo "$(GREEN)✓ Virtual environment created$(NC)"
	@echo "$(YELLOW)Activate with: source venv/bin/activate$(NC)"

install:
	@echo "$(BLUE)Installing dependencies...$(NC)"
	pip install -r requirements.txt
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

setup: venv install docker-up db-init
	@echo "$(GREEN)✓ Full setup completed!$(NC)"
	@echo "$(YELLOW)Start server with: make run$(NC)"

# ==============================================================================
# RUNNING THE APPLICATION
# ==============================================================================

run:
	@echo "$(BLUE)Starting development server...$(NC)"
	@echo "$(GREEN)Server: http://localhost:8000$(NC)"
	@echo "$(GREEN)Docs:   http://localhost:8000/docs$(NC)"
	python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

run-prod:
	@echo "$(BLUE)Starting production server...$(NC)"
	gunicorn app.main:app --workers 4 --proxy-protocol

stop:
	@echo "$(BLUE)Stopping servers...$(NC)"
	pkill -f "uvicorn app.main:app"
	@echo "$(GREEN)✓ Server stopped$(NC)"

# ==============================================================================
# DATABASE COMMANDS
# ==============================================================================

db-init:
	@echo "$(BLUE)Initializing database...$(NC)"
	python init_db.py
	@echo "$(GREEN)✓ Database initialized$(NC)"

db-migrate:
	@echo "$(BLUE)Running migrations...$(NC)"
	alembic upgrade head
	@echo "$(GREEN)✓ Migrations completed$(NC)"

db-reset:
	@echo "$(RED)⚠ WARNING: This will delete all data!$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to cancel, or wait 3 seconds...$(NC)"
	@sleep 3
	docker-compose down -v
	docker-compose up -d postgres redis
	@sleep 5
	python init_db.py
	@echo "$(GREEN)✓ Database reset$(NC)"

db-backup:
	@echo "$(BLUE)Backing up database...$(NC)"
	pg_dump -U ods_user -d ods_db > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backup created$(NC)"

# ==============================================================================
# DOCKER COMMANDS
# ==============================================================================

docker-up:
	@echo "$(BLUE)Starting Docker containers...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Containers started$(NC)"
	@sleep 3
	@docker-compose ps

docker-down:
	@echo "$(BLUE)Stopping Docker containers...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Containers stopped$(NC)"

docker-logs:
	docker-compose logs -f

docker-ps:
	docker-compose ps

docker-restart:
	@echo "$(BLUE)Restarting Docker containers...$(NC)"
	docker-compose restart
	@echo "$(GREEN)✓ Containers restarted$(NC)"

# ==============================================================================
# TESTING & QUALITY ASSURANCE
# ==============================================================================

test:
	@echo "$(BLUE)Running tests...$(NC)"
	pytest -v

test-cov:
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	pytest --cov=app --cov-report=html tests/
	@echo "$(YELLOW)Coverage report: htmlcov/index.html$(NC)"

test-watch:
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	pytest-watch

lint:
	@echo "$(BLUE)Running linters...$(NC)"
	flake8 app --max-line-length=100
	@echo "$(GREEN)✓ Linting completed$(NC)"

format:
	@echo "$(BLUE)Formatting code...$(NC)"
	black app
	isort app
	@echo "$(GREEN)✓ Code formatted$(NC)"

format-check:
	@echo "$(BLUE)Checking code format...$(NC)"
	black --check app
	isort --check-only app

quality: lint format-check test-cov
	@echo "$(GREEN)✓ All quality checks passed!$(NC)"

# ==============================================================================
# DEVELOPMENT UTILITIES
# ==============================================================================

shell:
	@echo "$(BLUE)Opening Python shell...$(NC)"
	python

shell-db:
	@echo "$(BLUE)Opening database shell...$(NC)"
	psql -U ods_user -d ods_db

requirements:
	@echo "$(BLUE)Updating requirements.txt...$(NC)"
	pip freeze > requirements.txt
	@echo "$(GREEN)✓ requirements.txt updated$(NC)"

clean:
	@echo "$(BLUE)Cleaning up...$(NC)"
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name ".DS_Store" -delete
	rm -rf .pytest_cache
	rm -rf .coverage
	rm -rf htmlcov/
	@echo "$(GREEN)✓ Cleanup completed$(NC)"

# ==============================================================================
# DEPENDENCY MANAGEMENT
# ==============================================================================

deps-outdated:
	@echo "$(BLUE)Checking for outdated packages...$(NC)"
	pip list --outdated

deps-upgrade:
	@echo "$(BLUE)Upgrading all packages...$(NC)"
	pip install --upgrade pip
	pip install --upgrade -r requirements.txt
	pip freeze > requirements.txt
	@echo "$(GREEN)✓ Packages upgraded$(NC)"

deps-security:
	@echo "$(BLUE)Checking for security vulnerabilities...$(NC)"
	pip install safety
	safety check

# ==============================================================================
# DEVELOPMENT ENVIRONMENT
# ==============================================================================

env-create:
	@echo "$(BLUE)Creating .env file...$(NC)"
	cp .env.example .env
	@echo "$(GREEN)✓ .env file created from template$(NC)"
	@echo "$(YELLOW)Edit .env with your configuration$(NC)"

env-show:
	@echo "$(BLUE)Environment variables:$(NC)"
	@if [ -f .env ]; then \
		cat .env; \
	else \
		echo "$(RED).env file not found$(NC)"; \
		echo "$(YELLOW)Run: make env-create$(NC)"; \
	fi

# ==============================================================================
# SPECIFIC FEATURES
# ==============================================================================

seed-db:
	@echo "$(BLUE)Seeding database with sample data...$(NC)"
	python scripts/seed.py
	@echo "$(GREEN)✓ Database seeded$(NC)"

health-check:
	@echo "$(BLUE)Checking API health...$(NC)"
	curl -s http://localhost:8000/health | python -m json.tool || echo "$(RED)API is not running$(NC)"

logs:
	@echo "$(BLUE)Viewing application logs...$(NC)"
	tail -f logs/app.log

# ==============================================================================
# BATCH OPERATIONS
# ==============================================================================

.PHONY: all
all: clean install test lint

dev: setup
	make run

prod: clean install test quality
	@echo "$(GREEN)✓ Ready for production!$(NC)"

reset: clean
	rm -rf venv
	rm -f .env
	rm -f logs/*.log
	@echo "$(GREEN)✓ Project reset$(NC)"

# ==============================================================================
# SHORTCUTS
# ==============================================================================

.DEFAULT_GOAL := help

# Common shortcuts
.PHONY: s r p t c i
s: setup
r: run
p: run-prod
t: test
c: clean
i: install

@echo ""
@echo "$(BLUE)Shortcuts: s=setup, r=run, p=production, t=test, c=clean, i=install$(NC)"
