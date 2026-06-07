"""
Django dev settings — debug-friendly defaults, never use in production.
"""

from .base import *  # noqa: F401,F403

DEBUG = True
SECRET_KEY = "django-insecure-dev-key-change-me"
ALLOWED_HOSTS = ["*"]

# Cookies over plain HTTP in dev
JWT_COOKIE_SECURE = False

# Allow the Vite dev server origins to pass Django's CSRF Referer check on HTTPS (no-op on HTTP
# but kept so the setting is ready when the dev stack moves to HTTPS).
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5280",
    "http://localhost:5367",
    "http://localhost:8810",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5280",
    "http://127.0.0.1:5367",
]
