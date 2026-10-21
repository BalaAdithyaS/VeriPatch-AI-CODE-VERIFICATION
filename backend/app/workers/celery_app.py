from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.task_routes = {
    "app.workers.*": "main-queue"
}

# Example task
@celery_app.task(name="app.workers.dummy_task")
def dummy_task(x, y):
    return x + y
