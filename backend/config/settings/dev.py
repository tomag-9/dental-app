"""
Django dev settings — debug-friendly defaults, never use in production.
"""

from .base import *  # noqa: F401,F403

DEBUG = True
SECRET_KEY = "django-insecure-dev-key-change-me"
ALLOWED_HOSTS = ["*"]
