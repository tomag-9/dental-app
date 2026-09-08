"""
Django dev settings — debug-friendly defaults, never use in production.
"""

import os

from .base import *  # noqa: F401,F403

DEBUG = True
SECRET_KEY = "django-insecure-dev-key-change-me"
ALLOWED_HOSTS = ["*"]

# Cookies over plain HTTP in dev
JWT_COOKIE_SECURE = False

# CSRF trusted origins for the dev stack.
#
# This used to be a hardcoded list of ports (5173/5280/5367) that overrode the
# CSRF_TRUSTED_ORIGINS value base.py reads from the environment. Every stack
# served on a different port — a second worktree, an isolated CI run — got HTTP
# 403 on POSTs. Now the env var is honoured and the origins for the ports the
# dev stack actually uses (FRONTEND_PORT, BACKEND_PORT) are added on top, so
# changing a port in env/*.env is enough.
#
# No-op on plain HTTP, but kept so the setting is ready when dev moves to HTTPS.
_env_origins = [origin.strip() for origin in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if origin.strip()]
_dev_ports = [
    port
    for port in (
        os.environ.get("FRONTEND_PORT", "5367").strip(),
        os.environ.get("BACKEND_PORT", "8810").strip(),
    )
    if port.isdigit()
]
_derived_origins = [f"http://{host}:{port}" for port in _dev_ports for host in ("localhost", "127.0.0.1")]
# dict.fromkeys keeps the order and drops duplicates.
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys([*_env_origins, *_derived_origins]))
