"""Dev settings must derive CSRF_TRUSTED_ORIGINS from the environment.

config/settings/dev.py used to hardcode the list to ports 5173/5280/5367, which
silently overrode the CSRF_TRUSTED_ORIGINS env var that base.py reads. Any stack
served on another port (a second worktree, an isolated CI run) answered every
POST with HTTP 403.
"""

import importlib
import os
from unittest import mock

from django.test import SimpleTestCase

RELEVANT_KEYS = ("CSRF_TRUSTED_ORIGINS", "FRONTEND_PORT", "BACKEND_PORT")


def reload_dev_settings(**env):
    """Re-import config.settings.dev with `env` applied; other keys are unset.

    mock.patch.dict restores os.environ on exit, so the popped keys come back.
    """
    with mock.patch.dict(os.environ, env):
        for key in RELEVANT_KEYS:
            if key not in env:
                os.environ.pop(key, None)
        module = importlib.import_module("config.settings.dev")
        return importlib.reload(module)


class DevCsrfTrustedOriginsTests(SimpleTestCase):
    def test_env_origins_are_honoured(self):
        settings = reload_dev_settings(CSRF_TRUSTED_ORIGINS="http://localhost:4321,http://192.168.0.14:4321")
        self.assertIn("http://localhost:4321", settings.CSRF_TRUSTED_ORIGINS)
        self.assertIn("http://192.168.0.14:4321", settings.CSRF_TRUSTED_ORIGINS)

    def test_origins_follow_frontend_port(self):
        settings = reload_dev_settings(FRONTEND_PORT="5399")
        self.assertIn("http://localhost:5399", settings.CSRF_TRUSTED_ORIGINS)
        self.assertIn("http://127.0.0.1:5399", settings.CSRF_TRUSTED_ORIGINS)

    def test_no_ports_are_hardcoded(self):
        settings = reload_dev_settings(FRONTEND_PORT="5399", BACKEND_PORT="8899")
        for stale in ("5173", "5280", "5367", "8810"):
            self.assertNotIn(
                stale,
                " ".join(settings.CSRF_TRUSTED_ORIGINS),
                f"port {stale} must not be hardcoded in dev settings",
            )

    def test_defaults_cover_the_documented_dev_ports(self):
        settings = reload_dev_settings()
        for origin in (
            "http://localhost:5367",
            "http://127.0.0.1:5367",
            "http://localhost:8810",
        ):
            self.assertIn(origin, settings.CSRF_TRUSTED_ORIGINS)

    def test_non_numeric_port_is_ignored_instead_of_crashing(self):
        settings = reload_dev_settings(FRONTEND_PORT="not-a-port")
        self.assertNotIn("http://localhost:not-a-port", settings.CSRF_TRUSTED_ORIGINS)
        self.assertTrue(all(origin.startswith("http://") for origin in settings.CSRF_TRUSTED_ORIGINS))

    def test_no_duplicate_origins(self):
        settings = reload_dev_settings(CSRF_TRUSTED_ORIGINS="http://localhost:5399", FRONTEND_PORT="5399")
        self.assertEqual(
            len(settings.CSRF_TRUSTED_ORIGINS),
            len(set(settings.CSRF_TRUSTED_ORIGINS)),
        )
