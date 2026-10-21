from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "VeriPatch API"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str
    
    # Redis / Celery
    REDIS_URL: str
    
    # Auth
    JWT_SECRET: str
    
    # GitHub
    GITHUB_CLIENT_ID: str | None = None
    GITHUB_CLIENT_SECRET: str | None = None
    
    # AI Providers
    LLM_PROVIDER: str = "ollama"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5-coder:7b"
    GEMINI_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    
    # Sandbox
    SANDBOX_RUNTIME: str = "docker"
    MAX_SANDBOX_SECONDS: int = 300

    # Security
    ENCRYPTION_KEY: str

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_ignore_empty=True, 
        extra="ignore"
    )

settings = Settings()
