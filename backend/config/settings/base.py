"""
Django base settings — shared across all environments.
"""

import os
from datetime import timedelta
from pathlib import Path

from pythonjsonlogger import jsonlogger

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-dev-key-change-me")

DEBUG = os.environ.get("DEBUG", "0") == "1"

ALLOWED_HOSTS = os.environ.get(
    "DJANGO_ALLOWED_HOSTS", "localhost 127.0.0.1 [::1] backend"
).split(" ")


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Local command compatibility shims that intentionally override third-party commands.
    "apps.core",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "django_filters",
    # Local apps
    "apps.crm",
    "apps.jobs",
    "apps.finance",
    "apps.inventory",
    "apps.materials",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # Must be before CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.RequestLogMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.ContentSecurityPolicyMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
DB_ENGINE = os.environ.get("SQL_ENGINE", "django.db.backends.sqlite3")
DB_NAME = os.environ.get("SQL_DATABASE", BASE_DIR / "db.sqlite3")
DB_USER = os.environ.get("SQL_USER", "")
DB_PASSWORD = os.environ.get("SQL_PASSWORD", "")
DB_HOST = os.environ.get("SQL_HOST", "")
DB_PORT = os.environ.get("SQL_PORT", "")

if DB_ENGINE == "django.db.backends.postgresql":
    DATABASES = {
        "default": {
            # Custom backend: terminates lingering sessions before DROP DATABASE
            # so teardown never fails with "database is being accessed by other users".
            "ENGINE": "config.db_backends",
            "NAME": DB_NAME,
            "USER": DB_USER,
            "PASSWORD": DB_PASSWORD,
            "HOST": DB_HOST,
            "PORT": DB_PORT,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "core.User"

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": (
        # Cookie-based auth takes priority; header-based JWT kept for API clients / tests.
        "apps.core.cookie_auth.JWTCookieAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
        # Read-only lock for labs whose subscription lapsed (issue #104).
        # Views that override permission_classes pull it in via
        # apps.core.access.AUTHENTICATED instead.
        "apps.core.access.SubscriptionWriteAllowed",
    ),
    "DEFAULT_PAGINATION_CLASS": "config.pagination.OptionalPageNumberPagination",
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.ScopedRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("THROTTLE_ANON_RATE", "20/min"),
        "login": os.environ.get("THROTTLE_LOGIN_RATE", "5/min"),
        "signup": os.environ.get("THROTTLE_SIGNUP_RATE", "5/min"),
        "invitation_accept": os.environ.get(
            "THROTTLE_INVITATION_ACCEPT_RATE", "10/min"
        ),
        "two_factor_verify": os.environ.get("THROTTLE_2FA_VERIFY_RATE", "10/min"),
        "api_key_create": os.environ.get("THROTTLE_API_KEY_CREATE_RATE", "5/min"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# httpOnly JWT cookie settings (used by apps.core.cookie_auth)
# Default secure=True so production is safe if the env var is forgotten; dev.py overrides to False.
JWT_COOKIE_SECURE = os.environ.get("JWT_COOKIE_SECURE", "1") == "1"
JWT_COOKIE_SAMESITE = os.environ.get("JWT_COOKIE_SAMESITE", "Strict")

SPECTACULAR_SETTINGS = {
    "TITLE": "Dental Lab API",
    "DESCRIPTION": "API for Dental Lab Management System",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

_cors_origins = os.environ.get("CORS_ALLOWED_ORIGINS")
if _cors_origins:
    CORS_ALLOWED_ORIGINS = [
        origin.strip() for origin in _cors_origins.split(",") if origin.strip()
    ]
else:
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:5280",
        "http://127.0.0.1:5280",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
CORS_ALLOW_CREDENTIALS = True

# Production hardening toggles — defaults stay dev-friendly; override in production.py.
SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "0") == "1"
SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "0") == "1"
CSRF_COOKIE_SECURE = os.environ.get("CSRF_COOKIE_SECURE", "0") == "1"
SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = (
    os.environ.get("SECURE_HSTS_INCLUDE_SUBDOMAINS", "0") == "1"
)
SECURE_HSTS_PRELOAD = os.environ.get("SECURE_HSTS_PRELOAD", "0") == "1"
_csrf_trusted_origins = os.environ.get("CSRF_TRUSTED_ORIGINS", "")
CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in _csrf_trusted_origins.split(",") if origin.strip()
]
SECURE_PROXY_SSL_HEADER = (
    ("HTTP_X_FORWARDED_PROTO", "https")
    if os.environ.get("SECURE_PROXY_SSL_HEADER", "0") == "1"
    else None
)

EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "25"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "0") == "1"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "noreply@dentallab.sk")
FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5173")

# ---------------------------------------------------------------------------
# Stripe billing
#
# Every value defaults to empty. With no secret key configured the whole
# billing module reports itself as disabled (see
# ``apps.finance.stripe_service.stripe_enabled``) and the checkout/portal/
# webhook endpoints answer 503 instead of reaching out to the network, so dev
# environments and CI never depend on Stripe being reachable or configured.
# ---------------------------------------------------------------------------
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_PRO = os.environ.get("STRIPE_PRICE_PRO", "")
STRIPE_PRICE_ENTERPRISE = os.environ.get("STRIPE_PRICE_ENTERPRISE", "")
# Redirect targets. An env var present but empty falls back to the default —
# a blank success_url would make Stripe reject the session.
STRIPE_CHECKOUT_SUCCESS_URL = (
    os.environ.get("STRIPE_CHECKOUT_SUCCESS_URL", "")
    or f"{FRONTEND_BASE_URL}/settings/billing?checkout=success"
)
STRIPE_CHECKOUT_CANCEL_URL = (
    os.environ.get("STRIPE_CHECKOUT_CANCEL_URL", "")
    or f"{FRONTEND_BASE_URL}/settings/billing?checkout=cancelled"
)
STRIPE_PORTAL_RETURN_URL = (
    os.environ.get("STRIPE_PORTAL_RETURN_URL", "") or f"{FRONTEND_BASE_URL}/settings/billing"
)

# Days a lab keeps full write access after a failed payment before the
# read-only lock engages (issue #104).
SUBSCRIPTION_GRACE_DAYS = int(os.environ.get("SUBSCRIPTION_GRACE_DAYS") or 14)
# Where a locked-out lab is sent to pay. Surfaced in the 402 body.
SUBSCRIPTION_BILLING_URL = (
    os.environ.get("SUBSCRIPTION_BILLING_URL", "") or f"{FRONTEND_BASE_URL}/settings/billing"
)


class DefaultingJsonFormatter(jsonlogger.JsonFormatter):
    """Add request fields as null/empty values when non-request logs omit them."""

    DEFAULT_FIELDS = {
        "request_id": None,
        "method": None,
        "path": None,
        "status_code": None,
        "duration_ms": None,
        "user_id": None,
        "username": "",
        "lab_id": None,
        "remote_addr": "",
    }

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        for key, value in self.DEFAULT_FIELDS.items():
            log_record.setdefault(key, value)


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "config.settings.base.DefaultingJsonFormatter",
            "format": (
                "%(asctime)s %(levelname)s %(name)s %(message)s "
                "%(request_id)s %(method)s %(path)s %(status_code)s "
                "%(duration_ms)s %(user_id)s %(username)s %(lab_id)s %(remote_addr)s"
            ),
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        }
    },
    "loggers": {
        "apps.core.request": {
            "handlers": ["console"],
            "level": os.environ.get("REQUEST_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
    "root": {
        "handlers": ["console"],
        "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO"),
    },
}
