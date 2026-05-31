"""
Django production settings — all security hardening enforced.
SECRET_KEY must be set in the environment; no insecure default.
"""

import os

from .base import *  # noqa: F401,F403

DEBUG = False

SECRET_KEY = os.environ["SECRET_KEY"]  # fail hard if not set

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "").split()

# HTTPS / HSTS
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Cookie security
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Browser security headers
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
