# VeriPatch

**AI-assisted code review with evidence-backed, sandbox-verified automated repair.**

VeriPatch is a serious developer infrastructure product designed to connect to GitHub repositories, analyze code using deterministic static-analysis tools and LLM reasoning, identify issues, generate fixes, execute those fixes inside an isolated sandbox, run tests/lint/type checks, automatically debug failed patches, and optionally create a GitHub Pull Request.

## Core Principle
**LLMs propose. Tools execute. Sandboxes validate. Evidence determines confidence. Humans approve.**

## Features
- GitHub Repository Integration
- Deterministic Static Analysis (Python initially)
- LLM-powered Code Review
- Isolated Docker Sandbox Execution
- Automated Debugging Loop
- Evidence-backed Verification
- Automated Pull Request Generation

## Technologies
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, PostgreSQL, Redis, Celery
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **AI Models:** Supports Ollama (local) or cloud LLMs
- **Sandbox:** Docker

## Getting Started
(Documentation to be added as features are implemented)
