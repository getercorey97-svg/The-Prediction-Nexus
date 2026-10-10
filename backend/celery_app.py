"""
The Prediction Nexus: Celery Application Configuration
=======================================================
Configures Redis message broker and results backend.
Designed for high-throughput background processing without serverless timeouts.
"""

from __future__ import annotations

import os
from celery import Celery

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "nexus_workers",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=120,  # 2-minute safety limit
    task_soft_time_limit=90,
    worker_prefetch_multiplier=1,  # Prevent task hoarding
    worker_max_tasks_per_child=1000,
)
